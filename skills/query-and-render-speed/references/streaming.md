# Streaming: several Suspense boundaries (S1-S6)

The single biggest change in how a page FEELS. A page that awaits every query before returning any JSX shows
its skeleton, then nothing new, then everything at once; on a cold isolate that is seconds of a blank body
under the title. A streamed page shows its real header and controls at once and fills each block in as its own
data arrives.

**What it buys, honestly:** on a warm isolate with fast queries it changes little you can time. It changes the
cold open and the slow block: the title, toolbar, tabs and every fast block are on screen while the slow part
loads. Streaming does not reduce round trips; do references/query-fixes.md first, then stream.

Each rule: **What**, **Why**, **Map it**, **Fix**, **Example**.

---

## S1. One boundary per independent block

**What.** Every independent block of data (a stat band, a table, a chart row, a side panel, alerts, recent
activity) streams into its OWN `<Suspense fallback={<ThatBlockSkeleton />}>` and starts its own read. One
boundary around blocks of different speeds lets the slowest hold the fastest.

**Why.** Gurukul 2026-10-14: 203 of 213 pages streamed a route skeleton, but NO page had more than one data
boundary, so /finance's analytics panel held its alerts and tables. After: /finance 7 streamed blocks,
/examinations 6, /home 29. Round 3 found about 152 of 240 pages still awaiting everything, 45 of them on 3+
reads.

**Map it.** For every `page.tsx`: count `<Suspense` in the page and its client; list the reads it awaits
(`await Promise.all([...])` of N) and which block uses each. Classify:
A = boundaries per block (ok); B/C = reads started un-awaited and passed down (ok); E = guard/params only (ok);
D = awaits every read, no boundary. D with 0-1 reads is fine (one block: awaiting it is the rule); D with 2
reads is mostly fine; **D with 3+ reads is the stream candidate list.**

**Fix.** Turn each block into one of the three shapes (references/loading-data.md L1). Keep the number of
Server Actions behind client refetches small (the browser runs them one at a time): Gurukul split
`getExaminationDashboard` into THREE reads (summary, insights, at-risk), not five, and invalidating the old key
prefix still matched all three.

**Example.** `apps/shishya-main/lib/home/home-data.server.ts`: one 15-read `getHomeData` became core / earn /
side / streak blocks, the greeting drawn at once, each block its own Suspense seeding `['home', <block>]`.

---

## S2. The header, title and tabs sit ABOVE every boundary

**What.** `page.tsx` awaits ONLY what the header needs (usually the guard, sometimes one record). The title,
description, tabs and toolbar render above every boundary. When a client component rendered the header and then
suspended on its query, move the header into a small "screen" component the page renders ABOVE the boundary;
state the header and body share (open tab, an add sheet both can open, a filter chip) lives in the screen and
reaches the body through a context.

**Why.** Round 3: all 28 `/schoolwebsite/*` pages and `/meetings` drew their title inside the client they
awaited, so the title waited for the whole `Promise.all`.

**Map it.** In each page's client, find where `<h1>` / the page header component is rendered; if it is inside
the component that receives awaited data, it waits. `grep -rn "PageHeader\|<h1" app/**/_components` and check
whether that file is the one fed by the await.

**Fix.**
- A screen component above the boundary with the real title and the tab row. Tabs that only switch a panel
  work before the data lands (write `?tab=` with `history.replaceState`); tabs that change the data are drawn
  but wait.
- Header actions that need data (Save, Add) are drawn as shimmers in the screen; when the body mounts it
  PORTALS its live actions into a slot in the header and claims it, removing the stand-ins. Same classes and
  same tab component on both sides, so the swap does not move a pixel.
- A default that depends on the data (which tab opens first) is derived from the data in BOTH halves rather
  than set in one and read in the other.

**Example.** `apps/main/app/(main)/schoolwebsite/_components/website-screen.tsx` (header with a portal slot;
`WebsitePage` portals tabs and Save/Add in); `apps/main/app/(main)/(management)/meetings/page.tsx` (guards
awaited, title and Parents/Staff tabs at once, each tab's data a promise, the open tab in its own Suspense).

---

## S3. The fallback is the same skeleton loading.tsx uses

**What.** Each boundary's fallback has the block's exact final size and shape, and it is an exported piece of
the page's skeleton file; `loading.tsx` is composed from the same pieces. The skeleton shows the REAL static
title (grey only for data: a count, a name, a date). A value that is in the URL (a class label `6-A`, a static
tab row) is real text in the skeleton, not a grey bar.

**Why.** Two skeletons drift silently: the layout jumps when data lands, or the route skeleton and the block
fallback disagree. Round 3 found `/myclass/[section]`'s skeleton greying the class label and the static tabs,
both known from the URL.

**Map it.** For each streamed page, compare the fallback components with what `loading.tsx` renders. Grep the
skeleton files for a grey bar where the title goes.

**Fix.** `section-skeleton.tsx` exports `SectionSkeleton` (for loading.tsx) built from `SectionMetaSkeleton`,
`SectionListSkeleton`, `StudentsTabSkeleton`... which the boundaries use. After ANY layout edit re-read the
block and its skeleton piece and diff classes (breakpoints of bounds included: `lg:h-...` vs `h-...`).
`StatBand` pairs with `StatBandSkeleton` at the same `count`/`cols` (Gurukul's band component; use yours).

**Example.** `apps/main/app/(main)/myclass/[section]/_components/section-skeleton.tsx` with `loading.tsx` and
`section-client.tsx`.

---

## S4. When NOT to split, and what to do instead

**What.** Keep ONE boundary when:
1. **One grid or one client needs all the data** - a list edited in place, a selection shared by two panes,
   tab counts or a default tab computed from several lists, a stat band derived from the same rows the table
   shows.
2. **The header needs the data** - a detail page's title is the record's name; the record is awaited (L4) and
   only the rest streams.
3. **The reads depend on each other** - read B needs A's result (the register's dates, the exam's terms).

**Why.** Forcing a split there duplicates reads, breaks shared client state, or adds a boundary that resolves
at the same instant as the other. Gurukul kept one boundary (with the reason recorded) on
`/examinations/evaluation` (every block derives from one read in shared client state), `/papers/questions`
(an edit moves a count, a retire lowers the total), `/curriculum/toc` (tab counts, default tab and both lists
from one list), internal assessment, mark sheets, seating plan, department pages.

**Instead: START the reads earlier.** The page cannot paint the block sooner, but it can stop waiting in series:
- start every read at the top of `page.tsx` without awaiting, then await them together;
- start the reads BEFORE the guard's await finishes when they do not depend on it (results are not returned
  until the guard has passed);
- fold a dependent pair into one query with a join or a batch (Gurukul `staff/documents/[userId]`: the school
  role folded into the member query, one round trip less);
- in a helper, start the independent parts at once and chain only the dependent part (`getSectionDetail`:
  `perStudentP = Promise.all([accessP, rosterP]).then(...)` beside the class-wide reads).
Gurukul round 3 "reads started earlier, no split": `reports/[id]/edit`, `reports/batch/[batchId]`,
`configure/teacherassignments`, `marksheets/[classSection]`.

**Record** every page kept as one boundary and why, in the map file.

---

## S5. A figure in the header that needs data

**What.** A count in the header ("26 leads", "N waiting") reads the SAME query key with a non-suspending
`useQuery`, or `use()`s the same promise inside a tiny `<Suspense fallback={<Skeleton />}>` of its own. The
header never waits; the number fills in.

**Example.** `/myclass/[section]` `section-client.tsx`: `meta={<Suspense fallback={<SectionMetaSkeleton />}>
<HeaderMeta p={detailP} /></Suspense>}`.

---

## S6. A failed block replaces only itself

**What.** With one boundary per block, a block that throws hits the nearest error boundary; give a block that
can fail its own small error boundary or an inline error state (from `!result.success`), so the rest of the
page stays usable. Say so in the report: it is a behaviour change.

**Watch.** A promise that rejects while it is not yet read: attach an empty `.catch(() => {})` to the stored
promise when another await follows in `page.tsx`, so it is not reported unhandled; the block still receives
the rejection.

---

## Verify a streamed page

- The header paints first; blocks fill in one by one (many users prefer to look themselves - ask before
  driving a browser).
- `curl -N` the page with a session cookie the USER sets as an env var: the header HTML arrives in the first
  chunk, the block HTML later in `<template>`/script chunks.
- On a hard load the Network panel shows ONE data request per block and none after hydration.
- After deploy, a benchmark's "server render end" drops toward "first byte".
