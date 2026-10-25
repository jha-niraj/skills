# Scanning: building the map and reading it honestly

A scan builds a candidate list. It is not a defect list. Every category below was measured on real
modules; use the rates to decide where to look first, then verify one example per category on THIS
codebase before fixing any of it.

## Coverage first

1. `find <app> -name '*.tsx' -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path
   '*/.open-next/*' | wc -l` - the denominator.
2. Count the files your scan actually opened. Report `scanned / total` per app and per area.
3. Areas outside the main route group are not a tail: auth, checkout, error/not-found pages,
   `components/`, `layout.tsx` and `*-layout-*` files, the app shell. Scan them as surfaces.

Map row format (the map file):

```
| Rule (ref section) | Today (file:line, count) | Status | Recommendation |
| 2.2 vertical body pin | 29 unpinned `flex-1 min-h-0` ScrollAreas, e.g. app/(main)/x/page.tsx:41 | gap | pin 27, leave 2 that wrap tables |
```

## Scanner hygiene - fix these before trusting any count

- **Blank comments, keep newlines.** Rule tokens appear in comments that explain why they are NOT
  used. Deleting comment lines shifts every reported line number and makes the run unverifiable.
- **Walk tags with a bracket-depth counter.** `<ScrollArea\b[^>]*>` stops at the `>` inside
  `[&>[data-radix-scroll-area-viewport]>div]`, so every correctly pinned scroller reports unpinned.
- **Do not let a tag regex swallow a child.** A `<Button ...>` match that allows nested `<` reports
  the parent unnamed when the child carried the `aria-label`. `asChild` moves the name to the child -
  read the first few hundred characters.
- **Anchor prefixes.** `<TableHead` matches `<TableHeader`; use `<TableHead\b(?!er)`.
- **Units:** `\[[0-9.]*vh\]` and `calc\([^)]*vh`; never `\bvh\]` (no word boundary between `2` and
  `v`, so it never fires). Exclude `dvh|svh|lvh`. One `calc()` blind spot hid 15 real bounds through
  six passes, including signin and the sidebar.
- **Read `style={{ }}` too.** Five `minHeight: '70vh'` bounds survived four class-only passes.
- **Match lowercase tags.** A form grid of raw `<label>`/`<input>` is invisible to a `<Label>` check.
- **`w-[NNNpx]` matches inside `max-w-[NNNpx]`** - anchor on a class boundary.
- **Prove each check fires** against `git show HEAD:<file>` for a file you know was broken. A check
  that never fires reads exactly like a clean codebase. A new check is most dangerous on the module
  right after you wrote it, because you just saw it find real defects.

## Categories and measured false-positive rates

From modules of 129 files (304 raw findings, ~30 real), 44 files (28 raw, ~14 real), and a
verification pass over five modules (238 raw, 12 real). The ratio depends on the codebase's maturity.

| Category | Raw | Real | Why the rest were not |
|---|---:|---:|---|
| `truncate` without `min-w-0` | 61 | ~0 | A `<p class="truncate">` inside a wrapper that already has `min-w-0`. The rule is about the flex ITEM |
| `flex-1` without `min-w-0` | 111 | ~0 | Mostly `flex-col` columns, where min-width never applies. Only flex ROWS (and grid items) matter |
| `min-w-[...]` in page flow | 29 | 0 | Table widths inside their own horizontal scroller - correct |
| `whitespace-nowrap` | 7 | 0 | Inside `<td>`/`<th>` within a horizontal scroller |
| `grid-cols-2` with no 1-col base | 55 | 6 | Stat tiles at 2-up are fine; only label+control FORM grids |
| Icon button with no `aria-label` | 7 | 4 | `title=` also names it; `asChild` child may carry it |
| Spinner standing in for content | 4 | 0 | Inside a button, or with a live progress count |
| Unpinned vertical ScrollArea | 29 | 14 | Scanner tag bug, plus 2 that wrap wide tables |
| `w-[NNNpx]` fixed width in flow | 10 | 0 | Pattern matched inside `max-w-[...]` |
| Colour with no `dark:` pair | 97 | ~0 | Hover states and mid-tones legible on both surfaces |
| Sheet actions inside the scroller | 6 | 0 | Read-only sheets; Save in the header; `onSaveAll` defeats `\bsave` |
| `.toLocaleString` as a date | 97 | ~28 | 69 were `n.toLocaleString()` formatting money |
| "Hand-rolled stat strip" | 7 | 0 | Grids of CONTENT cards, where wrapping is correct |
| "Starved" bounded page | 4 | 0 | Dashboards whose content sits inside one body scroller - check whether `shrink-0` bands sit outside it |

The two that pay for the whole scan are the ScrollArea checks (unpinned body, `max-h` on Root).
Anything shaped "class X appears without class Y" is mostly noise, because the rule depends on a
parent or child the grep cannot see.

## Things a static scan cannot judge - read them

- Table header/body parity when headers come from `.map()`.
- Button counts: a file-wide count is not a row count. Measure the row.
- Proximity checks: a loading/empty ladder between a ScrollArea and its `<Table>` (25 lines) breaks
  "scroller within N lines"; an inline `const BillsTable = () => (...)` has its scroller at each
  USAGE, not at the definition. Never "fix" these by moving the scroller.
- Same-hex text on background (`bg-[#EDE8D0] text-[#EDE8D0]`): a badge that renders empty. Add a
  same-colour check; three passes missed two of these.
- Stale copy: a page describing a pipeline the code no longer runs. Read the strings.

## Known-acceptable patterns - do not re-flag

- A 3-up grid of one-word-plus-figure tiles on a phone (~105px each fits).
- A shared `SheetFooter` with three buttons (it already stacks below `sm`).
- The shared `Card` in normal block flow (`h-full` against an auto parent is auto). It IS a problem as
  a `shrink-0` band in a bounded flex column (needs `h-auto`) and when nested in a stretched grid item.
- A spinner inside a button or with a live progress count.
- An AD/raw date in an input `value=` (only displayed text converts).
- A data table with no hidden columns, inside its own horizontal scroller with a `min-w` - the
  scroller strategy is as valid as hiding columns.
- `sm:!max-w-lg` on a SheetContent (flag unprefixed `!max-w`, not `:!max-w`).
- A `min-w` supplied by a wrapper div or `style={{ minWidth }}`; `min-w-max` on a markdown table.
- A KaTeX / formula block with `overflow-x-auto` - formulas must scroll, not wrap.
- A native scroller deliberately opted out of a smooth-scroll library.
- A regex character class containing an en-dash (it strips them; it is not UI copy).
- Presenter slide dots (8px) with `aria-label`s where Back/Next are the primary path.
- Dense icon rows reaching 40px, not 44px, when the honest options are a redesign or overlap -
  record it as a known shortfall for the manual pass, do not call it compliant.

Record each verified false positive by `file:line` in the ledger so the next pass skips it.
