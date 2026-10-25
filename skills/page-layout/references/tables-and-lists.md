# Tables, lists and stacks

## 1. Tables: sticky heading row

- **What:** the first heading row stays visible while the rows scroll under it.
- **Why:** after ten rows nobody remembers which column is "Due" and which is "Paid".
- **The trap:** shadcn's `Table` wraps the `<table>` in `<div class="relative w-full overflow-auto">`. That div is its
  own scroll container, so a `sticky top-0` header sticks to a box that never scrolls and rides away with the rows.
  Gurukul's `/students` header did exactly that.
- **Fix:** let the table render bare inside the ScrollArea, and give the header a solid background and a shadow line
  (a sticky row drops its border):

```tsx
<ScrollArea orientation="both" className="rounded-2xl ring-1 ring-neutral-200" viewportClassName="max-h-[31rem]">
  <Table scroller="parent" className="min-w-[56rem]">
    <TableHeader sticky>...</TableHeader>
    <TableBody>...</TableBody>
  </Table>
</ScrollArea>
<Pagination ... />   {/* outside the ScrollArea */}
```

- Gurukul `packages/ui/src/components/ui/table.tsx`: `Table` has `scroller="own" | "parent"`, `TableHeader` has
  `sticky` (`sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_...] dark:bg-neutral-900`). If your Table lacks these,
  add them to the shared component - do not hand-write sticky per page.
- **Find:** every `<Table`; check (a) header sticky, (b) no own overflow wrapper inside a ScrollArea.

## 2. Tables: bounded height (~10 rows)

- **What:** a table gets room for at least ~10 rows, then scrolls inside. It never grows the page by a screen because
  one class is big, and never shrinks to three visible rows.
- **How:** the max height goes on the ScrollArea VIEWPORT, never the Root. The Viewport is the real scroller; a
  `max-h` on the Root just clips. Inside an auto-height box a definite `max-h` on the viewport is the only thing that
  works (`flex-1` computes to zero there). On a full-height page, the page body is the bound instead.
- ~10 rows at `text-sm` with `py-2.5` is about `max-h-[30rem]` to `max-h-[32rem]`; measure your row height.
- Gurukul `scroll-area.tsx`: `viewportClassName`, `orientation`, `viewportRef` (to reset scrollTop on page change).
  Example: `apps/main/app/(main)/(finance)/billing/defaulters/_components/defaulters-table.tsx:161`.

## 3. Tables: pagination and width

- **Pagination sits OUTSIDE the ScrollArea**, so it never scrolls away. Prev/Next are disabled at the ends, never
  hidden (the layout must not jump).
- **Wide tables scroll horizontally inside:** `ScrollArea orientation="horizontal"` or `"both"` with a `min-w-[...]`
  on the inner table. Never `overflow-x-auto`, never a `<ScrollBar>` child, never widen the page or panel.
- A vertical-only list uses `orientation="vertical"` - the default "both" lets content widen the box.

## 4. Lists: a ceiling from day one

- **What:** any list that can grow (people, chapters, items, groups) sits in a vertical ScrollArea with a fixed
  max height (about 10 rows) on the viewport.
- **Why:** an unbounded list makes the page grow by a screen for the biggest tenant and hides everything below it.
- **Find:** `.map(` rendering rows outside any ScrollArea; ScrollAreas with no viewport `max-h`.
- **Example:** Gurukul `settings/staffcredits/_components/client.tsx` - `<ScrollArea orientation="vertical"
  viewportClassName={LIST_CEILING}>`.

## 5. Lists: how items are edited

- **One-line items** (a rule, a book title, a uniform item) edit inline: an input in the row.
- **Items with 2+ fields are edited in a right-side sheet, never expanded in place** and never as an always-open card
  of inputs. Why: the expanded card pushes the rest of the list away and the person loses their place. The row shows
  a one-line summary (title, a key field, a problem badge); pressing it opens the sheet; pressing another row swaps
  it (see `sheets.md`). "Add" opens the new item in the same sheet.
- **Not in scope:** pages that are one form, and bulk grids where every row is edited together (marks, attendance,
  fee grids, tax slabs) - those stay grids.
- Borderline (a paragraph in one field, e.g. a model answer): treat as 2+ fields - sheet. Ask when unsure.
- **Find:** list items holding `expanded`/`editing` state that render 2+ inputs.

## 6. Reordering and boards

- **Reordering is drag and drop** with one shared sortable list (grip handle only, so inputs in the row still work;
  keyboard: Space to pick up, arrows to move). Never up/down arrow buttons. Gurukul
  `packages/ui/src/components/sortable-list.tsx` (dnd-kit).
- **Kanban:** one horizontal ScrollArea round the column strip (inner `min-w-[...]`); the board is bounded by its
  parent and never grows the page; each column has its own vertical ScrollArea; column header and footer sit outside
  it. Gurukul `packages/ui/src/components/kanban-board.tsx`.

## 7. Stacks and rhythm

- One gap scale per app: sections `gap-5`/`space-y-5`, inside a card `gap-3`/`gap-4`, row padding `px-4 py-2.5`.
- Divided lists (`divide-y`) inside one bordered container read as one list; a card per row reads as unrelated things.
- Every flex row: `min-w-0` on the growing child, `truncate` on single-line text, `shrink-0` on fixed parts (avatar,
  amount). A selected row: neutral highlight (`bg-neutral-100 dark:bg-neutral-800`), not a coloured border.
- A shared `Card` with `h-full` used as a header/footer band needs `h-auto`.
