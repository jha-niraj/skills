# Where the playbook may not fit - how Gurukul decided

The playbook is right by default. These are the places a real codebase questioned it, with the reasoning, so
the next codebase can decide faster. In the map, each such row is `differs - decision needed` until the user
picks; record the answer and the reason in the plan.

| Playbook says | Gurukul did | Why | When to follow the playbook instead |
|---|---|---|---|
| Error reports through a `/api/t` tunnel in `worker.ts` | Not built (`n/a`) | No Sentry anywhere; PostHog exceptions are blocked the same way, a PostHog proxy was offered and declined | As soon as a browser error SDK is added |
| Stream client blocks with TanStack `prefetchQuery` + pending dehydrate | Kept `initialData` seeding (189 files) + `use(promise)` (33) + server blocks | Both are playbook shapes; switching buys nothing measurable and the `try { await prefetchQuery } catch { notFound() }` trap cannot occur | A codebase already on `HydrationBoundary` (then TanStack 5.101.1+) |
| `returnTo` | `callbackUrl` | One name across three apps and better-auth's own `callbackURL`; consistency is the rule, not the name | Never change a consistent name for its own sake |
| Role/ban rules in the `/sign-in/email` after-hook (no extra read) | Kept `session.create.before` (one user read: ban, active, role) | One gate for magic link, Google, phone, invite and join; the after-hook would save one read on password sign-ins only | Password-only apps |
| A hand-written cookie-first session reader | `cache(auth.api.getSession)` | better-auth 1.7's own `getSession` already verifies the signed cookie cache with no database | Older better-auth or another library: read its source first |
| `advanced.database.joins: true` | Off | Broke production (relation names); saves one query | After a passing check against the real schema |
| "No new API routes" (round 1: ~85-92 KiB each) | One catch-all `GET /api/read/[name]` | The cost is per route ENTRY, so it argues against many routes, not one; Server Actions are serialised in 15.5 and stacked reads were measurable | Never one route per read |
| A dev twin route `app/api/sign-out/route.ts` | A `next.config` rewrite into the existing auth catch-all | A dev-only route still costs a production route entry (~92 KiB) | - |
| Mount the REAL sidebar on the sign-in landing | main and the student portal draw the rail class for class; admin mounts its real one | The real sidebars start Server Actions on mount, which queue around the landing navigation and run twice | A sidebar that only renders props |
| One short wait on sign-out | Removed a 1.2 s "goodbye" floor | The floor was a deliberate screen, but the user chose speed when asked; one exception kept: the offline app's replica wipe runs before the move | When a real clean-up must finish first - do it, without a floor |
| Home prefetched FULL | Asked first: `/deck` is a heavy client workbench | Measure the home's full payload; shell-only home is a valid answer | - |
| Middleware routes on the signed payload | Routes on the unsigned payload | It grants nothing; layouts verify | If the middleware ever grants access, verify the HMAC |
| Fix every small gap found | Some left with a reason (e.g. `useSession` on screens off the every-page path; `getPlanStudioPane` still writes on read) | Scope: the every-page path first | Record each left row; never silently drop |

## Corrections worth remembering

- **Verify mapper findings before acting.** "Six pushes without `markNavPending`" was five false positives (the
  mapper quoted the push line; the mark was on the line above) and one deleted file.
- **`notFound` must stay a real 404 when streaming.** A subagent moved an access check into a streamed block,
  so a page the person does not look after rendered not-found with a 200. Fix: `await` a CACHED access check in
  `page.tsx` before returning the streamed tree (cached reads cost no extra query).
- **A dev-only route costs a production route entry** - use a rewrite into an existing catch-all.
- **Aligning a shared package's `next` devDependency** looked like a one-line fix and was reverted: other apps
  in the monorepo run a different major and compile the same package.
- **Old maps go stale.** A benchmark from before 141 commits is a "before" picture only; re-baseline.
- **A middleware that cannot parse the cookie fails silently.** Gurukul's middlewares could not read better-auth
  1.7's base64url compact cookie, so cookie-based redirects never fired and layouts caught them a hop later.
  Curl each redirect branch once.
