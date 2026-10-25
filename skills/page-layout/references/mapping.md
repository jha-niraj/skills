# Mapping the codebase (step 2 of the routine)

Read-only. Change no code. The map is what the user and you decide from, so every row carries evidence.

## Map file shape

`<plan folder>/page-layout-map.md`:

```md
# Page layout map - <app> - <date>

## Summary
- Pages scanned: N. Shell pads at: <file:line> (<classes>).
- Already right: ...
- Differs on purpose (decision needed): ...
- Biggest gaps: ...

## Rows
| Area | Rule (ref + section) | Today (file:line, count) | Status | Recommendation |
|---|---|---|---|---|
| Tables | tables-and-lists.md#sticky | 14 tables, 3 sticky; students-table.tsx:88 has own overflow wrapper | gap | Table scroller="parent" + sticky header |
```

Status is one of `ok`, `gap`, `differs - decision needed`. Count first, then list the worst examples - 40 rows of
the same gap are one row with a count and five paths.

## Splitting across subagents

For more than ~60 pages, split by app or by area (shell+headers, stats+charts, tables+lists, sheets+dialogs,
states). Each subagent is READ-ONLY, writes `<folder>/page-layout-map-<area>.md`, never touches another's file, and
returns counts plus file:line evidence. You merge into the main map and spot-check three rows per area yourself -
subagents report confidently even when a grep missed a pattern.

## What to find, and how

Adapt the paths and names to the codebase. First find the shared pieces: `ls` the UI folder for sheet, table,
scroll-area, stat band / KPI, empty-state, sortable, kanban, popover-confirm, skeleton, chart theme.

| Look for | How (grep / read) |
|---|---|
| The shell's padding | Read the root layout(s) for each route group; note the exact padding at every breakpoint |
| Doubled padding | Page roots (`page.tsx` / the first client component) with `p-`, `px-`, `py-`, `container` on the root |
| Edge-to-edge / negative-margin traps | `grep -rn -- "-mx-" app/`, `w-screen`, `100vw`; compare each to the shell's real padding |
| Hand-rolled heights | `h-screen`, `calc(100vh`, `h-full` directly inside a ScrollArea |
| Native scrollers | `overflow-y-auto`, `overflow-x-auto`, `overflow-auto` in app code |
| Page titles | `<h1` sizes; responsive step-ups (`sm:text-3xl`); `font-bold` on headings |
| Tabs placement | `TabsList` / `role="tablist"` positions; underline strips (`border-b` tab rows); hand-made pill buttons switching views |
| Chip rows | maps rendering many `rounded-full` buttons/badges as filters; wrap to 2+ rows at phone width |
| Stat cards | local `StatCard`/`KpiCard`/`MetricCard` components; grids of 3-6 `Card`s holding one number each |
| Charts | chart imports per page; charts on queues/settings/tools; a chart whose number is already in the band; multi-metric charts; charts without an empty state |
| Tables without sticky header | `<Table`/`<table` and whether the heading row is sticky AND the table is not wrapped in its own `overflow-auto` |
| Unbounded tables/lists | tables/lists in a ScrollArea with no `max-h` on the viewport, or with `max-h` on the Root |
| Pagination inside the scroller | pager components rendered as a child of the ScrollArea |
| Inline-expanding items | list items toggling `expanded`/`open`/`editing` state and rendering 2+ inputs in place |
| Sheets that close on another row | rows that open a sheet without the keep-open marker; sheets passed `modal`; sheets keyed so they remount per row |
| Lost drafts | sheets whose form state resets on close; `onOpenChange(false)` clearing state |
| Footer scrolling away | Save/Submit as the last child inside the sheet's ScrollArea |
| Routine dialogs | `AlertDialog`/`Dialog` used for a single delete or a simple choice |
| Up/down reordering | `ArrowUp`/`ChevronUp` buttons that move an item |
| Missing states | lists/tables/charts without an empty branch; `Loader2` spinners centred in a region; `loading.tsx` missing; skeleton class drift vs the page |
| Sideways overflow | flex rows without `min-w-0`; long text without `truncate`; ScrollArea defaulting to both axes in a column |
| Palette | the project's colour rule file; then off-palette classes it bans |

## After the map

Summarise in chat in under 15 lines, then ask the decisions with the picker. Typical decisions:
- Convert all inline-expanding 2+ field lists to sheets now, or module by module?
- Which first pages keep charts (list them), which become band-only?
- A local design choice that contradicts a rule (e.g. a deliberately full-bleed canvas page) - keep or change?
