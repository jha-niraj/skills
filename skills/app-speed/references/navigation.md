# Navigation: links, prefetch, in-page switches, caches, skeletons, layouts

Each rule: **what**, **why** (measured where there is a number), **check** (what to grep or look for when
mapping), **fix**, **example** (Gurukul paths; find your equivalent).

## 0. How Next behaves (verify against the installed version)

A click feels instant when (1) the skeleton with the real title paints within ~100 ms, (2) the page fills in
block by block, (3) Back and prefetched pages cost nothing. Facts that decide the rules (Next 15.x):

- `<Link>` prefetches when visible, in production only. `next dev` disables prefetching: never judge
  prefetch behaviour there.
- A dynamic route (anything reading cookies/headers/searchParams - every signed-in page) is prefetched only
  down to its nearest `loading.tsx` (the SHELL). No `loading.tsx` above it = nothing prefetched.
- `router.prefetch(href)` with no kind is FULL (server render with data) in 15.5 without the segment cache.
  The segment-cache branch of `app-router-instance.js` defaults to AUTO and is easy to misread as the one in
  use. `PrefetchKind` imports from `next/dist/client/components/router-reducer/router-reducer-types` (the
  enum VALUE is needed, not just the type).
- The URL does not change until the new page's first bytes arrive (the skeleton travels in that response).
- Next REUSES an in-flight prefetch: a click during a FULL prefetch of that URL waits for it with the old
  page on screen and no skeleton (a full response has no loading boundary).
- One prefetch-cache entry per URL; a FULL prefetch replaces a cached shell.
- A prefetch RUNS page and layout code on the server with nobody visiting.
- `loading.tsx` shows only when you ARRIVE at a page; changing its search params shows none.
- Next strips `RSC` and `Next-Router-Prefetch` before the middleware runs; `Sec-Fetch-Dest` is the only
  signal there (document vs `empty`).

## 1. One shared link, prefetch on intent

- **What:** one link component; the framework's `Link` imported nowhere else. It renders `<Link
  prefetch={false}>` and does a SHELL prefetch (`router.prefetch(url, { kind: PrefetchKind.AUTO })`) on
  intent: a 100 ms timer started on the first `pointermove` inside the link (NOT `mouseenter`, which fires on
  whatever slides under a resting pointer after a click), cancelled on `pointerleave` and on click, immediate
  on `touchstart` and `focus`; once per URL; skips external, `#` and same-pathname links (those are in-page
  switches).
- **Why:** default `<Link>` prefetches every visible link; a 50-row table of links is 50 server renders, again
  on every filter change. Ayudocs: Bookings 9.7 s -> 0.43 s to ready, Leads 6.2 s -> 0.45 s; hidden renders when
  a list opens 5-8 -> 0. Z360: 9 prefetches on the start page with nobody touching it -> 0.
- **Check:** `grep -rn "from ['\"]next/link['\"]"` outside the shared component (target 0); the lint rule
  (`no-restricted-imports` with a message pointing at the shared link); list rows that are links; any other
  `router.prefetch(` call and whether it passes a kind.
- **Fix:** build or adopt the component; codemod imports; add the lint rule; delete any "on sight" mode.
- **Example:** `packages/ui/src/components/app-link.tsx` (`prefetchOn="intent"` only; `recordPrefetch` shared
  with the queue so it skips what a hover fetched); lint in `apps/main/eslint.config.js`.

## 2. The sidebar queue, and only the home in FULL

- **What:** every rail page's SHELL is in the router cache before any click, fetched by a queue: after first
  paint, from `requestIdleCallback` (2 s timeout, ~600 ms fallback), ONE href every 350 ms in rail order,
  skipping the page on screen and anything already prefetched; pauses while the tab is hidden; off under
  Save-Data; restarts (skipping done ones) when the list changes. The workspace HOME goes first and FULL;
  everything else AUTO. Links stay on intent, so a hover still fetches at once.
- **Why:** on sight, a rail of twelve asked for twelve shells in one instant; on Workers simultaneous requests
  spread across isolates - most landed on fresh ones at 2.3-5.5 s, and a click soon after could land on one.
  Everything FULL was ~440 KB and fourteen server renders per sign-in, and on 3G a click on a page whose full
  fetch was in flight waited for it with no skeleton.
- **Never FULL on hover.** It looked perfect in a benchmark that rests 300 ms before clicking; on 3G every
  hovered click froze for ~2 s. One model, no branching by network.
- **Check:** how the rail's links prefetch (default `Link` = on sight); any `requestIdleCallback`; whether
  the home is prefetched and with which kind; every `PrefetchKind.FULL` (target: exactly one, the home). In the
  bench: "start page prefetch requests" should equal the queue (home + one per row), each shell a few kB.
- **Decide with the user:** which page is each workspace's home. If the home is a heavy client workbench,
  measure its full payload first - shell-only for the home is a reasonable answer.
- **Fix:** a `useStaggeredPrefetch(hrefs, { home })` hook in the shared package; each sidebar passes its rows
  in rail order (pins, then the open module's children, then the rest).
- **Example:** `packages/ui/src/components/use-staggered-prefetch.tsx`. A workspace switcher prefetches the
  other workspace's home SHELL on idle. A public navbar of static pages uses the same queue (a static page's
  shell IS the whole page; on OpenNext even static payloads are served by the Next bundle, so a cold click
  waited seconds).

## 3. Acknowledge the click

- **What:** the shared link reports every plain in-app click to a tiny module store; a 2 px bar at the top
  runs until the pathname or search changes (20 s safety timeout); the rail pulses the item it is waiting on.
  Programmatic navigations call `markNavPending(href)` before `router.push`.
- **Why:** on a cold isolate the URL does not change for a round trip; without feedback people click again.
- **Check:** a progress component mounted in each shell; `grep -rn "router.push("` and whether the line ABOVE
  marks pending. **Verify each finding by reading the lines around it** - a mapper quoting only the push line
  reported five false gaps in Gurukul.
- **Example:** `markNavPending` / `useNavPending` in `app-link.tsx`; `<NavProgress />` in the shell.

## 4. In-page switches (tabs, sections, filters, pagers, date controls)

- **What:** classify every URL writer:
  - **(a) data already in the browser** (all panels mounted, a filter on loaded rows):
    `window.history.replaceState(null, '', `${pathname}?${params}`)` and nothing else. Next keeps
    `useSearchParams()` in step. No request.
  - **(b) a client query keyed on the URL values:** the same history write (`pushState` if it should be a
    history entry); only the rows are fetched; `keepPreviousData` keeps the old rows (dimmed) until the new
    ones land. One shared parser builds the server's `initialData` key and the client key, so they cannot
    disagree.
  - **(c) only the server has the rows** (the page reads `searchParams` and awaits): keep the router but move
    the control at once and dim the list:
    ```ts
    const [isPending, startTransition] = useTransition();
    const [shown, setShown] = useOptimistic(valueFromServer);
    startTransition(() => { setShown(next); router.replace(url, { scroll: false }); });
    ```
    or move the read behind the GET read route (data-reads.md) and become (b).
  - **(d) a real navigation** (after create, to another path): leave it.
- **Why:** to the App Router a changed URL is a navigation that re-renders the whole page. Ayudocs settings:
  ten reads per section click -> no request. Gurukul `/deck`: `router.replace('/deck')` to clear one-shot
  params cost a second server render of the page on every arrival.
- **Check:** `grep -rn "router.replace(\|router.push("` with a query string or the current path; links to the
  current page with a different param; every `useSearchParams().get(`. Count `history.replaceState` /
  `keepPreviousData` to see whether a previous pass already converted most.
- **Keyed Suspense:** where a section genuinely re-renders on the server per param, `<Suspense
  key={params}>` around that section shows its fallback at once; never key a whole table.
- **Phone:** a long chip or section list becomes one dropdown in the header below the large breakpoint,
  reading and writing the same URL value.
- **Verify:** Network panel open - (a) no request; (b) one small request, old rows kept; (c) the control moved
  and the list dimmed before the response.

## 5. Cache times

- **What:** `experimental.staleTimes: { dynamic: 60, static: 180 }` (`dynamic` = visited pages, makes Back
  instant; `static` = prefetched shells' max age). Client QueryClient: `staleTime` > 0 (Ayudocs 30 s, Gurukul
  60 s), `gcTime` 5 min, `refetchOnWindowFocus: false`, `retry: 1`, one client per tab (`useState`). Live
  queries opt in to `staleTime: 0`. Mutations invalidate (`invalidateQueries`, `revalidatePath`,
  `router.refresh()`), never hand-splice.
- **Why:** with `staleTime: 0` hydrated `initialData` refetches on mount: every page load reads twice.
- **Check:** `next.config.*` for `staleTimes`; the QueryClient provider's defaults; per-query overrides.
- **Note (TanStack server hydration):** if the codebase streams with `prefetchQuery` + pending dehydrate, it
  needs TanStack Query 5.101.1+ (5.101.0 refetched every streamed query after hydration). See the
  `query-and-render-speed` skill.

## 6. A skeleton per route, with the real title

- **What:** a `loading.tsx` in every routed section, drawn to the page's real layout (same grid, header, table
  frame), rendering the page's REAL static header (title, description, static tabs) and greying only data (a
  count, a name). The body is an exported skeleton component the page's own Suspense fallback reuses, so the
  two cannot drift. A detail page whose title IS data keeps a grey title.
- **Why:** no `loading.tsx` = nothing to prefetch and the click waits for the full render; a grey bar where a
  static title goes makes the header visibly swap on landing.
- **Check:** list every `page.tsx` with its `loading.tsx` (Gurukul: 266 of 272); grep skeletons for
  `titleWidth=` or a bare title `<Skeleton>`; a static value in the URL (a class label `6-A`) shown grey is a
  gap; a route falling through to a SIBLING's skeleton (Gurukul `/posts/[id]` flashed the posts list skeleton
  until it got its own route group) is a gap.
- **Fix:** add the file; render the shared header with the real title; for nested routes that should not
  inherit a list skeleton, split the list into a route group `(list)/` so the detail gets its own.
- **Editing a layout desyncs its skeleton silently:** after any layout edit, diff the classes of the page and
  its skeleton, including breakpoints of height bounds.

## 7. Layouts never await page data; reads never write

- **What:** a layout sits ABOVE `loading.tsx`, so everything it awaits blocks the skeleton on every
  navigation under it (and on a shell prefetch). It awaits only the guard (session from the memoised
  cookie-first reader, one cached user row) and starts the rest unawaited / in parallel. Data only one sheet or
  dialog needs is loaded when that sheet opens - and **the sheet opens AT ONCE with its skeleton**, never after
  the data (Niraj, Gurukul: waiting first "will make the user experience very odd").
- **Why:** Gurukul `/reports/layout.tsx` started five reads for a "New report" sheet on every `/reports/*`
  navigation and prefetch; `/schoolwebsite/layout.tsx` re-read a flag the cached user row already had (+1 round
  trip on every website click).
- **Public pages are static:** nothing in the root or a public layout reads `headers()`, `cookies()` or the
  session; per-visitor bits ("Go to dashboard") are read in the browser. Check the build's route table
  (static vs dynamic).
- **No side effects in a render path:** a prefetch runs it on hover. Gurukul moved out: an auto-publish in a
  list read (an hourly cron publishes instead), a payment-session expiry write in three reads (reads filter;
  a cron writes), default rows created on first read (an empty state with a "Set up" button). Writes, emails,
  counters belong in an action, a cron or an explicit step.
- **Check:** for each `layout.tsx`, list its awaits and what each is for; grep render paths (`page.tsx`,
  server components, functions they call) for inserts/updates/emails.

## 8. Verify (navigation)

Start page makes no FULL prefetch except the home; queued requests carry the prefetch header and are a few kB;
on Chrome's 3G profile every rail click paints its skeleton at once; same-page switches make the requests their
case says; the bench's "shown" is ~100-200 ms cold for every page.
