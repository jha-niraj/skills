# Map template - `<plan folder>/app-speed-map.md`

Copy this, fill every row, change no code. Status: `ok` / `gap` / `differs - decision needed` (`n/a` with a
reason). Every row names files with `file:line` and counts. A row is never `ok` without having been looked at.
For a large codebase, give each mapper one section file (`app-speed/<section>.md`), never rewriting another's;
the lead merges the owner summary. Gurukul's `plan/repo/speed/round-3/*.md` are full examples.

```markdown
# App speed map - <app(s)> - <date>

| | |
|---|---|
| Scope | whole codebase / app / module |
| Versions | Next x.y, React, TanStack Query x.y, auth library x.y, OpenNext / host |
| Source | app-speed skill (references/*.md) |
| Status | mapping / awaiting decisions / planned |

## Stack and host
| Item | Today | Status | Recommendation |
|---|---|---|---|
| Framework / segment cache / PPR | | | |
| Host, placement per Worker and env (cloudflare.md s3) | | | |
| Worker size, route entries (page.tsx + route.ts) (s4) | | | |
| minify / splitChunks / manifest patch / serverExternalPackages (s4) | | | |
| What `worker.ts` answers before the framework (s1) | | | |
| Isolate headers on pages AND /api; Server-Timing on auth + read routes (s2) | | | |
| Existing measurements (date, build, valid?) | | | |

## Links and prefetch (navigation.md s1-s3)
| Item | Today | Status | Recommendation |
|---|---|---|---|
| Shared link component; `next/link` imports elsewhere (count); lint rule | | | |
| Intent prefetch: pointermove 100 ms, touch/focus, kind passed | | | |
| Every `router.prefetch(` and its kind; every FULL | | | |
| Sidebar: on sight / queue; home and its kind | | | |
| Click acknowledgement; `router.push` without a pending mark (verified by hand) | | | |

## In-page switches (navigation.md s4)
| Writer (file:line) | Control | Case a/b/c/d | Behaves as its case? | Recommendation |
|---|---|---|---|---|

## Caches (navigation.md s5)
| staleTimes | QueryClient defaults | Status |
|---|---|---|

## Pages, skeletons, layouts (navigation.md s6-s7)
| Item | Count / today | Status | Recommendation |
|---|---|---|---|
| page.tsx with / without loading.tsx | | | |
| Skeletons with the real static title (count, exceptions by hand) | | | |
| Routes falling through to a sibling's skeleton | | | |
| Each layout: what it awaits, for what | | | |
| Render-path writes | | | |
(Streaming per block and round trips: the `query-and-render-speed` skill's map.)

## Data layer (data-reads.md)
| Item | Today | Status | Recommendation |
|---|---|---|---|
| queryFns calling `'use server'` functions (count) | | | |
| Surfaces where 2+ action reads fire together (list) | | | |
| A GET read route? session check before reads? | | | |
| `'use server'` files: count, read-only, mixed, non-async exports | | | |
| Public actions reachable before sign-in / leaking data (SECURITY) | | | |

## Session and middleware (sign-in-out.md s1-s3)
| Item | Today | Status | Recommendation |
|---|---|---|---|
| Auth library, version, methods, plugins, hooks on sign-in/out | | | |
| Cookie cache config (files), framework-cookies plugin last | | | |
| Server session reader: memoised, cookie-first; direct calls (count) | | | |
| Client `useSession` / session fetches on every page | | | |
| Middleware: db calls, cookie writes + conditions, Sec-Fetch-Dest, /api signed out, redirect param | | | |
| Role-name gates (should be permissions) | | | |

## Sign-in (sign-in-out.md s4-s6, s8)
| Item | Today | Status | Recommendation |
|---|---|---|---|
| Shape: route or action, callbackURL, refresh after push, request chain | | | |
| Queries inside the POST; joins; role rules location | | | |
| Destination: browser or middleware 307s | | | |
| Landing: real shell + destination loading.tsx, or a panel/splash (+ floor ms) | | | |
| Sign-in page static (route table) with a real-form loading.tsx | | | |
| Hashing in the BUILT bundle; bcrypt writers | | | |

## Sign-out (sign-in-out.md s7)
| Item | Today | Status | Recommendation |
|---|---|---|---|
| Controls (count, file:line), shared hook? | | | |
| Request path; before the framework? dev twin? | | | |
| Waits (floors, goodbye screens) | | | |
| Where to: document load / push; refresh; caches emptied; bare URL | | | |
| Sign-in page prefetched before the click | | | |
| 401 counted as signed out; delete hooks | | | |

## Owner summary
### Already right (keep)
### Where the playbook does not fit, and why (questioned)
### Biggest gaps (ranked)
### Small, one sensible answer (will just do)
### Security, not speed - fix first
### Measurement status
### Questions (asked with the picker <date>) - answers recorded below
```

After the decisions, the plan (`app-speed-plan.md` or a Tasks section below the summary): waves 0 security +
tooling + baseline, 1 sign-in/out + middleware, 2 navigation + read route, 3 skeletons/layouts, 4 re-measure;
each task `- [ ]` with `Built:` notes, `Verified:` lines (what ran, what it printed), `[-]` with a reason for
anything dropped, and one typecheck line per wave.
