---
name: responsive-pass
description: Runs a responsiveness pass over a web app (Next.js App Router, React, Tailwind, shadcn/Radix) so every screen works at phone width - bounded page heights in dvh, no sideways page scroll (the Radix ScrollArea display:table shrink trap), tables that scroll instead of crushing, one-row phone toolbars, stat strips instead of stacked cards, sheets that leave a strip, skeletons that match, charts that read at 360px, 44px tap targets. It maps the codebase by FILE COUNT with a calibrated scan, verifies one example per finding category before fixing, fixes at the shared primitive, then does a manual 360x640 pass in an iframe and keeps a ledger. Use when the user says "responsiveness pass", "make this mobile friendly", "fix the phone layout", "it scrolls sideways on mobile", "check this at phone width", "/responsive-pass", or when a page looks cut off, zoomed in or shifted on a phone.
---

# Responsive Pass

You make an app behave at every width, and you prove it. The work is: find defects mechanically, check
the finding categories are real, fix at the widest scope, then measure the real screens at 360x640.

Every rule here came from a defect that shipped looking fine on a laptop and was broken on a phone.
The examples come from one codebase (Gurukul: `@repo/ui` `ScrollArea`, `StatBand`/`StatStrip`,
`--gk-page-h`). **Find your codebase's equivalent of each named piece; if there is none, build it
first in the shared UI package**, then use it everywhere. A rule is a layout fact first and a class
name second.

**Layout rules live in the `page-layout` skill** (what a page, table, list, sheet or chart should
contain and where it sits). This skill is about how those things BEHAVE as the width changes. When a
fix needs a layout decision (which columns, where tabs go, sheet vs inline edit), follow
`page-layout` if it is installed, else the project's own rules file.

## Always do first: the load routine

1. **Ask (AskUserQuestion picker, recommendation first marked `(Recommended)`):** "Map the codebase
   first?" - whole codebase (Recommended for a first run) / one app / one page or module / skip, I
   know the gap. Ask a constraint only if it changes the work: "May I run a dev server and open pages
   in a browser tab for the manual pass?" Never ask what the code can answer.
2. **Map, read-only.** Find the plan/docs folder (`plan/`, `docs/`, else create
   `docs/responsive-pass/`). Write `<folder>/responsive-pass-map.md`. The map is a **scan by FILE
   COUNT**, not by module name (see below). Each row: rule (reference + section), what the codebase
   does today with `file:line` and counts, status `ok` / `gap` / `differs - decision needed`, one-line
   recommendation. Change NO code while mapping. For a large codebase split by area across parallel
   read-only subagents, each writing its own section file, then merge.
3. **Verify one example per category** before trusting any count (see "Findings are not defects").
   Write the real/raw ratio into the map.
4. **Question the playbook, then ask.** Summarise what is already right, where this codebase
   reasonably differs (no Radix, no Tailwind, desk-only app) and why, and the biggest gaps. Ask real
   decisions with the picker (max 4 per call, 2-4 options, recommendation first). Small fixes with
   one sensible answer are just done - list them.
5. **Plan file before code:** `<folder>/responsive-pass-plan.md` - decisions, then waves of `- [ ]`
   tasks; tick one only with a `Verified:` line saying what was run and what it printed. Never delete
   a task; out of scope = `[-]` with the reason.
6. **Build in waves** - shared primitives first, then module by module. Parallel subagents only on
   non-overlapping files; subagents do not typecheck or build; the lead runs ONE typecheck per wave
   and checks each subagent's riskiest claims. Run the trap check (`references/traps.md`) after EVERY
   batch of edits. Never push or deploy; commit only if the project's rules allow, asked with the picker.
7. **Manual pass at 360x640** in an iframe (`references/manual-pass.md`), then update the ledger
   (`references/ledger-template.md`). Say plainly what was not verified.

Safety: never resize the user's browser window; never write to a production database (seed test data
only with an idempotent script, and only with permission); never put credentials in a file or message.

## The map: scan by file count

Count the files the scan opened against `find <app> -name '*.tsx' -not -path '*/node_modules/*'
-not -path '*/.next/*'`. One app was reported "fully passed" after 755 files; the real total was 849.
The gap was auth pages, checkout, error pages and every shared component - the first screen every
user sees, the money flow, and a sidebar on every screen. Modules are how you WORK; file count is how
you decide you are finished. Shared components and `layout.tsx` files belong to no module - scan
them as surfaces of their own.

Scan categories, highest yield first (patterns and scanner bugs in `references/scanning.md`):

| Category | Typical real rate | Note |
|---|---|---|
| Unpinned vertical body ScrollArea | ~50% | The check that pays for the scan. Rest wrap wide tables |
| `max-h-*` on a ScrollArea Root | high | Clips instead of scrolling |
| `vh` bounds (incl. inside `calc()` and `style={{}}`) | high once scanner is right | Exclude `dvh/svh/lvh`; check for scroll-driven sticky |
| Sheet `w-full` + unprefixed `max-w-*` | ~30% | Without `w-full` it is harmless |
| Sheet `flex flex-col` without `overflow-hidden` | high | Two scroll surfaces |
| Submit buttons inside the sheet body scroller | medium | First prove a submit button exists |
| Form grid `grid-cols-2` with no 1-col base | ~10% | Stat tiles at 2-up are fine; only label+control grids |
| Icon button with no `aria-label` | ~55% | `title=` and `asChild` children also name it |
| Content spinner | ~0-50% | Button and progress spinners are correct |
| `truncate` / `flex-1` without `min-w-0` | ~0% | Conditional on a parent the grep cannot see |
| `min-w-[...]` in flow, `whitespace-nowrap` | ~0% | Nearly all inside correct horizontal scrollers |

The noise is a property of the codebase's maturity, not a constant - recalibrate per module. A low
count can mean a clean module OR a scanner that stopped matching: **prove each check fires** against
`git show HEAD:<file>` for a file you know was broken.

## Findings are not defects

One module: 304 raw findings, ~30 real. Another: 238 raw, 12 real. Before fixing any category:
read one example of it, decide real or noise, record the ratio. Report "N findings, M real" - never a
finding count as a defect count. Known-acceptable patterns that should not be re-flagged are listed
in `references/scanning.md`.

## The rules by area (detail, scans and fixes in `references/rules.md`)

1. **Height and scrolling.** A full-height page is bounded at every width by ONE shell-published
   variable (Gurukul: `h-[var(--gk-page-h)]`), never `h-screen`, `h-full` or a hand-rolled
   `calc(100vh-...)`. Mobile bounds use `dvh`; the shell's own box too, not just the variable. Root
   `flex flex-col overflow-hidden`, `shrink-0` header, `flex-1 min-h-0 min-w-0` body holding the
   ScrollArea. Chrome above a bounded list is paid for in rows: aim for 4-6 visible rows. When chrome
   genuinely cannot fit, bound from `lg` only and cap the list on `viewportClassName`.
2. **Horizontal overflow.** The page never moves sideways at 360px. Radix ScrollArea wraps content in
   a `display:table` box that is shrink-to-fit, so one nowrap descendant widens the whole page and
   the viewport clips it - the page looks "zoomed in" or shifted. Every vertical page body takes
   `orientation="vertical"` (the pin) + `min-w-0`, unless it wraps a wide table or a fixed-size
   preview. `truncate` needs `min-w-0` on the flex/grid item and its ancestors. Every `w-max` needs a
   horizontal scroller parent. Chat and side panels: nothing ever scrolls sideways.
3. **Tables and lists.** Each table in its own `orientation="horizontal"` scroller with a `min-w`
   inner element, or non-essential columns hidden below `md` in matching header/body pairs. The link
   to the detail page lives on the row NAME. Every growing list has a ceiling (max height on the
   VIEWPORT). Master-detail splits stack below `lg`. Budget a repeated row's fixed content by
   arithmetic at the 44px floor.
4. **Headers and toolbars.** Tabs on the right of the title row (a compact select on a phone, same
   `?tab=` state). On a phone the toolbar is ONE row: search stays, every other filter/sort/export
   goes into one menu or filter-sheet button. A long chip set is one dropdown button. Secondary
   actions collapse into a 3-dot menu below `sm`. `flex-wrap` is a deferral, not a fix.
5. **Stat summaries.** One band/strip component that is a single scrolling row on a phone (Gurukul:
   `StatBand`), never `grid-cols-1 sm:grid-cols-N` cards. Money and counts never truncate - step the
   type down; labels truncate.
6. **Sheets and dialogs.** `max-w-[90%]` on the Sheet primitive so a phone always sees a strip of
   page; consumers write `sm:max-w-*`, never an unprefixed `max-w-*` with `w-full`. Footer pinned
   `shrink-0` outside the body scroller; count footer buttons in the worst-case state. Form grids
   `grid-cols-1 sm:grid-cols-2`.
7. **Loading states.** Skeleton shaped like the surface, bounded at the SAME breakpoint as the client.
   Every client layout edit desyncs its skeleton silently - diff the pair.
8. **Charts.** Legend above the plot, tick `fill` pair for dark mode, category labels wrap (two
   `tspan` lines), `interval={0}` only with angled ticks and a reserved band.
9. **Dates, offline, print.** Display dates through the locale's calendar helper; an offline route
   has no provider, so the setting travels in the sync payload. Paginated tables do not print.
10. **Touch and safe areas.** 44x44 tap targets via an `after:` hit-area expansion that does not
    overlap neighbours (`2 * inset <= gap`). Fixed bottom bars carry `env(safe-area-inset-bottom)`
    (a `.safe-area-bottom` class defined once in globals - check it is DEFINED, not just used).

## Fix at the widest scope

A defect found in one module's sheet is usually in every module's sheet. Before editing call sites,
ask: is this the primitive's default? One-line fixes that did more than a hundred call-site edits:
the ScrollArea's `orientation="vertical"` applying the pin itself; `max-w-[90%]` in the Sheet
variant; the chart theme's legend position; defining the safe-area classes; the shell's own box in
`dvh`. If you are applying the same fix per page, it belongs somewhere else.

## Running a module

1. Enumerate surfaces: every page, `layout.tsx`, sheet, dialog, tab, and the empty, loading,
   populated and error state of each. The populated state is the one that breaks.
2. Walk the rule areas on each. 3. Fix at the widest scope. 4. Trap check after each batch.
5. Read the page's COPY against what the code now does - a layout pass is the one time someone reads
   every string. 6. Typecheck once at the end of the module. 7. Report what you did NOT fix, and why.
Order modules by phone traffic, not by how broken they look.

## The manual pass (detail in `references/manual-pass.md`)

**360 x 640, not 390** - the extra 30px hides a whole class of overflow. Never resize the user's
browser: open a tab on the app's origin, inject an `<iframe>` 360x640 (and 390x844 beside it if
useful), screenshot that. Wait for `readyState === 'complete'` and the skeleton to go before
measuring - two "defects" in one pass were the loading screen. Measure, do not eyeball:
`scrollWidth > clientWidth` on the document, offscreen elements classified by whether an ancestor
actually scrolls, clipped height on `overflow-hidden` roots. A finding here is worth more than any
scan finding, because by definition reading the markup missed it (two invisible same-hex badges
survived three automated passes).

## The ledger

One file per app (`<folder>/responsive-pass-ledger.md`, template in
`references/ledger-template.md`): status table per module, coverage by file count, shared primitives
changed, and per module "what changed", "check by hand" and "found in manual pass". A ledger that
disagrees with the code costs more than none - re-verify its claims at the start of each session.

## Traps (full list in `references/traps.md`)

- A `//` comment in JSX child position renders as text on the page.
- A `{/* */}` comment cannot be the first thing inside `return (`, `? (` or `: (`.
- A comment cannot contain its own terminator - describe the form in words.
- `after:content-['']` inside a single-quoted class string closes the string; use `content-[""]`.
- A `max-h` on a ScrollArea Root clips without scrolling.
- `flex-1` and grid items do not shrink without `min-w-0`.
Check: compare each edited file's brace/paren/bracket balance with `git show HEAD:<file>`; flag any
file whose delta changed. Only the typecheck catches the quote trap.

## When the stack differs

- **No Radix ScrollArea** (native `overflow-auto`): the shrink trap does not apply; the `min-w-0` and
  `max-h`-on-the-scroller rules still do. Follow the project's scroller convention.
- **No Tailwind:** every rule is a CSS property; translate the scan patterns to your CSS-in-JS or
  module classes, and scan inline styles either way.
- **No shell height variable:** create one in the app shell before bounding pages; never repeat the
  arithmetic per page.
- **Pages Router / no TanStack:** only the loading-state wiring changes; the skeleton rules hold.
- **Desk-only app** (an internal console): ask whether it is in scope; it may be out by decision.
- **No browser tools:** do the manual pass as a checklist for the user, with the measurement snippet
  for them to paste into devtools, and say it was not run.

## What a pass does not prove

It is not a device test: touch momentum, keyboard avoidance and real safe-area handling need
hardware. Say so in the report. Do not claim lint or build passes unless you ran them.
