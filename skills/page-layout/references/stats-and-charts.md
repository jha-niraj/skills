# Headline numbers and charts

## 1. One stat band, never a row of stat cards

- **What:** a page's headline numbers render in ONE bordered band with hairline dividers between cells. Each cell:
  icon, label, value, optional hint ("of 162", "+12 this week"), optional link or filter action.
- **Why:** six bordered cards spend a full row of card chrome on a glance's worth of information and read as six
  unrelated things; one band reads as one summary at about half the height. Gurukul once had 30 local `StatCard`s.
- **Behaviour to keep:** on a phone it is one horizontally scrolling row (cells keep their width, never stack into
  six rows); from `sm` a grid. **The value never truncates** - clipping a figure changes it; the label truncates.
  `tone` tints only the VALUE and only when the number carries a state (overdue, at risk); the band and chips stay
  neutral. A progress track only under a proportion. Cells can be links or filter buttons (`active`).
- **Find:** local `StatCard`/`KpiCard`/`MetricCard`; `grid-cols-4` of Cards with one number each.
- **Fix:** replace with the shared band; skeleton = band skeleton with the SAME count, cols and size.
- **Example:** Gurukul `packages/ui/src/components/ui/stat-band.tsx` (`StatBand`, `StatBandSkeleton`), fed
  `{ icon, label, value, hint?, tone?, href? | onClick + active }`; `size="sm"` inside a panel. If your codebase has
  no band, build this one in the shared UI folder first - it is self-contained on purpose (ScrollArea, Skeleton, cn).
- A strip of quick links/actions is a different component; never put figures in it.

## 2. Where charts go

- **Yes:** a "first page" whose job is "how is this going" - the landing of a module (`/billing`, `/students`) or of
  one thing in it (`/classes/6-A`). It opens with the band and then ONE row of charts about the whole module.
- **No - band only:**
  - work queues and tools: lists to act on, marks entry, approvals, logs, exam lists
  - settings and configuration pages
  - rarely used records (ID cards, certificates)
  - pages that are themselves visual (calendar, planner, canvas, a live monitor)
  - pages under a first page (a detail page, a form, a tab of a record)
- **Why:** charts pushed the real content down on pages where the person came to DO something. A chart earns its
  place only by showing what the band cannot: a trend over time or a split across groups.
- **A chart that repeats the band is removed** (a donut of "paid vs unpaid" next to a band cell saying 72% paid).
- **Find:** chart imports per page; classify the page; compare each chart's metric with the band's cells.

## 3. House chart style

- **One metric per chart.** No dual axes, no two unrelated series on one plot.
- **Real units** on axis ticks and tooltips (`Rs 12,400`, `89% (144 of 162)`), never bare numbers.
- **Neutral ink, one accent:** every mark neutral grey; the ONE datum to look at (lowest section, today, the
  overdue bucket) in the accent colour. A chart is not a rainbow.
- **Empty is drawn, not zero:** a shared empty chart (faint outline of the chart's shape, one line of reason, still
  under reduced motion). "No register taken yet today" - never a row of 0% bars. Items with no data are listed
  ("Not marked yet: 6-A, 7-B"), not drawn as zero.
- **Aggregates need a window:** label the period (today / last 30 days / this term). Zero for the window is the
  answer; never widen the window because zero looks bad.
- **Example:** Gurukul `apps/main/components/charts/class-attendance-chart.tsx` (neutral bars, lowest in amber,
  `ChartEmpty`, "not marked" list), shared theme `packages/ui/src/lib/chart-theme.ts` (`CHART_MONO`, `seriesColor`,
  `CHART_AXIS_PROPS`, `CHART_TOOLTIP_STYLE`), `packages/ui/src/components/charts/chart-empty.tsx`.
- If the `dataviz` skill is available, load it before writing chart code; this file decides where, that one how.
