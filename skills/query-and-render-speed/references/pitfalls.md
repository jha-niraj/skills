# Pitfalls (each one happened) and reference numbers

## Pitfalls

| Pitfall | Effect | Fix | Rule |
|---|---|---|---|
| Expecting indexes to fix today's slow page | No change; the time is in round trips | Count round trips first; indexes are for growth | Q1, Q8 |
| `Promise.all` of many queries on Workers | 6-connection waves (55 queries = 10 waves) | `db.batch`, or fewer queries | Q3 |
| `db.transaction()` on neon-http | Throws | `db.batch` for reads; sequential idempotent writes guarded by a unique index | Q3 |
| A `cache()` const exported from `'use server'` | The production build fails (dev does not); the helper becomes a public endpoint | Lookups live in `server-only` modules | Q2 |
| Cached permission read after a permission write | Stale permissions | Uncached read in the recompute path | Q2 |
| Expecting `cache()` to share inside a Server Action | Each call reads again | It memoises only in a render; fine for reads | Q2 |
| Turning on an auth library's DB "joins" option without checking relation names | Every sign-in and session lookup threw in production | Test the exact adapter calls against the real schema first | - |
| Selecting a DB view through a join / `getTableColumns` | Empty rows | Name the view's columns | Q4 |
| Windowing an aggregate silently | Numbers change; alerts fire wrongly (118 of 162 flagged) | Record old vs new; ask; label the window | Q6 |
| Scoping after paging | Empty first pages for scoped users | Scope in the query | Q7 |
| Count and rows as two queries | Two round trips per list load | `count(*) over()` | Q5 |
| The page awaits every query | The slowest query holds the whole page | Header first, a boundary per block | S1 |
| One boundary around blocks of different speeds | The slow block holds the fast | One boundary per independent block | S1 |
| The header inside the component that suspends | The title waits for the rows | A screen component above the boundary | S2 |
| A fallback of a different size, or a second skeleton | Layout jumps; the two drift | Fallbacks are pieces of the loading.tsx skeleton | S3 |
| A grey bar for a title or tab row known from the URL | The header swaps on landing | Real text in the skeleton | S3 |
| Splitting one grid that needs all the data | Double reads, broken shared state | One boundary; start reads earlier | S4 |
| A shared read called in two blocks | A double fetch | One promise, passed down | L3 |
| A stored promise rejecting before it is read | "Unhandled rejection" | `.catch(() => {})` on the stored promise | L3, S6 |
| `notFound()` thrown inside a streamed block | A "not found" drawn with a 200 | Await the access check / record in page.tsx | L4 |
| `try { await prefetchQuery } catch { notFound() }` | Dead code: a missing record shows an error page | `fetchQuery` for the header's read | L1 C2 |
| `await qc.prefetchQuery` on a streamed page | Nothing streams | `void` it and dehydrate pending queries | L1 C2 |
| TanStack Query 5.101.0 | A second read after every streamed load (1-4.7 s cold) | 5.101.1 or later | L1 C2 |
| A read in `useEffect` | Arrives last, queued behind other actions | Start it on the server; pass a promise | L2 |
| A write inside a read | Runs on every hover prefetch | Filter on read; cron / write path / Set up step | L5 |
| A layout awaiting or starting page/sheet data | Holds the skeleton on every navigation; steals connections | Cached flags; reads move to the page or sheet | L6 |
| A sheet that waits for its data before opening | The click feels dead | Open at once with a skeleton; `enabled: open` | L7 |
| Reads through Server Actions on interaction | One-at-a-time queue (30 s on one page) | Fewer reads; a GET read route where they stack | L8 |
| Read-only queries carrying `'use server'` | Every query callable with a forged cookie | No directive; session checked at the read route | L8 |
| A subagent streaming a guarded page | Forbidden page rendered with 200 | Lead reviews risky changes (guards, 404s) | routine |
| Parallel agents rewriting the same record file "from my heading to the end" | Another section lost | Each inserts above a fixed marker | mapping s1 |
| Measuring the wrong build or a dev server | "After" numbers that show nothing | Confirm the build id; production build only | mapping s4 |

## Reference numbers (Gurukul)

**2026-10-14 pass** (sequential round trips on the critical path; one batch = 1):

| Page | Before | After | What changed |
|---|---|---|---|
| /lessonplan/health | about 210 (3 per scheme) | 1 | N+1 removed, one batch of 5 |
| /lessonplan/yearly-plan | about 140 (5 per class-subject) | 2 | two batches, sliced in memory |
| /staff/appraisals/[userId] | about 60 (1 per register) | about 1 | one batch; teaching record streams |
| /lessonplan/today | about 10 (up to 52 queries) | 3 | batched across periods; 4 streamed blocks |
| /finance | 5 deep, about 55 queries in 10 waves | 1 batch per block | months grouped in SQL; 7 streamed blocks |
| /examinations | about 6 (33 queries) | 1 per block | bounded to the academic year; 6 streamed blocks |
| /students | 3 (15 queries) | 2 | 9 counts to 1 FILTER; 12 columns instead of about 60 |
| every page | permissions 2 serial, settings 1-4, scope up to 4x3, profile up to 5 | 0 after the first, per request | React `cache` + the reused current user |

Streaming: 14 of 18 academics pages, 25 of 31 finance/management/settings pages, 6 of 8 home pages.

**2026-10-24 round 3:**

| Page / function | Before | After |
|---|---|---|
| /myclass/[section] | about 7 + 2 per subject (about 23 at 8) | about 7 whatever the subject count; header and tabs at once, blocks via `use()` |
| /schoolwebsite overview | 27 queries in 5 waves + 1 layout trip | 3 reads then one batch of 25; layout trip removed; 26 pages with the header above the boundary |
| admin `getDashboardStats` | 16 queries (3 waves) | one batch of 6 with FILTER counts |
| admin `getUserAnalytics` | 8 + a serial lookup | one batch of 5 |
| admin `whatsappusage/[schoolId]` | 11 serial trips | cached context + one batch |
| shishya-main home | 15 reads awaited together | 4 streamed blocks; shared reads cached; two helpers each one batch |
| /reports/* layout | 5 reads started on every navigation and prefetch | 0; read when the New report sheet opens |
| Reads that wrote | announcements, bank-transfer reap, Studio merge, 4 first-view seeds | filters + crons + explicit Set up steps |
