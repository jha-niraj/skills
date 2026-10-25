# Query fixes (Q1-Q9)

Each rule: **What**, **Why** (measured), **Map it** (how to find it in an unknown codebase), **Fix**,
**Example** (Gurukul paths; find your equivalent). Rank the fixes by payoff in this order: repeated lookups
(Q2, one fix speeds most pages), N+1 (Q4), serial independent reads (Q3), over-fetch and JS aggregation
(Q5-Q6), then streaming (references/streaming.md).

---

## Q1. Count round trips, not query time

**What.** A page's server time is the longest chain of SEQUENTIAL round trips on its critical path, plus the
slowest single query, plus how long the page waits before showing anything. A `db.batch` or one SQL
statement counts as ONE round trip however many statements it carries.

**Why.** On an HTTP driver (Neon serverless over fetch, Supabase REST, PlanetScale HTTP) each query is its own
HTTPS request: 5-30 ms even with the server placed next to the database. In Gurukul `EXPLAIN ANALYZE` showed
every hot read under 1.1 ms inside Postgres; the request around it cost 10-100 times more. A Worker opens at
most 6 outgoing connections at once per request, so `Promise.all` of N queries costs ceil(N/6) waves: /finance
fired about 55 "parallel" queries and paid 10 waves.

**Map it.** For each page follow `page.tsx` AND every layout above it into the actions and lib functions it
calls, transitively. Write down: depth (serial round trips), total queries, waves (ceil(parallel/6) per
`Promise.all`), N+1 loops with their loop size. Method and ranking in references/mapping.md s2.

**Fix.** Q2-Q7. Placement first: if the server runs far from the database (no Smart Placement / region pin),
every number above is 5-10 times worse; pin placement before anything else and say so.

**Example.** Gurukul 2026-10-14 worst 25 ranged from about 210 serial round trips (`/lessonplan/health`, 3 per
scheme of work) down to 3; after the pass the worst was 3.

---

## Q2. Cache per-request shared lookups with React `cache()`

**What.** A lookup that several helpers read in one request (tenant/school settings row, current user,
permissions, the user's profile, an access scope, a billing or credit key, the academic year) is wrapped in
React `cache()` in a **`server-only` module**, keyed on primitives (strings, numbers), so one render reads it
once.

**Why.** Gurukul read the settings row up to 4 times per page (/finance), permissions cost 2 serial round trips
on every guarded page, the teacher profile 4-5 times on /lessonplan/today, the exam scope 3x2 on exam pages.
After caching: 0 round trips after the first read, per request, on every page.

**Map it.** `grep -rn "from(schoolSettings)\|getCurrentUser\|resolvePermissions\|getProfile"` (your names):
count call sites and how many run per page. `grep -rn "cache(" --include=*.ts` to see what is cached already.
A helper that takes an object argument cannot be cached usefully (keys compare by identity): key on ids.

**Fix.**
- `import 'server-only'; import { cache } from 'react'; export const getTenantSettings = cache(async
  (tenantId: string) => ...)`. Keep the signature the callers already use.
- **Never EXPORT a cached const from a `'use server'` file.** Such a file may export only async functions (an
  exported `cache()` const broke Gurukul's admin and student PRODUCTION builds; dev did not catch it), and
  every export is a public POST endpoint. A non-exported cached helper inside a `'use server'` file is
  legal (Gurukul `actions/myclass/myclass.action.ts` `who`, `mySections`) but a `server-only` lib is cleaner.
- If the cached current-user query already joins the role and its permissions, let the permission resolver
  REUSE that row for the current user (zero queries) and keep the database path for other users. Keep the
  permission rules byte-for-byte (an empty assigned role grants nothing, only no role inherits the baseline, a
  deactivated role grants nothing, the superuser bypass) and prove them.
- A recompute right after a permission WRITE reads uncached.
- `cache()` memoises only inside a render. In a Server Action or route handler it is a passthrough: fine for
  reads (and it is why a write is never answered from a stale cached read), but expect no sharing there
  (Gurukul `apps/shishya-main/lib/home/home-data.server.ts` comment: the client refetch reads each block's own).

**Example.** Gurukul `apps/main/lib/school/settings.ts` (`getSchoolSettings(schoolId)`, plain policy columns
only, no secrets or jsonb); `lib/current-user.ts`; `actions/myclass/myclass.action.ts` `who` and `mySections`
(the detail and charts reads of `/myclass/[section]` share the person, scope and sections).

---

## Q3. Batch independent reads into one request

**What.** Three or more independent READS go in one `db.batch([q1, q2, q3])`; two can stay a `Promise.all`.
Dependent reads stay serial; writes keep their existing pattern.

**Why.** drizzle on neon-http sends a batch as ONE HTTPS request (a non-interactive transaction), typed per
item, and it accepts select builders. That is one round trip and no 6-connection waves. Gurukul admin
`getDashboardStats`: 16 parallel queries (3 waves) to one batch of 6 statements. The website overview: 27
queries in 5 waves to 3 reads then 25 in one batch.

**Map it.** `grep -rn "Promise.all" actions lib` and read each; count queries per `Promise.all` (over 6 =
waves). Also find `await a(); await b();` where `b` does not use `a`'s result, inside helpers as much as pages.
Check the driver: `grep -rn "drizzle-orm/neon-http\|neon(" packages/db`.

**Fix.**
- Check your drizzle version has `batch` on your driver (neon-http, libsql, D1 do; node-postgres does not).
- `db.transaction()` THROWS on neon-http; `batch` is the supported multi-statement path.
- `inArray(col, [])` compiles to `false` in drizzle 0.45, so a batch item never needs an empty-list skip
  (check your version once).
- Other drivers: one SQL statement with CTEs, or a few statements over a pooled connection.

**Example.** `apps/admin/actions/platform.action.ts` `getDashboardStats`; `apps/shishya-main/lib/home/
home-data.server.ts` (`readWeek`: seven independent reads in one batch).

---

## Q4. Kill N+1 loops: set-based reads

**What.** No query inside `.map`, `for` or `Promise.all(rows.map(...))`. Read every parent's children in one
`inArray` query (or one batch of a few set-based queries), then group or slice in memory with the SAME filters
the per-item query used.

**Why.** Gurukul: 3 serial queries per scheme of work (about 210 round trips on one page), 5 per class-subject
pair (about 140), one per weekly register (about 60). Round 3: `/myclass/[section]` ran
`for (const sub of me.subjects) await Promise.all([sectionMastery, sectionPractice])` with practice 2 serial:
depth about 7 + 2 per subject, about 23 at 8 subjects. After: about 7 whatever the subject count.

**Map it.** `grep -rnE "for \(const .* of .*\)|\.map\(async" actions lib` and look for an `await db` or an
action call inside. Note the loop's real size from the data (subjects per class, rows per page).

**Fix.** Collect the keys (`ids`, `names`), one query with `inArray`, a `Map` keyed for lookup. When the old
query matched case-insensitively (`lower(a) = lower(b)`), the set version groups by `lower(...)`. **A database
view selected as a nested field or through `getTableColumns` with a join can return nothing: name the view's
columns explicitly** (the equality check caught exactly this in Gurukul).

**Example.** `apps/main/lib/myclass/progress.ts` `sectionPracticeAndMastery()`: one `db.batch` of three
set-based queries for all subjects; `actions/myclass/myclass.action.ts` `getSectionDetail` starts every read
at once and waits for the roster only where it must.

---

## Q5. Count once: `count(*) over()` and `count(*) FILTER`

**What.** A paged list and its total in ONE statement: `count(*) over()` beside the rows (computed before
`LIMIT`/`OFFSET`). A fan-out of counts over one table is one row of `count(*) FILTER (WHERE ...)`. Single
counts from several tables can be scalar subqueries on one row.

**Why.** Gurukul `/students`: 9 separate `count()` queries (2 waves) to one FILTER query. Ayudocs' leads list:
two round trips per load to one. Caveat: a page past the end returns no rows and so no count; handle it (fetch
the last page, or a count-only fallback for that case).

**Map it.** `grep -rn "count()" actions lib` and look for several in one function or one `Promise.all`; any
list action that runs a separate count query.

**Fix.** drizzle: ``sql<number>`count(*) filter (where ${eq(t.isActive, true)})`.mapWith(Number)``;
``sql<number>`count(*) over()`.mapWith(Number)`` in the list select.

**Example.** `apps/admin/actions/platform.action.ts` `getDashboardStats` (FILTERed counts per table, four
single counts as scalar subqueries on one row).

---

## Q6. Select less, aggregate in SQL, bound the window

**What.** Select only the columns the page renders (especially past jsonb). Sum and group in SQL (`GROUP BY`
month over the range), never N period queries or loading rows to sum in JS. Every unbounded "all time"
analytic gets a window the page names ("this academic year").

**Why.** Gurukul `getSavedLessonPlans` returned 300 full rows of 42 columns (jsonb) for 7 rendered fields; to
15 columns. /finance computed 12 months as 24 queries. Exam analytics read every mark sheet ever.

**Map it.** `select()` with no field list on wide tables; `.reduce(` over query results; loops over months or
periods; analytics with no date filter.

**Fix.** Bounding CHANGES the numbers: record old vs new, check what consumes them, and **ask the user** about
any figure that moves. Gurukul's at-risk list fed a notify-parents action: bounding it naively flagged 118 of
162 students; the fix counted the signal only where the student's class had results this year. Numbers shown
to a user carry a window anyway; zero for the window is the answer, never widen it.

---

## Q7. Scope inside the query, before paging

**What.** Access scoping (a teacher sees their classes) is a WHERE in the query, before `LIMIT`/`OFFSET`.

**Why.** Gurukul `getMarkSheets` fetched 1000 and scoped after paging: scoped users got empty first pages.

**Map it.** `.filter(` applied to a query result that was already limited; scope helpers called after the read.

---

## Q8. Indexes, only where they matter

**What.** Map the hot query SHAPES (table, WHERE, ORDER BY, JOIN) against existing indexes, including indexes
created by raw migration scripts; add only the ones a hot shape lacks. They are for growth.

**Why.** At small sizes Postgres correctly prefers a sequential scan; an index changed nothing on Gurukul's
seeded school (every hot read under 1.1 ms). Expecting indexes to fix today's page wastes the pass.

**Map it.** The 30 hottest shapes from the page map; existing indexes from the schema files AND
`grep -rn "CREATE INDEX" scripts migrations`. Typical gaps: an FK used in joins with no index (Postgres does
not index FKs), a composite whose middle column the query skips, a sort column missing from the composite, a
status filter that wants a PARTIAL index (used only when the query's WHERE implies the index's).
`EXPLAIN (ANALYZE, BUFFERS)` on READ queries only, scoped to one tenant, with the user's permission (it
executes the SELECT). Record execution time, plan, row counts.

**Fix.** An additive, idempotent `CREATE INDEX CONCURRENTLY IF NOT EXISTS` script (cannot run inside a
transaction, which suits HTTP drivers), the same index declared in the ORM schema, and the USER runs it. Drops
go in a separate script that refuses to run before their replacements exist. Re-run EXPLAIN after. Never run
an ORM schema push or generate on a schema with unrelated drift.

---

## Q9. Prove every rewrite returns the same thing

**What.** For every rewritten read, a temporary read-only script runs the OLD and NEW implementation against
the dev database for a real tenant and compares JSON across a spread of cases (default view, each filter, a
sort, page 2, a page past the end, a scoped user, an empty tenant). Print counts and SAME/DIFF, never personal
data. Delete the script after.

**Why.** Gurukul: 512 values SAME on the lesson-plan pages, ALL IDENTICAL on finance and exams, and the checks
caught 3 real bugs before they shipped (a view selected through a join, a subquery matching the wrong table, a
missing column).

**Map it.** n/a - this is the verification step; it goes in each task's `Verified:` line.
