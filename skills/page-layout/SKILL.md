---
name: page-layout
description: Lays out the screens of a data-heavy web app (Next.js App Router, shadcn/Radix, Tailwind) so every page reads the same way - page shell and width (never edge to edge), header with title left and tabs right, one-row phone toolbar, one stat band instead of stat cards, charts only where a page answers "how is this going", tables with a sticky heading row inside a bounded ScrollArea (about 10 rows), lists with a ceiling, 2+ field list items edited in a non-modal right sheet that SWAPS when another row is pressed, popover instead of dialog for routine confirms, skeletons shaped like the layout. It maps the codebase first, asks the decisions, writes a plan, then fixes in waves. Use when the user says "fix the layout", "pages look inconsistent", "make the tables sticky", "the sheet closes when I click another row", "page is full-bleed / edge to edge", "too many stat cards", "where should charts go", "layout pass", "/page-layout", or when building a new list, table, sheet or module landing page.
---

# Page layout

You make every screen of an app follow one layout grammar, so a person who learned one page can read all of them.
The rules below were learned in a real product (Gurukul, a school management app) by breaking them; its components
appear as **worked examples**. In another codebase, **find your codebase's equivalent; if there is none, build it
first in the shared UI package** (`packages/ui`, `components/ui`, wherever shadcn components live) and then use it
everywhere - never a local copy per page.

Width and breakpoint behaviour (phone, tablet, desktop, overflow at 390px) belongs to the `responsive-pass` skill.
This skill decides WHAT goes WHERE; use that one for how it reflows. When both apply, run this one first.

## When it loads: the routine (do not skip steps)

1. **Ask first** with the AskUserQuestion picker (never prose questions), recommendation first marked
   `(Recommended)`: "Map the codebase first?" - whole codebase (Recommended for a first run) / one app / one page or
   module / skip, I know the gap. Ask a constraint only if it changes the work (e.g. "may I run the dev server?").
   Never ask what the code can answer.
2. **Map, read-only.** Find the plan/docs folder (`plan/`, `docs/`, else create `docs/page-layout/`). Write
   `<folder>/page-layout-map.md`. Checklist and grep recipes: `references/mapping.md`. Map at least:
   - every page's shell: who pads, max width, edge-to-edge pages, negative-margin traps, doubled padding
   - headers: title size, tabs placement (right or a strip under the header), toolbars, rows of chips
   - headline numbers: rows of stat cards vs one band; charts that repeat the band; charts on work queues
   - tables: sticky heading row? inside a bounded scroller? pagination inside or outside? horizontal scroll?
   - lists: a ceiling? items with 2+ fields expanding in place? up/down arrow reordering?
   - sheets: modal or not, rows that close the sheet instead of swapping, drafts lost on close, footer scrolling away
   - dialogs used for routine confirms; missing empty states; spinners where a skeleton belongs; skeletons out of sync
   For a large codebase split by area across parallel READ-ONLY subagents, each writing its own section file, then
   merge. Each row: rule (reference + section), what the code does today (file:line, counts), status `ok` / `gap` /
   `differs - decision needed`, one-line recommendation. **Change no code while mapping.**
3. **Question the playbook, then ask.** Summarise: what is already right, where this codebase reasonably differs and
   why (a deliberate design system choice is not a gap), the biggest gaps. Ask every real decision with the picker
   (max 4 per call, 2-4 options, recommendation first, one-line reason each). Fixes with one sensible answer are just
   listed and done.
4. **Plan file before code:** `<folder>/page-layout-plan.md` (or the project's own plan template) - decisions,
   waves of `- [ ]` tasks. A task is ticked only with a `Verified:` line (what was run, what it printed). Never delete
   a task; out of scope = `[-]` with the reason.
5. **Build in waves.** Shared components first (sheet, table, stat band, scroll area, empty state), then pages.
   Parallel subagents only on non-overlapping files; they never run typecheck or builds; you run ONE typecheck per
   wave and review their reports (check the risky edits yourself). Never push or deploy; commit only if the project's
   rules allow it, and ask first.
6. **Verify.** Typecheck once per wave. Check each touched page with curl/HTML or let the user look (some users
   review visuals themselves - ask). Say plainly what was not verified (e.g. "sheet swap not clicked through").

Follow the project's own rule files (`AGENTS.md`, `CLAUDE.md`, per-app rule files) - they override this skill.

## The rules, by area (detail in references)

### 1. Page shell and width - `references/shell-and-header.md`
- **No page is edge to edge.** Content sits inside the app shell's padding and, for reading pages, a max width.
  Full-bleed pages look broken: rows run under the sidebar and past the right edge.
- **The shell pads; a page does not pad again.** Find the ONE place that pads (Gurukul: the main layout's
  `px-4 pt-2`). A page root adding `py-6`/`px-6` doubles it. A negative margin must cancel exactly what the shell
  renders at every width (`-mx-4`, not `-mx-4 sm:-mx-6 lg:-mx-8` when the shell has no step).
- **Full-height pages** (one list or table under fixed chrome): root `flex h-[<page-height var>] flex-col
  overflow-hidden`, a `shrink-0` header, a `flex-1 min-h-0 min-w-0` body holding the ScrollArea. Never `h-screen`,
  never `h-full` under a Radix ScrollArea, never a hand-written `calc(100vh - ...)`. Dashboards scroll normally.

### 2. Header and toolbar - `references/shell-and-header.md`
- **Title left, tabs right**, same row, the shared Tabs component, synced to `?tab=` with `history.replaceState`.
  Never a full-width underline strip under the header, never hand-rolled pills.
- **A long chip set is one button** with a dropdown (searchable when long) showing the current choice.
- **Phone toolbar is one row:** search stays; every other filter, status and action goes into one dropdown button.
- Header actions are small buttons after the tabs. A page with a Save keeps it reachable from inside a sheet too.

### 3. Headline numbers - `references/stats-and-charts.md`
- **One stat band, never a row of stat cards.** One bordered band, hairline dividers, icon + label + value per cell;
  value never truncates (the label does); colour tints only the value and only when the number carries a state.
- Its skeleton has the same count, columns and size.

### 4. Charts - `references/stats-and-charts.md`
- **Where yes:** the landing of a module or of one thing in it, when the page's job is "how is this going". A band
  plus one row of charts that show what the band cannot - a trend or a split.
- **Where no:** work queues and tools (lists to act on, marks entry, approvals, logs), settings, rarely used records,
  pages that are themselves visual (calendar, planner, canvas). Band only. A chart that repeats the band is removed.
- **House style:** one metric per chart, real units on the axis and tooltip, neutral ink with ONE accent on the one
  datum to look at, a shared empty chart ("No register taken yet today"), never a fake zero.

### 5. Tables - `references/tables-and-lists.md`
- **The heading row is sticky.** The table sits in a ScrollArea; the table itself must not create its own scroll
  wrapper, or the sticky row sticks to a box that never scrolls (Gurukul: `<Table scroller="parent">` +
  `<TableHeader sticky>`).
- **Bounded height:** room for at least ~10 rows, then it scrolls inside. The max height goes on the scroll
  VIEWPORT (`viewportClassName="max-h-[...]"`), never on the Root (the Root clips without scrolling).
- **Pagination sits outside the ScrollArea**; buttons disabled, never hidden.
- **Wide tables scroll horizontally inside** `ScrollArea orientation="horizontal"` (or `"both"`) with a `min-w-[...]`
  inner element. Never `overflow-x-auto`, never widen the page.

### 6. Lists and stacks - `references/tables-and-lists.md`
- **Every list that can grow has a ceiling** (about 10 rows) in a vertical ScrollArea from day one.
- **A list item with 2+ fields is edited in a right-side sheet, never expanded in place.** One-line items edit inline.
  Full-form pages and bulk grids (marks, attendance) are not lists of items.
- **Reordering is drag and drop** (one shared sortable list), never up/down arrow buttons.
- **Kanban:** one horizontal ScrollArea round the columns, each column its own vertical ScrollArea, the board never
  grows the page.
- Stack rhythm: one gap scale per app (`gap-5` sections, `gap-4` inside a card); rows `min-w-0` + `truncate`.

### 7. Sheets - `references/sheets.md`
- **Non-modal right sheet by default:** no dimmed backdrop; the list behind stays clickable; the sidebar and nav stay
  clickable WITHOUT closing it (they carry the keep-open marker).
- **Only a click on empty space closes it** (plus X and Esc). Not a click on a popover, menu, toast or another dialog.
- **Swap, never close and reopen.** Item 1 open, item 2 pressed: the sheet stays and shows item 2. Every row that
  opens the sheet carries the keep-open marker (Gurukul: `data-sheet-keep-open`); the form re-keys on the item id.
- **Unsaved edits on swap** wait behind a small "Discard changes?" bar at the top of the sheet, not a dialog.
- **Drafts are kept on close**: an outside click must not lose typing; reopening the same item brings it back.
- **Body starts at the sheet's gap** (no top margin of its own). Title smaller than the page title.
- **Form sheets pin their footer**: the form wraps both the scroller and the footer, so Save never scrolls away.
- A sheet whose state is the URL closes by pushing the route behind it, never `router.back()`.

### 8. Popover vs dialog - `references/states-popovers-density.md`
- Routine confirms and quick choices (delete one item, apply-to choices) open in a popover anchored on the button.
  A centred dialog only for big or irreversible actions (removes many things, cannot be undone).

### 9. Empty and loading states - `references/states-popovers-density.md`
- A control's own action: spinner. A region with a shape: **skeleton shaped like that layout**. A whole route:
  the app's page loader. `loading.tsx` and the client's loading branch share ONE skeleton.
- Editing a layout desyncs its skeleton silently - change both in the same edit.
- Every list, table and chart has an empty state (icon, one line, the action). No data is not zero.

### 10. Density, typography, colour, overflow - `references/states-popovers-density.md`
- One type scale per app (Gurukul main: page title `text-xl font-semibold`, never a responsive step up; sections
  `text-base`; body `text-sm`; nothing below `text-xs`; `font-semibold` is the heading ceiling).
- **Colour: find the project's own palette rule** (AGENTS.md / CLAUDE.md / design tokens) and follow it. If there is
  none, ask before inventing one. Common shape: neutral surfaces, state carried by words and by tinted values.
- Nothing scrolls sideways in a chat column or a panel: `min-w-0`, `truncate`, vertical-only ScrollArea.

### 11. One screen per job
- If the project has one shared surface for a kind of work (Gurukul: every outgoing post, story or announcement is
  written in ONE composer at `/compose?kind=&id=`, each kind an adapter), a new feature of that kind plugs into it as
  an adapter - never a new form or editor. Find such rules in the project's rule files during the map.

## When the stack differs
- **No shadcn/Radix:** the rules stand; implement the behaviour (sticky header, viewport max height, outside-click
  sheet with a keep-open marker) in whatever primitives exist, once, in the shared UI folder.
- **No monorepo:** "shared package" means the app's `components/ui`.
- **Pages Router:** no `loading.tsx`; use the route-change skeleton the app has, or build one.
- **No TanStack Query:** loading/empty rules still apply; swap logic is plain React state.
- **A design system with its own layout rules** (e.g. a vendor kit): those win on look; keep the behaviour rules.

## Done means
Map file, plan file with every task `[x]` + `Verified:` or `[-]` + reason, typecheck clean, a short report:
what changed, what was left and why, what the user should click through.
