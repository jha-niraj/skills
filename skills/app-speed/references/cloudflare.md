# Host: Cloudflare Workers via OpenNext (skip what does not apply)

On another serverless host the ideas hold (cold instances exist, fewer simultaneous requests help, answer
trivial paths before the framework), but the mechanics below are Cloudflare-specific. Ask how the host behaves
before porting them.

## 1. Cold starts: what they are

- A fresh isolate answers its first request in seconds (2-6 s for a 25-50 MiB bundle), a warm one in
  100-300 ms. `.open-next/worker.js` imports the server bundle INSIDE the first request that needs it.
- **Do not move that import to startup**: Durable Objects and crons share the script, and startup has a ~1 s CPU
  limit. Any lazy-load change keeps the import inside the first request.
- Fresh isolates are common: Ayudocs saw 3 of 12 sequential requests and 9 of 12 parallel ones land fresh. The
  cost is the bundle, not the database: a page with no database (`/login`) cost 4.5-6.0 s cold, like data pages.
- Workers for Platforms and a plain Worker run the same isolates; neither is warmer.
- **Fewer cold isolates:** fire fewer requests at once (the sidebar queue; do not start a poller in the same
  instant as the page; read the role from the layout's session instead of a client fetch per row); answer paths
  that do not need Next (sign-out, a WebSocket upgrade, an error tunnel) in `worker.ts` before the bundle loads.

## 2. Make the isolate and server time visible

- **Isolate headers:** module-level counter + start time, stamped on every response as `x-isolate-requests`
  (1 = fresh isolate) and `x-isolate-age-ms`. Cloudflare adds nothing of the kind. You cannot time a cold start
  from inside the Worker (the clock only moves at I/O) - measure from outside and read these.
- **The middleware matcher usually excludes `/api`**, so the sign-in POST, get-session and sign-out carry no
  isolate headers from it. Stamp them in the route (or in `worker.ts`). Example: `toTimedNextJsHandler(auth)` in
  `packages/auth/src/next.ts` - wraps the auth handler, counts on `globalThis`, adds `Server-Timing:
  total;dur=<ms>`, copies the response when its headers are immutable (keeping every `Set-Cookie`).
- **Database time:** time every database fetch through the driver's fetch hook (`neonConfig.fetchFunction`)
  inside an `AsyncLocalStorage` scope; send `Server-Timing: db;dur=..;desc="N queries"`. The browser's
  "Waiting" minus that = cold start + CPU + network. Gurukul left this out in round 3 because it touches a hot
  shared client file - a valid deferral; record it.
- Only durations and counts leave the server; never a query, a cookie or an id.

## 3. Placement and driver

- `wrangler.jsonc`: `"placement": { "region": "aws:<db-region>" }`; not `hint` (broad codes only); repeat under
  every `env.*`. Check `cf-placement: local-XXX` / `remote-XXX` on a live response (the bench probe prints it).
- One HTTP request per query (`neon()` + drizzle `neon-http`): no connection handshake on a cold isolate. A
  Worker opens at most six outgoing connections at once per request (`Promise.all` of N queries = ceil(N/6)
  waves) - the companion `query-and-render-speed` skill owns that.
- `nodejs_compat` in every Worker's compatibility flags (native crypto, the auth library).

## 4. Bundle size levers (measure before and after each)

Measure: `wrangler deploy --dry-run --outdir <dir>` ("Total Upload"), or the repo's bundle-size script; a
webpack stats dump grouped by `layer` for duplicates (the esbuild metafile cannot see webpack's layers).
Cloudflare's limit is 64 MiB uncompressed on paid plans.

1. **Every route entry costs ~92 KiB in Next 15.5.** Next attaches the SAME client-reference manifest to every
   route entry (it merges its internal client entrypoints into each), so even an API route with no client code
   carries all ~280 client modules. Gurukul: ~21.65 MiB of the bundle was these manifests. So: one catch-all
   with a registry instead of N routes (PDFs, crons, jobs, reads), old URLs kept by `next.config` rewrites
   (rewrites are config, not entries). Count entries in the map (`page.tsx` + `route.ts`); Gurukul grew 281 ->
   306 between passes, ~+2.2 MiB unnoticed.
2. **`"minify": true`** in wrangler config. Without it wrangler re-prints OpenNext's bundle unminified: Gurukul
   54.62 -> 69.36 MiB (could not deploy).
3. **Server `splitChunks`** (`minSize: 2000`, unlimited requests) so shared modules are not copied per route.
4. **OpenNext route-handler manifests factored** like page manifests (a one-condition `pnpm patch`; keep one
   patch file per resolved OpenNext version).
5. **One copy per package, not one per webpack layer:** `serverExternalPackages` for plain-JS packages reached
   from several layers (Ayudocs 27.9 -> 23.4 MiB). Not for `server-only` importers, react-server builds, or
   anything in Next's default `optimizePackageImports`. Run the per-layer dump first.
6. **The server-actions manifest:** a `'use server'` file registers EVERY export on every route whose tree
   imports any of them (Gurukul: 5.39 MiB, 1,107 actions, 40,940 action-route pairs). Split files a shared
   layout imports so they hold only what it needs; move reads out of `'use server'` (data-reads.md).
7. **No second error SDK** in the Next bundle; no namespace import of an icon set indexed by a runtime string
   (1,742 modules); heavy code (PDF, xlsx, docx parsing) in its own Worker behind a service binding.
8. **One `next` version** across shared packages: a shared UI package with a different `next` devDependency
   typechecks against other types; under webpack an alias usually resolves it to the app's copy, under
   Turbopack unproven. Gurukul tried pinning it and reverted: other apps in the monorepo run Next 16 and compile
   the same package - grep the built output for the stray version before deciding.

Honest expectation: size makes warm requests faster and cold starts only somewhat shorter. Say so.

## 5. Browser error reports that survive ad blockers (only if there is an error SDK)

Brave and uBlock drop requests to `*.ingest.sentry.io` and to Sentry's own `tunnelRoute: '/monitoring'`. Fix:
`worker.ts` answers `POST /api/t` before Next (a path with no telemetry word: never `monitoring`, `sentry`,
`track`, `log`, `analytics`, `collect`, `beacon`); one import-free module: POST only, body capped (1 MiB), the
envelope's DSN must be YOURS (else 403 - the whole security model; never a general proxy), forward to
`https://<host>/api/<projectId>/envelope/`, pass back status and rate-limit headers. Browser SDK `tunnel:
'/api/t'`; `tunnelRoute` off. Gurukul had no Sentry, so this was `n/a` (its PostHog exceptions are blocked the
same way; a PostHog proxy is the equivalent, declined for now).

## 6. Map rows for this area

Worker size + route-entry count; placement per Worker and env; `minify`; `splitChunks`; manifest patch;
`serverExternalPackages`; DOs/crons in the same script; what `worker.ts` answers before Next; isolate headers on
pages AND `/api/*`; `Server-Timing` on auth and read routes; error SDKs; last measurements and their date and
build.
