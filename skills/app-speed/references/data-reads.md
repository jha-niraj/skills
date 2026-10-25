# Reads: Server Actions are serialised, one GET read route, `'use server'` is public

## 1. Server Actions run one at a time

- **What:** in Next 15.5 every router dispatch - Server Actions included - joins ONE linked-list queue; the
  next starts only when the previous settles (`node_modules/next/dist/client/components/app-router-instance.js`,
  `runRemainingActions`). Read it in the INSTALLED version before claiming it; it was true in 15.5.16.
- **Consequences:**
  - Three client queries reading through actions on one click (a year change re-keying stats, trend and
    list; a sheet opening with three reads) run in series. Ayudocs: four panels queued ~30 s on one page.
  - A save clicked while reads are in flight waits behind them.
  - A navigation started while an action is pending discards it and sets `needsRefresh`; when the queue
    empties Next dispatches a refresh - one extra full server render of the page you just arrived on.
- **Check:** count `queryFn`s that call a function imported from a `'use server'` file (Gurukul: 284 of 341);
  find the surfaces where 2+ fire together - on load (with `initialData` + `staleTime` > 0 usually none) or on
  interaction (filter/year change, tab, sheet open, broad `invalidateQueries`). Gurukul: ~10-15 surfaces.

## 2. One GET catch-all read route

- **What:** `app/api/read/[name]/route.ts` (GET, `force-dynamic`, `Cache-Control: private, no-store`) and a
  `server-only` registry: name -> `{ params: zodSchema, run(args) }`. The route: unknown name 404; **session
  check before any read** (the middleware usually does not run on `/api/*`) 401; params that do not parse 400;
  otherwise the read's result as JSON (your `ActionResult` / error envelope, with the status of its kind). Each
  entry calls the SAME function the action did, so its own permission guard runs inside it. A typed client
  helper (`readRoute(name, args)`) builds the query string from typed args and throws on failure (the shape a
  `queryFn` wants). Keys, `initialData`, `keepPreviousData` stay as they were.
- **Why:** GETs run in parallel; mutations stay actions, where one at a time is a feature.
- **Cost, honestly:** one catch-all is ONE route entry (~92 KiB of client manifest in Next 15.5) whatever the
  number of reads - "no new API routes" argues against MANY routes, not one. Moving a read's body OUT of a
  `'use server'` file may even shrink the build (the server-actions manifest registers every export on every
  route that imports the file; Gurukul: 5.39 MiB for 1,107 actions).
- **Dates:** an action returns real `Date`s (React Flight); JSON returns strings. If screens were written
  against Dates, revive strings exactly in `Date.prototype.toJSON` shape in the client helper; leave date-only
  strings alone.
- **Decide with the user:** pilot or migrate. Gurukul piloted three surfaces (billing year change, staff tabs,
  a certificate sheet), measured with a HAR (overlapping vs queued, no refresh after a mid-read click) and a
  bundle-size run, and widens only if both move.
- **Example:** `apps/main/app/api/read/[name]/route.ts`, `apps/main/lib/read-routes/registry.ts`,
  `apps/main/lib/read-routes/client.ts` (type-only import of the registry, so it never reaches the browser).
- **Verify:** signed out `GET /api/read/<name>` -> 401 JSON; signed in, the reads overlap in the Network panel.

## 3. `'use server'` is a public POST endpoint

- **What:** every export of a `'use server'` file gets a stable action id callable by anyone with a cookie of
  the right NAME. It is not a marker for "server code".
- **Rules:**
  - A read-only query file carries no `'use server'` unless a client imports the function directly - and then
    the function checks the session and permission itself.
  - Guards, cached lookups and helpers live in `server-only` modules, never `'use server'` (a cached const in
    one broke a production build; a guard there is a public endpoint).
  - A `'use server'` file may export ONLY async functions (a `const` export broke Gurukul's admin build).
  - A scope filter that treats "no session" as "no restriction" (for crons) is never reachable from a browser
    door without a check in front.
  - Removing `'use server'` changes what a barrel exports to the client: re-export only types from barrels
    clients import.
  - A file a shared layout imports should hold only what the layout needs: every export is registered on every
    route under it.
- **Found on the way (security, fix before speed):**
  - Ayudocs: a forged cookie name plus the leads list's action id returned every lead; the read route, public
    in the middleware "because every read checks its own session", answered with no cookie at all.
  - Gurukul student portal: `resolveStudentLoginEmail` - a public action returning the REAL email for any
    username (minors' addresses). Fix: resolve the username inside the auth library (a before-hook on
    `/sign-in/email` rewrites a non-`@` identifier to the email server-side); unknown username = the same
    "invalid credentials" error; the action deleted.
  - Gurukul admin: `recordFailedAdminLogin` - a public action that answered "notfound" for a non-admin email (an
    admin-email oracle) and wrote audit rows unauthenticated. Fix: record failures in the auth library's
    after-hook on a failed sign-in (in `after()`), delete the action.
- **Check:** list every `'use server'` file; flag non-async exports; flag exports with no session/permission
  check in their own body (then read the helper they call - most are guarded through a local `who()`-style
  helper); look hardest at anything reachable before sign-in (sign-in pages, public forms).

## 4. Middleware cookie on an action request

Covered in `sign-in-out.md` s2: a cookie the middleware sets on a Server Action request makes Next re-render
the whole page into the action's reply (`x-action-revalidated` ending in `1`) and drop the prefetch cache.
Check any action's response header: it ends in `0` unless the action really revalidated.
