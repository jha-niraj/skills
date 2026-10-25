# Loading data properly (L1-L8)

How a page and its blocks get their data. Each rule: **What**, **Why**, **Map it**, **Fix**, **Example**.

---

## L1. The three block shapes

Pick by where the block renders and how it refetches. All three start the read on the server during the
render; they differ in who awaits it.

### Shape A - async server component, awaiting inside its boundary
```tsx
// page.tsx
export default async function Page() {
  await guardRoute(...);                       // the header's only dependency
  return (<>
    <PageHeader title="Finance" />             // above every boundary
    <Suspense fallback={<FinanceStatsSkeleton />}><FinanceStats /></Suspense>
    <Suspense fallback={<FinanceChartsSkeleton />}><FinanceCharts /></Suspense>
  </>);
}
async function FinanceStats() {
  const r = await getFinanceStats();           // awaited INSIDE the boundary
  return <FinanceStatsClient initialData={r} />;
}
```
Use for a section with many reads, or a server-rendered block. Good for a settings page whose 13 reads sit
behind one boundary while the header and section rail paint at once. To share a read between two server
blocks, start it once in `page.tsx` and pass the PROMISE (L3).

### Shape B - promise started in `page.tsx`, read with React 19 `use()` in a client block
```tsx
// page.tsx (server)
const detailP = getSectionDetail(cls, sec);     // started, NOT awaited
const chartsP = getSectionCharts(cls, sec);
if (!(await canSeeSection(cls, sec))) notFound(); // L4: the access check stays awaited
return <SectionClient detailP={detailP} chartsP={chartsP} />;

// section-client.tsx ('use client')
function Students({ p }: { p: Promise<ActionResult<SectionDetail>> }) {
  const r = use(p);                             // suspends this block only
  ...
}
<Suspense fallback={<StudentsTabSkeleton />}><Students p={detailP} /></Suspense>
```
Use when one client component holds state several blocks share (sheets, selection, prefill): the promise goes
to the client and small children unwrap it, each under its own boundary. Requires React 19 (`use` of a
server-passed promise). A block that later refetches seeds TanStack with the resolved value under the same key.

**Examples.** `apps/main/app/(main)/myclass/[section]/page.tsx` + `_components/section-client.tsx`;
`apps/main/app/(main)/(management)/meetings/page.tsx` (`parents` and `staff` promises, the open tab
`use()`s its own inside one Suspense with `MeetingsTabSkeleton`).

### Shape C - TanStack Query
Two variants; both are valid, pick ONE per codebase and stay consistent.

**C1. `initialData` seeding (hybrid).** The server block awaits the read (shape A or B) and renders the client
with `initialData` under the SAME query key, built by the SAME searchParams parser on server and client, so
the first client render does not refetch. Gurukul uses this in 189 files; it cannot hit the notFound trap below.
Throw in `queryFn` on `!success` so errors reach the error state.

**C2. `prefetchQuery` + `HydrationBoundary`, dehydrated PENDING.** Start the query in the page WITHOUT
awaiting (`void qc.prefetchQuery(...)`), and give the request-scoped QueryClient
`defaultOptions.dehydrate.shouldDehydrateQuery: q => defaultShouldDehydrateQuery(q) || q.state.status ===
'pending'`. The promise crosses the RSC boundary; the client's `HydrationBoundary` resumes it as the query's
first attempt; the block uses `useSuspenseQuery` under its Suspense. One fetch, nothing twice.
- **Version: TanStack Query 5.101.1 or later.** 5.101.0 hydrated an already-resolved stream with
  `dataUpdatedAt: 0`, so the first observer refetched on mount: a second read after every streamed load (1 to
  4.7 s on a cold isolate). Fixed upstream in TanStack PR 10610. After any upgrade: hard-load a streamed page
  with the Network panel open; there must be no read for a key the page already dehydrated.
- **`await qc.prefetchQuery` on a streamed page** means nothing streams: `void` it.
- **The notFound trap:** `prefetchQuery` swallows errors by design, so `try { await qc.prefetchQuery(...) }
  catch { notFound() }` is dead code (found on four pages in another codebase): a missing record rendered an
  error page. For the read the header or the 404 depends on, use `await qc.fetchQuery(...)`, which rethrows.

**Map it.** `grep -rn "prefetchQuery\|fetchQuery\|HydrationBoundary\|useSuspenseQuery\|initialData\|use("`
and count each. Mixed shapes are fine; a mix of C1 and C2 for the same key is not.
**Do not switch shapes for its own sake.** Gurukul kept C1 + B (no measurable gain from C2, and its trap
cannot occur); record such a decision as `differs - decision needed` and ask.

---

## L2. A read starts on the server, never in a `useEffect`

**What.** No data read in `useEffect` (or `useQuery` with no server seed) for anything the page shows on
load. Start it in the render: shape A, B or C.

**Why.** A widget that fetches after hydration arrives LAST: it waits for the JS bundle, hydration, then a
Server Action that queues behind every other action (L8). Gurukul's /home Pulse strip did; shishya-main and
admin fetched their notification bell count in a `useEffect` (moved to a promise started un-awaited in the
layout and read with `use()`).

**Map it.** `grep -rn "useEffect" -A6 | grep -n "action\|fetch(\|get[A-Z]"`; `useQuery` calls with no
`initialData` and no hydration on a page that has a server component above them.

**Fix.** Start the read in the nearest server component (page or layout, un-awaited when it is not the
header's) and pass the promise or seed. Reads that only exist after an interaction (a sheet, a search) stay on
the client: L7.

---

## L3. One read, one promise

**What.** Two blocks needing the same read get the SAME promise (or `.then` views of it); never call the read
twice. Inside one render, a React-cached helper (query-fixes Q2) also dedupes.

**Fix.** `const sheetsP = getMarkSheets(...)` once in `page.tsx`, passed to the stat band and the recent list.
If another await follows in the page, add `sheetsP.catch(() => {})` (a no-op handler on the stored promise) so
an early rejection is not reported unhandled; the blocks still receive it.

**Example.** Gurukul `/examinations/results`: stat band and recent mark sheets share one sheets promise.

---

## L4. Guards, access checks and the 404 stay awaited

**What.** `page.tsx` AWAITS: the auth guard, the permission/access check, route params, and the record the
header or `notFound()` depends on. Everything else starts without awaiting. Guards, params and the session do
not depend on each other: await them together (`Promise.all([requireSchool(), searchParams, hasPerm(...)])`).

**Why.** A `notFound()` or a redirect thrown from INSIDE a streamed block happens after the 200 status and the
shell were sent: the user sees a "not found" drawn mid-stream with a 200 (bad for crawlers, monitors and
caches). In Gurukul round 3 a subagent streamed `/myclass/[section]` that way; the lead caught it.

**Fix.** Await a cheap access check that reuses React-cached reads, so it costs nothing extra and the blocks
start no later (`canSeeSection` reads only what `who` and `mySections` already cache). The data functions also
re-check and return `failWith('notfound')`, so an action called directly is still safe.

**Map it.** Every dynamic-segment page: is `notFound()` called from an awaited, settled read? Any page that
passes data straight to the client without checking (Gurukul: `billing/bulkbill/[requestId]`)?

**Example.** `apps/main/app/(main)/myclass/[section]/page.tsx`; detail pages that await the record only and
stream the rest: `students/[id]`, `exams/[examId]`, `staff/appraisals/[userId]`.

---

## L5. Reads never write

**What.** A read path (a page render, a layout, a read action) never UPDATEs, INSERTs, DELETEs, sends, or
increments.

**Why.** A hover prefetch RENDERS the page: a write in a read runs when someone merely points at a link, and
can run several times per visit, with nobody looking. Gurukul round 3 found: announcement auto-publish inside
the read batch, bank-transfer sessions expired (reaped) inside two reads, a Studio pane that merged and deleted
additions on read, a timetable inserted on first view, lazy seed INSERTs on three settings pages.

**Map it.** In every function a page or layout calls, `grep -n "\.update(\|\.insert(\|\.delete(\|sendEmail\|
increment"`. List each with the page it runs on.

**Fix.**
- **Time-based state changes** (expiry, auto-publish): the read FILTERS as if the change had happened (a WHERE
  that treats an expired row as expired), and a scheduled job (cron / Workflow) does the write; the write path
  that acts on the row re-checks.
- **Merges and cleanups**: move to the write path that owns them (the editor's next save).
- **First-view seeding**: an explicit step - an empty state with a "Set up" button, or the setup wizard; or
  read-time defaults that are saved on the first real save.
- Idempotent, guarded, rare repairs may stay; record why.

**Example.** `apps/main/lib/billing/payment-session-expiry.ts`: `expiredManualSession(now)` for the cron's
UPDATE and `liveManualSession(now)` as the read-side twin; an hourly `payment-sessions-expire` job flips the
status; `verifyBankTransfer` rejects an expired one.

---

## L6. Layouts never await page data

**What.** A layout awaits only the session/guard it needs (from the request-cached, cookie-first reader) and
its own chrome reads, in parallel. It never awaits or even STARTS reads that belong to one page or one sheet.

**Why.** A layout sits ABOVE `loading.tsx`: whatever it awaits holds the skeleton on every navigation into the
segment (hidden only when the shell was prefetched). Reads it starts without awaiting still share the request's
6 connections with the page. Gurukul round 3: `/schoolwebsite/layout.tsx` paid one extra round trip on every
website navigation for a flag the cached current-user row already had; `/reports/layout.tsx` started 4 reads
plus a chained terms read for the New report sheet on every `/reports/*` navigation and prefetch.

**Map it.** Every `layout.tsx`: what it awaits, what it starts, in what order, round trips.

**Fix.** Take flags from the cached user/tenant row; move per-sheet reads into the sheet (L7); per-page reads
into the page.

---

## L7. A sheet that loads on open opens AT ONCE with a skeleton

**What.** A sheet, dialog or popover whose data is read when it opens renders immediately with a skeleton of
its form; the read starts on open (`useQuery({ queryKey, queryFn, enabled: open })`); actions that need the
data (Continue, Save) are disabled while loading; a failure shows an inline error line.

**Why.** Waiting for the data before opening makes the click feel dead ("will make the user experience very
odd" - the product owner, Gurukul 2026-10-24). Loading the data before anyone asks (in a layout, L6) costs every
navigation.

**Map it.** Sheets whose options come from props filled by a layout or page read used only by that sheet; and
handlers that `await` a read and only then `setOpen(true)`.

**Fix.** One action returning everything the sheet needs (independent reads together, dependent last), keyed
`['<module>', '<sheet>-options']`, `enabled: open`. The skeleton is shaped like the form. Seed the form's
defaults once when the data lands, unless the user already picked something.

**Example.** `apps/main/app/(main)/reports/_components/new-report-sheet.tsx` (`NewReportFormSkeleton`, the
error line) and `reports-layout-client.tsx` (`newReportOptionsKey`, `enabled: isOpen`);
`actions/reports/new-report-options.action.ts`.

---

## L8. Interaction reads do not queue behind Server Actions

**What.** Next runs Server Actions ONE AT A TIME per client (a router queue). Reads that fire on interaction
(a year switch, a tab, a sheet) wait behind each other and behind any save.

**Why.** Another codebase on this stack measured 30 s of queued panel reads on one page; Gurukul found 10-15
places where reads stack on interaction.

**Fix.** Keep client refetches few per screen (group a dashboard's reads into about three, S1). Where reads
stack, a GET read route (`/api/read/[name]`: a registry of read functions, session checked once before any
read) runs them in parallel; pilot it on the worst screens and widen only if it measurably wins (each route
costs bundle size on Workers). Remember every `'use server'` export is a public POST endpoint: a read-only
query module carries no `'use server'` unless a client imports it directly, and then it checks the session
itself.
