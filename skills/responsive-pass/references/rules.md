# Rules by area

Each rule: **what** to check, **why** (the defect it came from), **scan** (how to find candidates),
**fix**, and an example. Class names are Tailwind and Radix; the rule underneath is plain CSS. For
what a page, table, sheet or chart should CONTAIN, see the `page-layout` skill; this file covers how
those things behave as the width changes.

Gurukul names used as worked examples: `ScrollArea` (with `orientation` and `viewportClassName`
props) from `@repo/ui`, `StatBand` / `StatStrip`, `--gk-page-h`, `KanbanBoard`, `Sheet`. Find your
equivalent; if missing, build it in the shared UI package first.

---

## 1. Height and scrolling

### 1.1 Bound the page at every width, from one variable
- **What:** a full-height page (one list scrolling under fixed chrome) is
  `flex h-[var(--page-h)] flex-col overflow-hidden`; `shrink-0` header; `flex-1 min-h-0 min-w-0`
  body holding the ScrollArea. The variable is published once by the app shell.
- **Why:** unbounding a cramped list on a phone lets it grow to its full row count and puts the
  pagination thousands of pixels down. Fix a cramped list by making the chrome cheaper.
- **Never:** `h-screen`, `h-full` (Radix ScrollArea's `display:table` box breaks percentage heights,
  so `h-full` computes to auto), or a hand-rolled `calc(100vh - ...)` per page.
- **Scan:** `h-screen|min-h-screen|h-full` on page roots; `calc\([^)]*vh`; pages that have a
  `flex-1 min-h-0` ScrollArea but no bounded root.
- **Fix:** use the shell variable. Dashboards of stacked sections scroll normally; do not bound them.

### 1.2 `dvh` on mobile - including the shell's own box
- **What:** mobile bounds use `dvh`. `100vh` is the LARGE viewport, taller than the visible area
  while browser chrome shows, so the last rows and the pager sit under the URL bar.
- **Check the shell's box, not just the variable it publishes.** One shell documented why the
  variable used `dvh` and set its own root and `<main>` in `vh`. Another computed the variable itself
  as `calc(100vh - ...)`, which made every correct page wrong. Fix: `h-dvh lg:h-screen`.
- **Exceptions:** `svh` is often already right (a hero with `min-h-[100svh]` fits with chrome
  showing). A scroll-driven `sticky` section (`useScroll` / `scrollYProgress`) wants `vh`, because
  `dvh` moves mid-animation. A `vh` term beaten by a larger `min-h-[620px]` never decides anything.
  A `vh` on a `hidden lg:flex` element is desktop-only, where `vh == dvh`.
- **Scan:** `\[[0-9.]*vh\]` (NOT `\bvh\]`, which never matches `max-h-[42vh]`), `calc\([^)]*\bvh`,
  and `style=\{\{[^}]*vh` - inline styles hid five bounds through four passes. Exclude `[dsl]vh`.
- **Portaled content** (Radix sheets portal to `body`) cannot read a variable set on `<main>`; there
  a viewport unit is correct, and on a phone that unit is `dvh`.

### 1.3 Chrome above a bounded list is paid for in rows
- **What:** aim for 4-6 visible rows before the list's own scroller engages.
- **Why:** six stat cards at 2-up is ~200px of a ~536px phone bound; a `grid-cols-1` strip of four
  cards is ~400px. One day-book page had a 544px stat grid and 0px of panel.
- **Fix:** stat strip as one scrolling row (section 5); select rows share one line below `sm`
  (`grid grid-cols-3 gap-2 sm:contents`); charts shorter on phones (`h-[140px] lg:h-full`).

### 1.4 When the chrome cannot fit: relax the bound, cap the list
- **What:** title + action + stats + two charts + search + filter measured ~770px against a 536px
  bound - the list got negative space and neither showed rows nor scrolled.
- **Fix:** root `lg:h-[var(--page-h)] lg:overflow-hidden`; list ScrollArea
  `viewportClassName="max-h-[30rem] lg:max-h-none"` (30rem is 5-6 rows). Write a comment at the root
  with the measurement. Match the skeleton (section 7).

### 1.5 A `max-h` on a ScrollArea Root clips, it does not scroll
- **Why:** the Viewport, not the Root, is the scroller, and it sizes with `h-full`, which does not
  resolve against an auto-height parent. The Root clips at the cap; everything past it is
  unreachable with no scrollbar. Looks fine on a laptop where the cap is `lg:max-h-none`.
- **Scan:** `<ScrollArea` tags whose `className` contains `max-h-`. Walk the tag with a bracket
  depth counter (see scanning.md).
- **Fix:** move the cap to `viewportClassName`; padding, border and rounding stay on the Root.
  Found on 9 ScrollAreas in one module, 3 added by an earlier pass following an ambiguous rule.

### 1.6 Every growing list has a ceiling
- A list inside a stacked page (detail tab, panel, dashboard card) gets its own vertical ScrollArea
  with `viewportClassName="max-h-[...]"` (about 10 rows) from the start. Capping the row count alone
  is not enough - eight rows is still ~440px.
- **One scroll surface per region:** several capped siblings in a dashboard is the design; one
  capped main list inside a page scroller is a stale leftover from before the page was bounded -
  remove it.

### 1.7 Chrome that acts on a region stays reachable
- Tab strips, filter bars, select-all rows: `shrink-0` outside the ScrollArea, never scrolling away.
- A page-level Save for a long list is `sticky top-0 z-20` with an OPAQUE background (a 40-row
  roster is ~2,500px; Save had scrolled out of reach).
- Pagination sits outside the ScrollArea; its buttons are disabled, never hidden.
- Nothing is trapped in a nested scroller inside a short parent with no affordance.

### 1.8 Empty state in a bounded page fills the bound
- `flex items-center justify-center min-h-[...]`, not a short `py-16` block that leaves a large
  blank area reading as a failed render. Normal-flow pages keep a short empty state.

### 1.9 Fixed bottom chrome
- `padding-bottom: env(safe-area-inset-bottom)` (a `.safe-area-bottom` utility). In one repo the
  class was used everywhere and DEFINED nowhere - grep the CSS for the definition.
- Content clears the bar; the last row is never permanently hidden behind it.
- An emphasised bar action is a filled tile inside the bar, not a raised disc in a notch (built,
  misaligned at real sizes, removed). Icons on a filled control are one flat colour.

---

## 2. Horizontal overflow

### 2.1 The page never moves sideways at 360px
- Drag the page sideways. 1px of movement means a descendant is wider than the screen. Suspect a
  nowrap or `min-w-[...]` DESCENDANT before the page root; it is almost never the root.

### 2.2 The shrink-to-fit trap (Radix ScrollArea, any `display:table` wrapper)
- **What:** Radix wraps viewport children in `min-width:100%; display:table`. A table box is
  shrink-to-fit: it sizes to max-content, and a percentage width inside it constrains nothing. One
  nowrap descendant, or a chart's `ResponsiveContainer` with nothing to size against, widens the
  whole body; the viewport clips `overflow-x`, so the right side is cut off, not scrollable.
- **Symptom:** the page is not narrow, it is SHIFTED or "zoomed in" - a two-column grid shows column
  one clipped and column two nowhere.
- **Scan:** `<ScrollArea` that is `flex-1 min-h-0` inside a bounded column, with no `orientation`.
  67 such bodies across three apps had no pin.
- **Fix:** `<ScrollArea orientation="vertical" className="min-h-0 min-w-0 flex-1">`. Make the
  primitive apply `[&>div]:!block` itself when `orientation="vertical"` (equivalent to the
  hand-written `[&>[data-radix-scroll-area-viewport]>div]:!block`); do not write both.
- **Do not pin:** a scroller wrapping a `<table>` or `min-w-[...]` (it IS the table's horizontal
  scroller - 2 of 16 candidates in one module), or a pane holding something that cannot shrink (a
  print-size card preview, a fixed diagram, a canvas) - those need `both` or their own nested
  horizontal scroller. Copy the pattern: a wide table in its OWN horizontal ScrollArea, nested inside
  the pinned vertical body.
- **Shells first:** a missing pin in a route group's shell or a shared sidebar affects every screen.
- Sheet and panel bodies in a ScrollArea carry `min-w-0` too.

### 2.3 `truncate` and `flex-1` need `min-w-0`
- A flex or GRID item's `min-width` defaults to `auto` ("at least my content"), so `truncate` and
  `flex-1` do not shrink it - the row grows. Symptom: `GRADUATEI` (clipped by an ancestor, not
  ellipsised). A grid of twelve `w-44` month tiles in a grid item with no `min-w-0` made a 2202px
  panel and 11 unreachable buttons.
- `min-w-0` goes on the flex/grid ITEM and every flex/grid ancestor up to a bounded one. Column
  (`flex-col`) items do not need it for width.

### 2.4 `w-max`, `min-w-[...]`, `whitespace-nowrap`
- Every `w-max` needs a horizontal ScrollArea parent; `min-w-full` beside it only guarantees the
  strip is at least as wide as its parent, never that it fits. A 5-tab `TabsList`
  `flex w-max min-w-full` at ~500px hid three tabs on a phone.
- A `min-w-[...]` meant for a scroller has not escaped into normal flow.
- No `whitespace-nowrap` on long strings outside a scroller - chip strips, badge rows, breadcrumbs.

### 2.5 Chat and side panels: nothing scrolls sideways, ever
- Every card or row in an AI chat, a deck or a side panel: flex children `min-w-0`; cards in an
  `items-start` column `w-full max-w-full`; long single-line text `truncate` or wraps on purpose;
  ScrollAreas that scroll down only are `orientation="vertical"` (the default `both` lets content
  widen the box); wide tables in their own horizontal ScrollArea. One long card title put a sideways
  scrollbar under a whole chat.

---

## 3. Tables, lists, boards

- **Table strategy:** either the table sits in `<ScrollArea orientation="horizontal">` with a
  `min-w-[...]` inner element sized to the columns (4 cols ~480px, 7 ~780px), or non-essential
  columns hide below `md`. Both are valid; do not convert one into the other. Never `overflow-x-auto`.
- **Header/body parity:** hidden header and body cells come in matching pairs. Count them; a
  mismatch shifts every later cell into the wrong column and still renders.
- **Navigation dead end:** if the only link to the detail page was an ID cell hidden on mobile, the
  detail is unreachable. Put the link on the row's name.
- **Actions column** has a header (`sr-only` when icon-width) - check mapped header arrays too
  (`['Student', ..., '']`).
- **More than ~3 icon actions** collapse into a 3-dot menu below `sm`. A control that owns its own
  overlay (popover trigger, dialog) cannot simply be a menu item - use `asChild` +
  `onSelect={e => e.preventDefault()}` so its dialog survives, or leave it inline and say so.
- **Master-detail** (fixed rail beside `flex-1`) stacks below `lg`; on a phone the rail hides while a
  detail is open and the detail carries its own back control. Check `layout.tsx` and `*-layout-*`
  files - a split can live in a layout, invisible to a page scan.
- **Row budget by arithmetic:** sum the fixed content of a repeated row at 360px, then re-run it at
  the 44px floor. Six 32px chips + roll number + padding = 302px, leaving the name 58px; at 44px the
  name is negative, so the answer is a second line, not smaller chips. Write the sum in a comment.
- **Fixed-column grids** (a 7-column month) cannot lose columns; take padding back
  (`p-3 sm:p-5` took day cells from 36px to ~41px) and record where it landed.
- **Kanban:** one horizontal ScrollArea round the column strip with a `min-w` inner; each column its
  own vertical ScrollArea; the board bounded by its parent.

## 4. Headers, toolbars, action rows

- **Tabs on the right of the title row**, using the shared Tabs component, synced to `?tab=` with
  `history.replaceState` (never `router.push`/`replace` for a tab). On a phone the tabs become a
  compact Select showing the current tab (and counts), reading the same `?tab=`. Never a full-width
  underline strip under the header. Pages with many tabs that ARE the main navigation may keep a
  scrolling strip - ask.
- **Phone toolbar is one row:** search stays visible; every filter, segmented control, sort and
  export goes into ONE button - a "Filters (n)" right-side Sheet or a dropdown - with active-filter
  chips under the search. Large screens may show them inline. Use breakpoint classes, not a
  `useIsMobile()` hook, so server render and first paint agree.
- **A long chip set** (23 FAQ chips wrapping to two rows) is one dropdown button showing the current
  choice, searchable when long.
- **Header actions:** primary stays inline and labelled; secondaries go into one 3-dot menu below
  `sm` (`hidden sm:flex` inline + `sm:hidden` menu). `flex-wrap` is a deferral: it turns overflow
  into rows of chrome (a Select plus seven buttons became three rows).
- **Every fixed action row,** not just the header: a step footer with four labelled buttons
  (~600px on a 328px line) hid the only way forward behind `justify-between`. Below `sm`: secondaries
  share row one on short labels, the primary takes row two `w-full`.
- Icon-only buttons carry `aria-label`. Long labels shorten (`Save Changes` -> `Save`). Titles step
  down (`text-base sm:text-2xl`), padding steps down (`px-4 sm:px-6`). Optionally step the root rem
  down on phones, never below what keeps controls at 44px.
- **Header skeletons** match the real header's wrapper classes (`ml-auto flex flex-wrap ...`), and
  include the title-row tabs.

## 5. Stat summaries

- **One band, never a row of cards.** Use the shared component (Gurukul: `StatBand` with
  `{ icon, label, value, hint?, tone? }`; older `StatStrip`) - one scrolling row on a phone, the grid
  from `sm`. Hand-rolled `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` READS responsive and is the most
  expensive mobile layout; `grid-cols-1 ... sm:grid-cols-4` is worse; an unprefixed `sm:grid-cols-3`
  is three stacked tiles at 360px (~250px vs ~90px as a strip).
- Tiles in a flex row need a fixed width + `shrink-0`; shared `Card` tiles need `h-auto`.
- If the component hides labels on phones, use `sr-only sm:not-sr-only`, never `hidden`.
- **Exact numbers never truncate:** "NPR 12,345,678" clipped to "NPR 12,345..." is a different
  number. Step type down (`text-base sm:text-lg`) with `tabular-nums`; truncate the label.
- **Not stat strips:** grids of content cards (classes, posts, photos, seating charts), a 3-up of
  one-word-plus-figure tiles (~105px each fits), a hero row whose dividers depend on the grid.
  Require an unprefixed `grid-cols-N` AND label-plus-figure children before flagging. One "convert
  to strip" rule turned a photo gallery into a scroller.
- **Card primitive:** must not default to `h-full` or `justify-between` - nested in a stretched grid
  item, two cards claim 200% of the row and `justify-between` turns it into a visible hole. Pinned
  footers use `mt-auto`. Grids add `items-start` unless equal heights are wanted.

## 6. Sheets and dialogs

- **The strip:** on a phone a side sheet is ~90% wide so a sliver of page shows. Put `max-w-[90%]`
  in the Sheet variant, once. Consumers write `w-full sm:max-w-[...]`.
- **The override trap:** tailwind-merge is last-wins per property and modifier, so an UNPREFIXED
  `max-w-xl` replaces the variant's `max-w-[90%]` (no `!` needed). Defect = `w-full` PLUS an
  unprefixed `max-w-*` (or `!max-w`). Without `w-full`, `w-3/4` still leaves a strip. `sm:!max-w-lg`
  is fine. A `side="bottom"` full takeover is a screen, not a sheet - check `side`.
- `flex flex-col` SheetContent also needs `overflow-hidden`, or the variant's `overflow-y-auto` and
  the body ScrollArea are two scroll surfaces.
- **Footer pinned outside the body scroller,** `shrink-0`. Seven finance sheets had Save as the last
  child inside the scroller. With `type="submit"`, LIFT the `<form>` to wrap both scroller and
  footer - moving the buttons alone detaches them. Carry any `{x && ...}` guard with them.
- The shared `SheetFooter` is `flex-col-reverse sm:flex-row`; do not pass a bare `flex-row`.
- Count footer buttons in the worst-case state (Cancel + Back + Save + Next); secondaries go
  icon-only below `sm`.
- Form grids `grid-cols-1 sm:grid-cols-2`; `col-span-2` children become `sm:col-span-2`. Two short
  native inputs (time, time) may stay 2-up.
- Steppers: on a phone show the current step's label; check it is named somewhere at 360px (not only
  in a `hidden lg:block` rail).
- Circles, avatars and icons in a strip carry `shrink-0`. Every colour has a `dark:` pair, outline
  buttons included.
- Do not claim "tap the strip to close" for a sheet that blocks outside-dismiss.

## 7. Loading states

| What is loading | Use |
|---|---|
| A control's own action | Spinner inside the control |
| A region with a shape | Skeleton shaped like that region |
| A whole page / route transition | The app's full-page loader |

- A skeleton mirrors ONE surface; a generic one dropped in five tabs is wrong in four.
- Delete the spinner's centring wrapper with the spinner.
- Bound at the SAME breakpoint as the client (`lg:h-[...]` vs `h-[...]`), and carry the list's
  `max-h-[30rem] lg:max-h-none`. A shared bounded-skeleton primitive beats per-file diligence.
- Every client grid or chrome edit desyncs its skeleton silently - re-read the pair and diff the
  grid classes. A strip converted in the client is converted in the skeleton in the same edit.
- Skeletonise everything arriving in the same payload, or siblings pop in and shove the region.
- Late content (a banner resolved after the sheet opens) reserves its height while pending; that
  needs an in-flight flag, since `data === null` cannot tell "nothing" from "not yet".
- A `loading.tsx` that is a plain `overflow-hidden` div where the client uses a ScrollArea can clip
  itself (one clipped 1391px on 13 routes).

## 8. Charts (recharts and similar)

- Legend `verticalAlign: 'top'`, set once in the shared chart theme - a wrapped bottom legend draws
  through the tick labels. A single-series chart needs no legend.
- Tick text: hex `fill` fallback (SVG export, print) plus a Tailwind `fill-*` pair for dark mode;
  `fontWeight: 500`. A local `tick={{...}}` REPLACES the theme's - spread it.
- Category labels wrap into two `tspan` lines via a custom tick renderer; cut the second line, never
  the first. Two 11px lines need ~26px per category.
- `interval={0}` forces every tick and makes them collide; pair it with `angle={-40}
  textAnchor="end"` and a reserved `height`.
- Charts shrink on phones (`h-[140px] lg:h-full`) when they starve a bounded list.
- Date axes go through the locale calendar like any date.

## 9. Dates, offline, print

- Displayed dates go through the app's calendar helper; a value written into an input stays in the
  source calendar. Wrong system rendered? Check the data (settings row) before the code.
- An offline route's static shell has no data provider: the locale setting travels in the sync
  payload. Never add a fetch to that layout. Offline state is content (queued count, syncing,
  failed), not a spinner; network-only tiles are dimmed, not removed.
- `window.print()` prints the DOM: a paginated table prints one page. Official documents are
  generated PDFs. An app with a print button and no `@media print` rule prints the whole site.

## 10. Touch targets

- 44x44px for every tap target, including `<Link>` styled as an icon button.
- Grow the hit area, not the control: `relative after:absolute after:-inset-N after:content-['']`
  (`content-[""]` inside a single-quoted string).

| visual | inset for 44px | minimum row gap |
|---|---|---|
| 24px | `-inset-2.5` (10px) | `gap-5` |
| 28px | `-inset-2` (8px) | `gap-4` |
| 32px | `-inset-1.5` (6px) | `gap-3` |
| 36px | `-inset-1` (4px) | `gap-2` |

- Neighbours overlap when `2 * inset > gap`, and an overlapping view/edit/delete row fires the WRONG
  action. Widen the gap with the inset, or enlarge the control; a control alone in its row can
  expand freely. Report a target that lands at 40px as 40px, not as compliant.
