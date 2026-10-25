# Mapping, measuring, asking, reporting

## 1. What to map (read-only, file:line evidence, counts)

Split across parallel read-only subagents for a large codebase; each writes its own section file (or inserts
its section above a fixed `<!-- MAPPERS INSERT SECTIONS ABOVE THIS LINE -->` marker), never rewriting
another's.

1. **Stack facts:** framework versions (Next, React, TanStack Query - 5.101.0 is the double-read bug), host,
   driver (`neon-http`? `db.batch` available?), placement / region pin, drizzle version.
2. **The page ranking** (s2): every `page.tsx` under the authenticated area, with its layouts and the functions
   it calls, transitively.
3. **Repeated lookups:** settings, current user, permissions, profile, scope, keys - cached or not, call sites,
   reads per page (query-fixes Q2).
4. **N+1 loops and serial chains** inside helpers (Q3, Q4).
5. **Over-fetch and JS aggregation; unbounded analytics** (Q5, Q6); scoping after paging (Q7).
6. **Streaming shape per page:** classes A / B-C / D / E (streaming S1), headers inside waiting clients (S2),
   skeletons vs fallbacks and grey static titles (S3).
7. **Detail pages:** `notFound()` from an awaited read or not; awaits the record only, or everything (L4).
8. **Layouts:** what each awaits and starts, round trips (L6).
9. **Reads that write** (L5); **reads in `useEffect`** (L2); **sheets that wait to open** (L7).
10. **Indexes** against the 30 hottest shapes (Q8).
11. **Anything the user named alongside speed** gets its own section (Gurukul's 2026-10-14 request added a
    calendar/native-date audit).

## 2. How a page is ranked

From the code, no timer. For each page (teacher/non-admin view where permissions cost more):
- **Depth** = the longest chain of SERIAL round trips on the critical path: layouts + guard + page awaits +
  the serial steps inside each helper. One `db.batch` = 1. A cached lookup already read this request = 0.
  Note data-dependent loops with a variable: `about 7 + 2S (about 23 at S=8)`.
- **Queries (waves)** = total statements, and waves = sum over each `Promise.all` of ceil(N/6) on Workers.
- **Cause** = the file:line of the loop or chain.
- **Score = depth + waves.** Sort descending; the top 20-25 are the fix list. Cross-cutting helpers that
  appear on many pages are fixed first (one fix, many pages).

Model notes: a non-superuser's permission resolution may cost extra serial trips (Gurukul: 2) on every
guarded page until Q2 is done; count it as `P`.

## 3. The map template

Write `<plan folder>/query-and-render-speed-map.md`:

```markdown
# Query and render speed - map (<app>, <date>)

| | |
|---|---|
| **Status** | Mapping / Asked / Built / Measured |
| **Stack** | Next x, React x, TanStack x, driver x (batch: yes/no), host, placement |
| **Cost model** | 1 round trip ~ <n> ms here; 6 connections per request (Workers) |

## Rules vs this codebase
| Rule | Today (file:line, counts) | Status | Recommendation |
|---|---|---|---|
| Q2 cached lookups | settings read 4x on /finance (lib/x.ts:12, 39 call sites) | gap | one cached getSettings |
| S2 header above boundaries | 28 pages draw the title in the waiting client | gap | screen component |
| L1 shape | initialData in 189 files, use() in 33, no hydration | differs - decision needed | keep |

## Page ranking (worst first)
| # | Route | Depth | Queries (waves) | N+1 | Cause (file:line) | Streaming class | Status |
|---|---|---|---|---|---|---|---|
| 1 | /myclass/[section] | about 7 + 2S (23 at S=8) | 12 + 3S | per subject, serial | myclass.action.ts:171 | D | gap |

## Streaming
| Page | Awaits for the header | Blocks -> data -> fallback piece | One boundary kept because |

## Reads that write / layouts / sheets
| Where | What it does | Runs on | Status |

## Indexes
| Shape (table, where, order) | Existing index | Gap | Priority |

## Already right / differs and why / biggest gaps / questions
```

## 4. Measure

- **Round trips from the code** (s2), before and after, per changed page. This is the main number.
- **`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`** on the hottest READ queries only, scoped to one tenant, with the
  user's permission. Record execution time, plan, row counts. Expect sub-millisecond on small data: that
  result is the evidence for Q1.
- **Equality scripts** per rewrite (query-fixes Q9).
- **`Server-Timing`** on hot routes (database time and query count through the driver's fetch hook) answers
  "database or not" from the browser, if the codebase has or wants it.
- **The browser benchmark after deploy:** server render first byte and end of stream per page, cold and warm.
  Real numbers come from there, not from in-Worker timers (a Worker's clock does not advance during CPU work).
  Confirm the build id you are measuring. Never measure a dev server.

## 5. Questions to ask (AskUserQuestion, recommendation first, only what the map did not answer)

- **Scope:** (1) shared lookups, (2) the worst N pages, (3) streaming the 3+-read pages - all three in order
  (Recommended), or a subset? All apps or one?
- **Batching:** may independent reads use the driver's batch?
- **EXPLAIN ANALYZE** on read queries (say if the database is production)? One record file, plus a PDF?
- **Data-loading shape** if the codebase differs from the default (keep `initialData` + `use()` vs move to
  pending-dehydrate hydration): recommend keeping what works unless the map shows a bug.
- **Headers inside waiting clients:** move them to a screen component above the boundary?
- **Reads that write:** move each to a cron / write path / explicit Set up step?
- **Layout reads for a sheet:** move into the sheet, opening at once with a skeleton?
- **Indexes:** show exactly where each goes (table, schema file, script), THEN ask: all plus drops,
  high-priority only, adds only, or not now. The user runs them.
- **Any figure that changes** when an aggregate gets a window (and anything that sends alerts from it).
- **Commits** per the project's rules; never push or deploy.

## 6. Plan template and report

Plan (`<plan folder>/query-and-render-speed-plan.md`), waves:
1. The map (and the PDF if asked).
2. Shared lookups cached; cross-cutting helpers batched; count fan-outs to FILTER. Equality proven.
3. The worst N pages: N+1, serial chains, over-fetch, SQL aggregation, windows. Equality proven; old vs new
   recorded for every windowed figure.
4. Streaming on every 3+-read page; headers above boundaries; skeletons shared with loading.tsx.
5. Reads that write, layouts, sheets.
6. Indexes: scripts written, shown, approved; the user runs them; re-EXPLAIN.
7. One typecheck over the touched packages; the report; commits per the user's answer.
8. After deploy: the benchmark; stream further only where "server render end" is still long.

Report:
- Before/after table per changed page: sequential round trips, queries, what changed.
- Indexes added or written for the user to run, each with the query it serves.
- Streaming: pages streamed per area; pages kept as one boundary and why.
- Behaviour changes: windows, figures that moved, error isolation per block, reads that no longer write.
- Still slow and why, with a recommendation, not fixed in this pass: cold isolates loading a large server
  bundle; Server Actions queueing one at a time (a GET read route is the lever); database autosuspend
  wake-ups; unrun indexes.
