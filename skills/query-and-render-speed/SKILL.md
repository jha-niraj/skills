---
name: query-and-render-speed
description: Make server-rendered pages fast by cutting sequential database round trips (N+1 loops, repeated lookups, independent reads in series, 6-connection waves), batching reads, adding only the indexes that matter, and streaming each independent page block behind its own Suspense boundary with the header painted at once. Covers how a page should load its data (async server blocks, promises read with React 19 use(), TanStack initialData or pending-dehydrate hydration), reads that never write, layouts that never wait for page data, and sheets that open at once with a skeleton. Use when pages in a Next.js App Router app on Cloudflare Workers or any serverless host talking to a remote Postgres (Neon over HTTP, Supabase, PlanetScale-style drivers) are slow to load or show nothing until everything arrives; when the user says "this page is slow", "speed up the server render", "too many queries", "N+1", "add Suspense boundaries", "stream this page", "the title waits for the data", "/query-and-render-speed".
---

# Query and render speed

This skill makes a page's SERVER render fast: what happens between the request arriving and the HTML or RSC
leaving, and how that output streams in pieces. It is the source of truth for this playbook (earlier copies
in handoff docs are older). Companions: a navigation-speed playbook (links, prefetch, in-page switches) and a
fast-sign-in playbook (the session path), if the user has them.

Written from the Gurukul codebase (a pnpm/Turborepo school-management monorepo: Next.js 15 App Router on
Cloudflare Workers via OpenNext, Neon Postgres through drizzle `neon-http`, TanStack Query 5, better-auth).
Two passes: 2026-10-14 (213 pages audited from the code, the worst 25 fixed, about 45 streamed, every rewrite
proven to return identical results) and 2026-10-24 (round 3: the remaining serial chains, the header-inside-
the-client pages, reads that wrote, sheets that waited). Gurukul names and paths are WORKED EXAMPLES: find your
codebase's equivalent; if there is none, build it first (in the shared UI or db package in a monorepo).

## How to treat this playbook

Every rule was decided on a measurement or proven with an old-vs-new equality check on a real database.
**Believe it by default.** Do not re-derive it or soften it into a suggestion. The one question to ask of each
rule is whether it APPLIES here; if it does, apply it as written; if you think it is wrong here, say so with a
measurement and ask before deviating.

**When the stack differs, adapt or skip, and say which:**
- **Not on Workers** (Vercel, Node server, containers): the 6-connection wave limit is Cloudflare's; drop the
  wave arithmetic but keep counting the sequential chain. With a pooled TCP driver (postgres.js, pg) a round
  trip is cheaper (1-5 ms), so serial chains matter less but N+1 still dominates.
- **Not drizzle `neon-http`**: `db.batch` is drizzle's API on neon-http, libsql and D1. Elsewhere use one SQL
  statement with CTEs, a real transaction on a pooled driver, or `Promise.all` of a few. Check the driver.
- **No TanStack Query**: shapes A and B (references/loading-data.md) need nothing else; skip shape C.
- **Pages Router**: no RSC streaming. Keep the query rules; replace streaming with fewer, batched reads in
  `getServerSideProps`, or client reads for slow side panels. Say streaming is out of scope.
- **React 18**: no `use()` in client components for promises from the server; use shape A or C.
- **No monorepo**: skeletons and helpers live in the app's own `components/` and `lib/`.

## When this skill loads: the routine

1. **Ask first** with the AskUserQuestion picker, recommendation first marked `(Recommended)`:
   "Map the codebase first?" - whole codebase (Recommended for a first run) / one app / one page or module /
   skip, I know the gap. In the same call, only if they change the work: "May I run `EXPLAIN (ANALYZE,
   BUFFERS)` on READ queries against the database?" (say whether it is production) and "Is there a database
   with real-shaped data for equality checks?". Never ask what the code can answer.
2. **Map, read-only.** Find the plan/docs folder (`plan/`, `docs/`, else create `docs/query-and-render-speed/`).
   Write `<that folder>/query-and-render-speed-map.md` from the template in `references/mapping.md`. For a
   large codebase split it across parallel read-only subagents, one area each, each writing its own section
   file (never rewriting another's), then merge. Every row: the rule (reference + section), what the code does
   today with file:line and counts, status `ok` / `gap` / `differs - decision needed`, a one-line
   recommendation. Rank pages by the method in `references/mapping.md` s2. Change NO code while mapping.
3. **Question the playbook, then ask.** Summarise what is already right, where this codebase reasonably
   differs and why, and the biggest gaps, with their numbers (say the cost model of s1 below early). Ask every
   real decision with the picker (max 4 per call, 2-4 options, recommendation first, a one-line reason each).
   The standard questions are in `references/mapping.md` s5. Small fixes with one sensible answer are just
   done: list them, do not ask.
4. **Plan file before code:** `<plan folder>/query-and-render-speed-plan.md`: decisions recorded, waves of
   tasks `- [ ]`, each ticked only with a `Verified:` line (what was run, what it printed). Never delete a
   task; out of scope = `[-]` with the reason. Order: shared lookups, worst pages, streaming, indexes.
5. **Build in waves.** Parallel subagents only on non-overlapping files. Subagents do not run typecheck or
   builds; the lead runs ONE typecheck per wave and reviews each report (subagents make confident mistakes:
   in Gurukul one streamed `/myclass/[section]` so a forbidden class rendered "not found" with a 200 instead
   of a 404). Never push or deploy; commit only as the project's rules say, asking with the picker.
6. **Verify and measure** (`references/mapping.md` s4): an old-vs-new equality script per rewritten read,
   the round-trip count before and after, the browser benchmark after the user deploys. Record numbers; say
   plainly what was not verified.

**Safety:** never write to a production database; `EXPLAIN ANALYZE` only on reads and only with permission (it
executes the query); never put a password, token or cookie in a file, command or message - credentials only
from env vars the user sets; never measure on a dev server; index scripts are written for the USER to run.

## 1. The finding that decides everything

**With the server next to the database, query TIME is almost never the problem. ROUND TRIPS are.**
- On an HTTP driver every query is its own HTTPS request: 5-30 ms even next to the database. In Gurukul every
  hot read finished in **under 1.1 ms** inside Postgres (payments 1,350 rows, bills 1,562, attendance 25,443).
- A page's server time is about **the longest chain of SEQUENTIAL round trips** on its critical path, plus
  the slowest single query, plus how long the page waits before showing anything.
- **A Worker opens at most 6 outgoing connections at once per request.** `Promise.all` of N queries runs in
  about ceil(N/6) waves: a page firing 55 queries "in parallel" paid 10 waves.
- Indexes help as data GROWS. At small sizes Postgres correctly prefers a sequential scan.

## 2. The rules (one line each; the detail is in the references)

Load the reference for the rule you are mapping or fixing. Each rule there says: what, why (measured), how
to map it, the fix, and a worked example.

**Queries - `references/query-fixes.md`**
| # | Rule |
|---|---|
| Q1 | Count round trips, not query time; rank pages by the sequential chain and the waves. |
| Q2 | A lookup used by several helpers in one request (tenant settings, user, permissions, profile, scope) is wrapped in React `cache()` in a `server-only` module. Never export a cached const from `'use server'`. |
| Q3 | 3+ independent reads go in ONE `db.batch([...])` (neon-http: one HTTPS request); `db.transaction()` THROWS there. |
| Q4 | No query inside a loop: read all children with one `inArray`, group in memory with the same filters. |
| Q5 | A list and its total in one statement: `count(*) over()`. A fan-out of counts is one `count(*) FILTER (WHERE ...)`. |
| Q6 | Select only rendered columns; aggregate in SQL; every unbounded aggregate gets a named window (ask first). |
| Q7 | Scope access INSIDE the query, before `LIMIT`/`OFFSET`. |
| Q8 | Indexes only for the hot shapes that need them, checked with EXPLAIN on reads, with permission; the user runs the script. |
| Q9 | Every rewritten read is proven to return the same JSON as the old one. |

**Streaming - `references/streaming.md`**
| # | Rule |
|---|---|
| S1 | One Suspense boundary per INDEPENDENT block; one boundary around blocks of different speeds lets the slowest hold all. |
| S2 | The header, title and tabs sit ABOVE every boundary; `page.tsx` awaits only what the header needs. |
| S3 | A boundary's fallback is the SAME skeleton component `loading.tsx` uses, at the block's exact size. |
| S4 | Do NOT split when one grid needs all the data, the header needs the data, or reads depend on each other; START the reads earlier instead. |
| S5 | A header figure that needs data gets its own tiny boundary (or a non-suspending read of the same key). |
| S6 | A failed block replaces only itself; say so in the report. |

**Loading data - `references/loading-data.md`**
| # | Rule |
|---|---|
| L1 | Three block shapes: (A) async server component awaiting inside its boundary; (B) promise started in `page.tsx`, read with `use()` in a client block; (C) TanStack `initialData` seeding, or `prefetchQuery` + `HydrationBoundary` with pending dehydrate. |
| L2 | A read starts on the server, never in a `useEffect`. |
| L3 | Two blocks needing one read share ONE promise; never call it twice. |
| L4 | Guards, access checks and the record behind `notFound()` stay AWAITED, so a missing or forbidden record is a real 404. |
| L5 | Reads never write: a hover prefetch renders the page, so a write in a read runs with nobody visiting. |
| L6 | Layouts never await page data: a layout sits above `loading.tsx` and blocks the skeleton. |
| L7 | A sheet or dialog that loads on open OPENS AT ONCE with a skeleton, then loads. |
| L8 | Reads that run on interaction do not queue behind Server Actions (they run one at a time). |

## 3. Worked examples in Gurukul (read them for the shape, then find yours)

| Example | Rules | Path (Gurukul repo) |
|---|---|---|
| Serial per-subject loop to one batch; cached shared reads; awaited access check; promises + `use()` | Q2 Q3 Q4 L1B L3 L4 | `apps/main/app/(main)/myclass/[section]/page.tsx`, `actions/myclass/myclass.action.ts`, `lib/myclass/progress.ts` |
| Header outside the boundary, data-dependent actions portalled into it | S2 S4 | `apps/main/app/(main)/schoolwebsite/_components/website-screen.tsx` |
| Only guards awaited; each tab's promise passed; open tab in its own Suspense | S1 S2 L1B | `apps/main/app/(main)/(management)/meetings/page.tsx` |
| Sheet opens at once with a skeleton; data on open | L6 L7 | `apps/main/app/(main)/reports/_components/new-report-sheet.tsx`, `reports-layout-client.tsx` |
| 15 home reads split into streamed blocks; shared reads cached | S1 Q2 Q3 | `apps/shishya-main/lib/home/home-data.server.ts` |
| 16 dashboard queries to one batch of 6 with FILTER counts | Q3 Q5 | `apps/admin/actions/platform.action.ts` (`getDashboardStats`) |
| Reads filter stale rows instead of reaping them | L5 | `apps/main/lib/billing/payment-session-expiry.ts` |

## 4. Before you say done

- The map file has one row per page changed or deliberately left, each with a status: `ok`, `fixed` (what
  changed, round trips before and after), `left` (a measured reason), or `open` (what blocks it).
- Every rewritten read has an equality result; every windowed figure has old vs new recorded and was asked.
- Streamed pages: header paints first, each fallback matches its block, `loading.tsx` shares the skeleton.
- One typecheck over the touched packages, clean. Lint and builds only if the project's rules allow you to.
- The report (`references/mapping.md` s6): before/after table, indexes written, pages streamed and pages kept
  as one boundary with why, behaviour changes, and what is still slow with a recommendation.
- Pitfalls that already happened are in `references/pitfalls.md`; scan it before declaring done.
