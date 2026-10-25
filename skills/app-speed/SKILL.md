---
name: app-speed
description: Make a signed-in web app feel instant - clicks that paint a skeleton at once, sidebars that prefetch without flooding the server, tabs and filters that never re-render the page, reads that run in parallel, a sign-in that lands on the real shell immediately and a sign-out that takes one short request. Maps the codebase against a tested playbook first, asks every real decision, writes a plan, then builds and measures with a bundled Playwright benchmark. Use when the user says navigation is slow, "clicking feels laggy", "the sidebar is slow", "sign-in / sign-out takes seconds", "pages hang before the skeleton", "speed up the app", "/app-speed", or wants a navigation or auth speed audit. Targets Next.js App Router (15/16) + React 19 + TanStack Query, often on Cloudflare Workers via OpenNext with Postgres over HTTP and better-auth; adapts when parts differ.
---

# App speed: navigation, sign-in and sign-out

You make a signed-in app feel instant. The rules here were each measured on a deployed staging site in
real codebases (Ayudocs, Z360, infodot, JARS, then Gurukul across three apps) - **believe them by default**.
The one question to ask of each rule is whether it APPLIES here. If you think one is wrong for this codebase,
say so with a measurement or a code reason and ask before deviating.

Scope: what happens in the browser on a click, the request path around it, and the session path (sign-in,
middleware, session reads, sign-out). Server render cost (round trips, N+1, batching, Suspense streaming per
block) belongs to the companion `query-and-render-speed` skill; use both for a full speed pass.

Worked examples come from Gurukul (`AppLink`, `useStaggeredPrefetch`, `useSignOut`, a read-route registry...).
They are examples: **find your codebase's equivalent; if there is none, build it first in the shared UI or auth
package** (or a `components/` / `lib/` folder in a single app), then use it everywhere.

## When the stack differs

| Piece | If it differs |
|---|---|
| Not Cloudflare Workers | Skip `references/cloudflare.md` sections on isolates, `worker.ts` and bundle limits; the sidebar queue still helps (any serverless host has cold instances). Sign-out before the framework becomes "a tiny edge function or route that only expires cookies". |
| Not better-auth | Keep the principles: native hashing, a signed cookie read without the database, one cookie-cache config, direct POST sign-in, sign-out that clears cookies first. Map each better-auth name to the library's equivalent and say which you could not find. |
| No TanStack Query | Skip QueryClient defaults and `keepPreviousData`; in-page switches still use the history write; reads still go through a GET route (use `fetch` + your cache, or SWR). |
| Pages Router | Prefetch kinds, `loading.tsx`, `staleTimes`, Server Actions do not exist. Keep: one link component with intent prefetch (`router.prefetch` on intent), shallow routing for in-page switches, middleware rules, sign-in/out rules. Say plainly what you skipped. |
| Next 16 / segment cache on | Re-read how `router.prefetch` defaults and what a prefetch fetches in the installed version (`node_modules/next/dist/client/components/`) before porting the kind rules. Always pass the kind anyway. |
| No monorepo | The shared pieces live in one app's `components/` and `lib/`. Same rules. |

## The routine - run it every time this skill loads

1. **Ask first** with the AskUserQuestion picker (never a prose question), recommendation first marked
   `(Recommended)`:
   - "Map the codebase first?" - **whole codebase (Recommended for a first run)** / one app / one page or
     module / skip, I know the gap.
   - Only if it changes the work: is there a deployed staging site to measure (and a test account the user
     will put in env vars)? May you run a production build? Is anything live (real users)?
   Never ask what the code can answer.
2. **Map, read-only.** Find the plan/docs folder (`plan/`, `docs/`, else create `docs/app-speed/`). Write
   `<folder>/app-speed-map.md` from `references/map-template.md`. Each row: the rule (reference + section),
   what the codebase does today with `file:line` and counts, status `ok` / `gap` / `differs - decision
   needed`, a one-line recommendation. For a large codebase, split across parallel read-only subagents (auth +
   middleware; links + switches + data layer; pages + layouts; host + bundle + measuring), each writing its
   OWN section file and never rewriting another's; then merge a summary into the map. **Change no code.**
   **Verify risky findings yourself** - a Gurukul mapper reported six `router.push` calls "missing
   `markNavPending`"; five called it on the line above (the mapper quoted the push line), the sixth file was gone.
3. **Question the playbook, then ask.** Write the owner summary at the bottom of the map: already right
   (keep), where this codebase reasonably differs and why (see `references/judgement-calls.md` for how Gurukul
   decided its cases), the biggest gaps ranked by measured or likely cost, security issues found on the way.
   Ask every real decision with the picker (max 4 per call, 2-4 options, recommendation first, one-line reason
   each). Small fixes with one sensible answer are just done - list them, don't ask.
4. **Plan file before code:** `<folder>/app-speed-plan.md` (or append to the map) with the decisions
   recorded and waves of tasks `- [ ]`. A task is ticked only with a `Verified:` line saying what was run and
   what it printed. Never delete a task; out of scope = `[-]` with the reason. Suggested waves: 0 security +
   measurement tooling + baseline on the CURRENT deploy; 1 sign-in/out + middleware; 2 navigation (links,
   queue, switches, read route); 3 skeletons/layouts (and the companion skill's streaming); 4 re-measure.
5. **Build in waves.** Parallel subagents only on non-overlapping files; they do not run typecheck or builds;
   the lead runs ONE typecheck per wave and reviews each report (subagents make confident mistakes - in
   Gurukul one shipped a dev-only route costing a whole route entry, another made a "not yours" page render
   not-found with a 200). Never push or deploy; commit only if the project's own rules say so, asking first.
6. **Verify and measure** (`references/measuring.md`): the bundled bench before and after, a HAR by hand on
   3G, the served build id confirmed. Record numbers in the plan. Say plainly what was not verified (often:
   anything that needs the deployed Worker).

**Safety, always:** never write to a production database; never put a password, token or cookie in a file,
command or message (credentials only from env vars the user sets); scripts are read-only by default and write
only behind an explicit flag; never measure on `next dev`; never push or deploy.

## The rules (detail, checks, fixes and examples in the references)

### Links and prefetch - `references/navigation.md` s1-s3
1. **One shared link component**, the framework link imported nowhere else (lint `no-restricted-imports`).
   Viewport prefetch OFF; a SHELL prefetch on intent: 100 ms after the first `pointermove` (not
   `mouseenter`), cancelled on leave and click, at once on `touchstart`/`focus`. Default `<Link>` on a 50-row
   list = 50 server renders (Ayudocs Bookings 9.7 s to ready -> 0.43 s).
2. **Always pass the prefetch kind.** `router.prefetch(href)` with no kind is a FULL prefetch in Next 15.5
   without the segment cache.
3. **The sidebar queue:** shells one at a time, 350 ms apart, from idle, rail order, skipping the current
   page; on sight, twelve rows hit twelve fresh isolates at 2.3-5.5 s each.
4. **Only the home is prefetched FULL**, first in the queue. Everything FULL was ~440 KB and 14 renders per
   sign-in, and on 3G a click on a page whose full fetch was in flight waited with no skeleton.
5. **Never FULL on hover.** Perfect in a benchmark that rests 300 ms; on 3G every hovered click froze ~2 s.
6. **Acknowledge every click** (a top progress bar, pulse the clicked rail item) - a pending store the link
   reports to; programmatic `router.push` calls report too.

### In-page switches - `references/navigation.md` s4
7. Every tab/filter/pager/section writer is one of: **(a)** data in the browser -> `history.replaceState`,
   nothing else; **(b)** a client query keyed on the URL -> the same history write, `keepPreviousData`;
   **(c)** only the server has rows -> `useTransition` + `useOptimistic` + dim, or move the read behind the read
   route and become (b); **(d)** a real navigation -> leave it. `router.replace` to the same page = a full
   server render per click (Ayudocs settings: ten reads per section click -> none).

### Caches - `references/navigation.md` s5
8. `experimental.staleTimes` `{ dynamic: 60, static: 180 }` (tune to data freshness); QueryClient
   `staleTime` > 0 (30-60 s), `gcTime` 5 min, no refetch on focus, `retry: 1`. Mutations invalidate.

### Skeletons and layouts - `references/navigation.md` s6-s7
9. **A `loading.tsx` per routed section, drawn to the page's layout, with the REAL static title** (grey only
   data). No `loading.tsx` above a dynamic route = nothing to prefetch, the click waits for the full render.
10. **Layouts never await page data.** A layout sits ABOVE `loading.tsx`, so what it awaits blocks the skeleton.
    Session from the memoised cookie reader; a heavy read only one sheet needs moves into that sheet, which
    opens at once with its own skeleton.
11. **No writes in a render path** - a prefetch runs it on hover.

### Reads - `references/data-reads.md`
12. **Server Actions run one at a time** (one router queue in Next 15.5), and a navigation during a pending
    action triggers an extra full refresh render. Reads that fire together go through **one GET catch-all
    read route** with a registry, checking the session itself. Actions are for mutations.
13. **`'use server'` exports are public POST endpoints.** Read-only files carry no directive unless a client
    imports them; guards and helpers never live in one; a `'use server'` file may export only async functions.

### Session and middleware - `references/sign-in-out.md` s1-s3
14. **Middleware: cookie presence only**, no database. Redirect signed-in visitors off auth pages **only on a
    document load** (`Sec-Fetch-Dest: document` or absent) - Next strips `RSC`/`Next-Router-Prefetch` first.
15. **Cookie writes only on a GET, only when the value changes** - a cookie set on a Server Action request
    re-renders the whole page into the action's reply and drops the prefetch cache.
16. **Session reader memoised per request and cookie-first** (signed cookie cache, one config file, the
    framework-cookies plugin LAST); **no client `useSession` on every page** - the layout passes the user.

### Sign-in - `references/sign-in-out.md` s4-s6
17. **Direct POST** to the auth route, no `callbackURL` (a redirect chain + document reload), no
    `router.refresh()` after the push (renders the page twice).
18. **The destination is decided in the browser** from the POST reply, mirroring the middleware's redirects in
    order (pure module, "keep in step" comment); a wrong guess costs one redirect, never access.
19. **The real landing shell at once** - the destination's real frame and its own `loading.tsx`, drawn the
    instant the POST answers; not a hand-drawn "Signing you in" panel, not a splash with a floor.
20. **Native password hashing** (native scrypt via `node:crypto`; pure-JS scrypt cost 0.8-1.5 s per sign-in
    on Workers). Never bcrypt for new hashes.

### Sign-out - `references/sign-in-out.md` s7
21. **Answered before the framework** in the Worker entry: same-origin check, expire every auth cookie, **204
    at once**, the real sign-out in `waitUntil` (6.15 s cold -> 130-260 ms). A dev twin inside an EXISTING
    catch-all via a rewrite (a new route file costs a route entry).
22. **One shared hook** for every control: prefetch the sign-in page (AUTO) on mount and intent; then clear
    the query cache, `router.push(signIn)`, `router.refresh()`; bare sign-in URL; 401 = signed out; **no
    artificial delay**, no document load.

### Host - `references/cloudflare.md`
23. Worker **placement next to the database** (`placement.region`), repeated per env.
24. **Isolate headers + `Server-Timing`** on every response you measure, including `/api/*` the middleware
    skips.
25. **Bundle levers**: every route entry costs ~92 KiB of client manifest in Next 15.5 (prefer catch-alls and
    rewrites), `minify: true`, server `splitChunks`, one copy per package, no second error SDK.

## Where this playbook may not fit
Questioned in Gurukul and decided (detail in `references/judgement-calls.md`): an error-report tunnel with no
Sentry; TanStack pending-dehydrate vs existing `initialData` + `use(promise)`; `callbackUrl` vs `returnTo`; role
rules in a session-create hook vs the sign-in after-hook; better-auth's own cookie-first `getSession` vs a
hand-written reader; "no new API routes" vs one catch-all read route; mounting the real sidebar on the landing
vs drawing it class for class; a goodbye floor on sign-out. Record each such call in the map as `differs`.

## Measuring - `references/measuring.md`
`scripts/bench-navigation.mts` (Playwright; every app specific is a flag or a JSON config: sign-in path and
endpoint, start page, rail and skeleton selectors, pin cookie/storage; credentials from `BENCH_EMAIL` /
`BENCH_PASSWORD`; refuses production without `--allow-production`; writes nothing). Baseline on the CURRENT
deploy before any change ships; confirm the served build id; a HAR by hand on 3G and after 10 minutes idle;
never `next dev`. A run that measures 0 pages is broken, not fast.

## Worked examples (Gurukul; read, do not copy blindly)

| What | File |
|---|---|
| The link + pending store | `packages/ui/src/components/app-link.tsx` |
| Sidebar queue | `packages/ui/src/components/use-staggered-prefetch.tsx` |
| Sign-out hook | `packages/ui/src/hooks/use-sign-out.ts` |
| Cookie expiry, import-free | `packages/auth/src/sign-out.ts`, `apps/main/lib/sign-out-cookies.ts` |
| Sign-out before Next | `apps/main/worker.ts` (`answerSignOut`) |
| Dev twin in the catch-all | `apps/main/app/api/auth/[...all]/route.ts` + rewrite in `next.config.js` |
| Timed auth handler | `packages/auth/src/next.ts` (`toTimedNextJsHandler`) |
| Middleware | `apps/main/middleware.ts` (`isDocumentLoad`, `applySessionHint`) |
| Read route | `apps/main/app/api/read/[name]/route.ts`, `lib/read-routes/registry.ts`, `client.ts` |
| Landing | `apps/main/app/(auth)/signin/_components/sign-in-destination.ts`, `signed-in-landing.tsx` |
| A full map + plan | `plan/repo/speed/round-3-map.md`, `plan/repo/speed/round-3/*.md` |
