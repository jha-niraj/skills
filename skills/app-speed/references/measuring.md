# Measuring

Every claim is "before X, after Y" on the SAME kind of target. The baseline runs on the CURRENTLY deployed
build before anything new is deployed - building in the working tree does not change what is served.

## 1. Never measure on `next dev`

Dev turns prefetching off, compiles on demand and has no Worker entry. Use a deployed staging site, or a local
production server (`next start`, or `opennextjs-cloudflare preview` / `wrangler dev` on the built Worker) for a
rough local check. Curl checks of headers and status codes on dev are fine (they test logic, not speed).

## 2. Confirm the served build

```bash
curl -s https://staging.example.com/login | grep -o "$(cat .next/BUILD_ID)" | wc -l   # prints 1
```
Run from the directory that built it. Ayudocs twice measured an old build. The bench prints the served build id
and compares it with `<app-dir>/.next/BUILD_ID`.

## 3. The bundled benchmark: `scripts/bench-navigation.mts`

Copy it into the repo's `scripts/`, then `pnpm add -D playwright tsx && npx playwright install chromium`.
Every app-specific value is a flag or a key in `--config=<file>.json` (keys in camelCase):

| Flag | Default | Gurukul main / admin / student portal |
|---|---|---|
| `--sign-in-path` | `/login` | `/signin` / `/` / `/signin` |
| `--sign-in-endpoint` | `/api/auth/sign-in/email` | same |
| `--start` | `/dashboard` | `/deck` / `/home` / `/home` |
| `--sidebar` | `aside` | `aside` |
| `--module-buttons` | `<sidebar> button[aria-expanded]` | same (groups open one at a time) |
| `--skeleton` | `main .animate-pulse` | `main .gk-shimmer, main .animate-pulse` |
| `--pin-cookie` / `--pin-storage` | none | `gk-sidebar-collapsed=0` / `gk-admin-sidebar-collapsed=0` / storage `student-sidebar-collapsed=false` |
| `--read-path` | `/api/read/` | same |
| `--app-dir` | `.` | `apps/main` etc. (for `.next/BUILD_ID` and `.env.production`) |

Runs:
```bash
 export BENCH_EMAIL=... BENCH_PASSWORD=...        # the user sets these; leading space = not in history
npx tsx scripts/bench-navigation.mts --url=<staging> --runs=3
npx tsx scripts/bench-navigation.mts --url=<staging> --runs=3 --throttle=3g
npx tsx scripts/bench-navigation.mts --url=<staging> --probe=30 --probe-path=/login,/dashboard
```
- Per rail page, cold and warm (after a 300 ms hover): shown, ready, RSC first byte and end, reads (Server
  Action POSTs + read-route GETs) and the slowest, JS downloaded, hover prefetch requests/ms/KB, what "ready"
  waited for, how many renders came from a fresh isolate; plus the start page's idle prefetches.
- The probe (no browser, no sign-in): N requests per path on new connections with isolate headers, status,
  `Server-Timing`, `cf-placement`, build id. Two paths split the cold cost: a page needing the bundle but no
  database vs a signed-out protected path the middleware redirects.
- Read-only: it writes nothing; its one side effect is the session its sign-in creates. Refuses the production
  host (from `--prod-host` or `.env.production`) without `--allow-production`. Never prints the password; errors
  cut to one line (Playwright errors can quote headers carrying the session cookie).
- **Lessons baked in (each happened in Gurukul):** an unpinned rail measured 0 pages - pin it before first
  paint, and a run that measures 0 pages exits 1 (broken, not fast); probe medians printed "0 ms" when the isolate
  headers were missing - medians now come from the rows and an empty group prints "-"; a throttled run's file
  name says so, so it is never read as the unthrottled baseline; date AND time in file names.
- The user usually runs it (it needs their credentials and their staging); hand them the exact commands and
  record the report paths in the plan.

## 4. A HAR by hand - what a benchmark cannot see

A benchmark resting 300 ms before clicking on a fast line cannot see an in-flight FULL prefetch; a person on 3G
sees it in a minute. Ask the user for: DevTools Network, "Preserve log", the flow done by hand (sign in, click
through the rail, a tab/filter switch, a sheet open, sign out) once unthrottled, once on the 3G profile, once
after ten minutes idle; save the HAR. Read it with a throwaway script that prints ONLY path, method, status,
timings, the prefetch/RSC headers, `x-isolate-*`, `Server-Timing` - **never cookies, bodies or authorization
headers** (a HAR contains the password and the session). Delete the script after.

## 5. Other measurements

- Bundle size per Worker before and after each size lever, with the route-entry count (cloudflare.md s4).
- `x-action-revalidated` on an action response ends in `0` unless it really revalidated.
- Curl the middleware logic on any server (dev is fine for logic):
  ```bash
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Cookie: <name>=x" -H "Sec-Fetch-Dest: empty" -H "RSC: 1" <origin>/login     # 200
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Cookie: <name>=x" -H "Sec-Fetch-Dest: document" <origin>/login              # 307 home
  ```
  (a placeholder cookie value - presence is all the middleware checks; never a real session value in a command.)
- Sign-out: same-origin POST -> 204 + expired cookies; cross-origin -> 403.

## 6. Reference numbers

| Measure | Before | After |
|---|---|---|
| Ayudocs click to ready, Bookings / Leads (cold) | 9.7 s / 6.2 s | 0.43 s / 0.45 s |
| Ayudocs click to shown, 16 pages (cold) | 0.5-3.9 s | 0.1-0.2 s |
| Ayudocs settings section click | a full server render | no request |
| Ayudocs sidebar prefetches after sign-in | 12 at once, most on fresh isolates | home FULL, 11 shells, 350 ms apart |
| Ayudocs Worker size | 48.6 MiB | 23.4 MiB |
| Sign-in POST (Ayudocs, warm) | 540-656 ms via an action | 650 ms, 4 queries, 138 ms of database |
| Sign-out request | 2-3 s; 6.15 s cold (infodot) | 130-260 ms, before Next |
| After sign-out | 4.6 s to the login page cold | from the router cache |
| Pure-JS vs native scrypt per sign-in (Workers) | 0.8-1.5 s | ~30-46 ms |
| Gurukul `/signin` cold probe (pre-pass) | median 3,346 ms, p90 4,134 | (re-measure pending) |
| Z360 start page idle prefetches | 9 | 0 |
