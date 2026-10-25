# Session, middleware, sign-in, sign-out

Targets: sign-in = two waits (the POST, then the first page's data) with the screen moving the moment the POST
answers; sign-out = one short request (~150-250 ms) and the sign-in page from the router cache.

Three costs decide how it feels: the number of round trips and what each waits for; database round trips inside
each request (5-30 ms each over HTTP next to the database, 50+ ms across a region); and cold starts (a fresh
Worker isolate loads the whole server bundle inside its first request: 2-6 s). Ayudocs proved with
`Server-Timing`: a 2,473 ms sign-in POST spent 138 ms on four queries - the rest was before the handler ran.
You cannot fix a cold start in sign-in code; you can stop making people wait for one.

## 1. Session reader: memoised, cookie-first, one config

- **What:** every server caller reads the session through ONE request-memoised reader (React `cache()`), which
  answers from the signed cookie cache without the database (verify signature, configured version, token
  match, expiry; anything short returns "ask the server", never "signed out"), and only then calls the auth
  server. better-auth: `session.cookieCache: { enabled, maxAge: 60-300, strategy: "compact", version }` in ONE
  import-free file imported by the auth config and any reader; **`nextCookies()` is the LAST plugin** (without
  it the cache is written only at sign-in and every request after `maxAge` hits the database).
- **Gurukul finding:** better-auth 1.7's own `getSession` already runs the cookie-first branch
  (`api/routes/session.mjs`), so each app has `getSession = cache(auth.api.getSession)` in `lib/session.ts`
  marked `server-only` - no second hand-written reader. Check your library version the same way.
- **Caveat to measure:** a render cannot set cookies, so once the cookie cache lapses (`maxAge`) server renders
  fall through to the database until a route handler or action rewrites it.
- **Staleness:** role/ban/name up to `maxAge` stale for READS; mutations, admin and onboarding gates read
  fresh (`disableCookieCache: true`). Bump `version` when the reader changes.
- **No client session fetch on every page:** a client `useSession()` in a root provider (analytics identify),
  the sidebar, a permissions or socket provider = one `GET /api/auth/get-session` per document load and one per
  tab focus (better-auth `refetchOnWindowFocus` defaults on), plus a sidebar skeleton although the layout
  already had the user. Fix: the layout passes the user (a small `ShellUser` context); leave `useSession` only
  on screens off the every-page path. Gurukul's student portal also fired a status route twice per load (a
  guard component + the sidebar) for what the middleware already enforced - deleted.
- **Check:** every `getSession` / `auth.api.getSession` call (memoised or not; route handlers may call it
  directly); every `useSession(`; cookie-cache config in how many files; `nextCookies()` position.

## 2. Middleware: presence only, document-only redirects, careful cookies

- **Presence only.** The session cookie's NAME (and at most an unsigned payload for ROUTING - role, onboarded,
  verified - never for granting; layouts verify). No database: it runs on every request, prefetches included.
- **Signed-in visitor on an auth page -> home, here, not in a layout** (a layout reading the session makes the
  sign-in page dynamic). But **redirect only a document load:**
  ```ts
  function isDocumentLoad(req: NextRequest) {
    const dest = req.headers.get('sec-fetch-dest');
    return dest === null || dest === 'document'; // no header = curl / old client
  }
  ```
  A router prefetch of the sign-in page while signed in (the sign-out control prefetches it) carries `empty`
  and must get the page. Next strips `RSC`/`Next-Router-Prefetch` before middleware, so a guard keyed on them
  never matches: Ayudocs' first attempt cached a redirect as the sign-in page and sign-out then followed it
  (`/admin` 307, `/login?returnTo=/admin`, twice). Never redirect a URL carrying the return parameter or an
  "expired" flag (that is the loop breaker).
- **Signed-out `/api/*` gets 401 JSON**, never the sign-in redirect (a poller following it downloaded the login
  page as a 1.45 s document). If the matcher excludes `/api`, each handler answers 401 itself.
- **Cookie writes only on a GET, only when the value changes.** A cookie set on a Server Action request makes
  Next merge it into the action's cookie store, report a revalidation (`x-action-revalidated` ending in `1`),
  re-render the whole page into the reply and drop the prefetch cache - every save paid a full render and the
  next click waited. Example: `applySessionHint` in `apps/main/middleware.ts`.
- **Gate on permissions, not role names**, in middleware too (Gurukul deleted a `role !== 'PRINCIPAL'` path
  gate: 8 of its 11 paths no longer existed, the rest guard with permissions in their layouts).
- **Check:** `grep -n "cookies.set(" middleware.*` - each behind both conditions; any `sec-fetch-dest`; any db
  import; the matcher; what `/api/*` signed out gets.

## 3. One redirect parameter, validated

One name end to end (`returnTo` or `callbackUrl` - consistent with the auth library's own is fine), carrying
path AND query; same-site path only (no `//host`, no `/\`); role areas enforced; carried INSIDE the sign-in call,
never stored by a separate request on page load. Z360 lost every deep link because the middleware set one name
and the login page read another.

## 4. Sign-in: direct POST, no redirect chain

- **What:** the static sign-in page (no layout reads session/cookies/headers; a `loading.tsx` drawn as the real
  form) calls the auth route directly (`authClient.signIn.email({ email, password })`), no `callbackURL`; then
  ONE `router.push(destination)`, no `router.refresh()`.
- **Why (measured shapes):** with `callbackURL`: POST, 302, document `/`, 307, first page (a reload and a chain).
  `router.push` + `router.refresh()`: the first page renders twice. Sign-in through a Server Action: the action
  set cookies so Next re-rendered the login route into its reply, and rules living only in the action were
  skipped by a direct POST to the route.
- **Inside the POST:** about four queries (user with accounts, ban check, session insert, your hooks - keep
  extra reads at zero). Role restrictions belong in the auth library so every caller hits them: the playbook
  prefers the after-hook on `/sign-in/email` (it has `ctx.context.newSession`; refused account = delete session,
  expire cookies, throw a coded error) over `databaseHooks.session.create.before` (one extra user read per
  sign-in). Gurukul kept its session-create hook on purpose - see judgement-calls.md.
- **`advanced.database.joins: true`** saves a query but **test it against the real schema first**: in Gurukul
  the adapter's relation names did not match and every sign-in and session read threw in production
  (`Cannot read properties of undefined (reading 'referencedTable')`). Reverted; never re-enable without a
  `findUserByEmail(includeAccounts)` + `findSession` check against the dev database.

## 5. The destination is decided in the browser

- **What:** a pure module `signInDestination(user, returnTo)` over the fields the POST reply carries (role,
  onboarded, email verified...), applying the middleware's redirects IN THE SAME ORDER, with a "keep in step with
  middleware.ts" comment and line references (copy the lists; the edge bundle exports only the middleware).
  Redirects that need the database (a closed tenant, a first-run setup) cannot be mirrored and stay server-side.
  It grants nothing: the middleware and layout still decide, so a wrong guess costs one redirect, never access.
- **Why:** pushing the bare return URL and letting the middleware correct it cost parents/students/unverified/
  not-onboarded accounts an extra 307 before their first page.
- **Example:** `apps/main/app/(auth)/signin/_components/sign-in-destination.ts`. Unit-test it.

## 6. The real landing shell at once

- **What:** nothing behind the session can be prefetched before the cookie exists, so the router has nothing to
  show and keeps the form up until the first page's data arrives (seconds when cold). The sign-in page draws the
  destination itself, full screen, the instant the POST answers: the real shell frame (sidebar with the right
  nav, the name/email/image from the reply, the destination highlighted) and **the destination route's own
  `loading.tsx`** inside it; destinations outside the shell (onboarding, verify) render their own `loading.tsx`.
  Then `router.push`. Remove "Signing you in" panels and splashes with a time floor (Gurukul's student portal
  held a 1.1 s splash).
- **Why:** a hand-drawn panel stayed up for the whole layout and was visibly replaced by a screen that looked
  nothing like it.
- **Mount the real sidebar, or draw it?** The playbook says mount the real thing. Gurukul's sidebars start
  Server Actions on mount (usage, plan, credits...), which would queue around the landing navigation and run
  twice - so main and the student portal draw the rail class for class (static chrome real, nav rows grey); the
  admin app mounts its real sidebar. Decide per app; record why.
- **Example:** `apps/main/app/(auth)/signin/_components/signed-in-landing.tsx`.
- **After landing:** the sidebar queue (navigation.md s2) - home FULL, the rest as shells, one at a time.

## 7. Sign-out: before the framework, 204, real sign-out behind it

- **Why:** better-auth's `/sign-out` clears cookies only in its reply, which waits for its database work inside
  the Next bundle - on a cold isolate 6.15 s (infodot). The browser cannot show the sign-in page until the cookie
  is gone (the middleware sends a live session home). Gurukul before: nine controls, a 1.2 s floor, then
  `window.location = "/"` -> `/` renders -> 307 -> `/signin` (two documents).
- **The server side** (Worker entry, before `handler.fetch`):
  1. `POST /api/sign-out` only; refuse anything not same-origin (403) - `Origin` equals the request origin, or
     `Sec-Fetch-Site: same-origin`.
  2. Expire every auth cookie the browser sent (`<prefix>.*`, including `__Secure-` names and chunked
     `session_data.0/.1`), with `Path=/`, `Secure` for `__Secure-` names (or the browser keeps it), and on the
     cross-subdomain domain too if one is configured; plus hint cookies (marketing "signed in" hint,
     impersonation hint). 204, `Cache-Control: no-store`.
  3. `ctx.waitUntil(nextFetch(authSignOutRequest(request)))` - better-auth's own `/api/auth/sign-out` with the
     ORIGINAL cookies, Origin, IP and UA, so the session row is deleted and any sign-out hook (Gurukul: the
     impersonation STOP record) still fires. It also warms the isolate for the next request. If it fails, the
     row expires on its own.
  Keep the cookie helper import-free (no auth library, no Next): the Worker entry loads it outside the bundle.
  Example: `packages/auth/src/sign-out.ts`, `apps/main/lib/sign-out-cookies.ts`, `apps/main/worker.ts`. An app
  that used the generated `.open-next/worker.js` directly gets its own `worker.ts` (wrangler `main` -> it).
- **The `next dev` twin:** the Worker entry does not run in dev. **Do not add `app/api/sign-out/route.ts`** -
  every route entry costs ~92 KiB of manifest (a subagent did exactly this in Gurukul). Add a rewrite
  `/api/sign-out -> /api/auth/<twin-name>` in `next.config` and handle that segment inside the EXISTING auth
  catch-all's POST (await the library sign-out there, then the same cookie expiry). Example:
  `apps/main/app/api/auth/[...all]/route.ts`.
- **The client side - one hook for every control** (`packages/ui/src/hooks/use-sign-out.ts`):
  1. prefetch the sign-in page with `PrefetchKind.AUTO` on mount and on pointer-enter/focus/touch (static page:
     the shell is the whole page), not when already on it. Needs the `Sec-Fetch-Dest` middleware fix first.
     Without it: cookies gone in 392 ms, then 4.6 s to the login page on a cold isolate.
  2. on click: one `fetch('/api/sign-out', { method: 'POST' })`; ANY response counts as signed out (a 401 =
     the session already ended in another tab); only a network failure keeps the person here.
  3. `queryClient.clear()`, app clean-up (analytics reset, an offline replica wipe), `markNavPending`,
     `router.push(signInPath)`, `router.refresh()` (drops every cached page of the person who left - else Back
     redraws their data on a shared machine).
  4. a BARE sign-in URL, never a return parameter; **no artificial delay**, no goodbye screen, no
     `window.location` (reloads every script for a static page).
  5. no database hook on session delete (a read and a write per sign-out nobody read).
- **Verify:** same-origin POST -> 204 with every auth cookie expired; cross-origin -> 403; on staging the
  session row is gone and the HAR shows the sign-in page served from cache.

## 8. Password hashing

- **What:** native hashing. A pure-JS scrypt on Workers took **0.8-1.5 s per sign-in**; better-auth's
  `@better-auth/utils/password` has a `workerd` export condition resolving to native `node:crypto` scrypt
  (~30-46 ms); `nodejs_compat` must be on. A native PBKDF2 via WebCrypto is fine too.
- **Check:** search the BUILT server bundle for the pure-JS implementation (`scryptAsync` from
  `@noble/hashes`); grep for `bcrypt.hash`.
- **Migrating from bcrypt (Gurukul):** one `@repo/auth/password` helper (`hashPassword` native scrypt in the
  library's own format; `verifyPassword` accepts `$2` bcrypt AND scrypt) used by the auth library and EVERY
  direct writer; after a successful bcrypt verify, re-hash to scrypt in `after()`; bcrypt removed from apps.
  Pre-launch only: a dry-run-by-default reset script (`--apply` to write, password from an env var) moved every
  account at once. Never bcrypt for new hashes.

## 9. Placement

`placement.region` next to the database (e.g. `"aws:ap-southeast-1"`), not `hint` (the API refuses a provider
region there), repeated under every `env.*` block. Check `cf-placement` on a live response. See cloudflare.md.
