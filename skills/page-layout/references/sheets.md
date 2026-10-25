# Sheets (shadcn / Radix Dialog side panels)

The reference implementation is Gurukul `packages/ui/src/components/ui/sheet.tsx`, `sheet-swap.tsx` and
`kept-draft.tsx`. If your codebase's Sheet is stock shadcn, port the behaviour into the SHARED Sheet once - every rule
below is then a default, not 100 call-site edits.

## 1. Non-modal right sheet by default

- **What:** `modal={false}` underneath; no dimmed overlay; the page behind stays live - the list can be scrolled and
  clicked, the sidebar/nav works. A sheet that must block the page passes `modal` explicitly.
- **Why:** the sheet is a peek at one item of a list (like Notion's side peek), not a new page.
- **How (Radix):** `Root modal={false}`; in `onInteractOutside` call `e.preventDefault()` for non-modal sheets so
  Radix's own focus/pointer-outside logic never closes them; close through your own document listener instead (2).
- Stock shadcn sheets are modal: overlay + outside click closes + focus trap. That is the thing to change.

## 2. Only a click on empty space closes it

A capture-phase `pointerdown` listener on `document` closes the sheet when ALL hold:
- primary button only (a right click to copy or a middle click does not close)
- the target is outside the sheet and the sheet is open (not already sliding out)
- the target is not inside `[data-sheet-keep-open]`, a popper wrapper (popover, select, menu content), a
  `[role=dialog|alertdialog|menu|listbox]`, or the toast container
- the target is not the sheet's own trigger (`[aria-controls=<sheet id>]`) - else press-close then click-toggle
  reopens it
- no menu, select or popover is currently open (this press only dismisses that, the way every app behaves)

Then: click the sheet's own close button (so `onOpenChange(false)` runs normally), and when closed from outside,
`preventDefault` in `onCloseAutoFocus` so focus stays where the person pressed instead of jumping to the trigger.

- **The sidebar and app nav carry `data-sheet-keep-open`**, so using them never closes the sheet.
- X and Esc still close. A long form that must not close on a stray click may opt in to a guard that ignores the
  click and flashes the element marked `data-sheet-cancel` - but prefer keeping the draft (5) over guarding.

## 3. Swap, never close and reopen

- **What:** ten items, item 1's sheet open, item 2 pressed: the sheet stays open and shows item 2. No slide out, no
  slide in.
- **How:** every row (and every Edit/Add button) that opens the sheet carries `data-sheet-keep-open=""`, so the
  outside listener ignores the press and the row's own `onClick` just changes the selected id. ONE Sheet per list,
  `open={selectedId != null}`, never one Sheet per row and never `key={row.id}` on the Sheet (that remounts it and
  replays the animation). Re-key the FORM inside on the item id (`<Form key={draft.id} />`) or reset its state from
  the row, so the swapped item shows its own values.
- Highlight the open row (`bg-neutral-100 dark:bg-neutral-800`, `aria-expanded`). Pressing the open row again may
  close it.
- **Find:** rows that open a sheet without the marker; Sheets rendered inside `.map`; forms that sync only in
  `onOpenChange(true)` (a swap never fires it, so Edit shows the previous item - a real bug found twice).
- **Example:** Gurukul `apps/main/app/(main)/settings/staffcredits/_components/client.tsx:528-532`.

## 4. Unsaved edits on swap: a discard bar, not a dialog

`useSheetSwap(isDirty, apply)` returns `{ request, discard, clear }`. Rows call `swap.request(row)`; if the open
item is dirty, the swap waits and the sheet shows `<SheetDiscardBar {...swap.discard} />` under its header ("Discard
changes?" - Keep editing / Discard changes). Dirty = the draft differs from a baseline (JSON of the loaded item is
enough). Read-only sheets swap with no guard.

## 5. Drafts are kept on close

- **What:** closing by outside click, X or Esc never loses typing. Reopening the same item (or "new") brings the draft
  back until it is saved or the page is hard-refreshed.
- **How:** `useKeptDraft(key, initial)` -> `[value, set, clear]`, backed by a module-level Map (survives unmount and
  client navigation). Keys are global - prefix by module (`"add-student:new"`, `"monitor:" + id`). Call `clear()` after
  a successful save; a Cancel/Discard action clears too.
- Reset step/selection in the sheet's `onExitComplete` (after the slide-out), never in `onOpenChange(false)` - content
  that collapses while the panel is still sliding away looks broken.

## 6. Inside the sheet

- **Header is a band:** title + one line under it, hairline below, room for the X. Title is SMALLER than the page
  title (Gurukul: `text-base font-semibold`, description `text-xs`) - a panel over a page must not out-rank it. Set the
  size in the shared component, not at call sites.
- **Body starts at the sheet's gap:** the first block after the header carries no top margin/padding of its own.
- **Form sheets pin their footer.** The `<form>` wraps BOTH the scroller and the footer:

```tsx
<SheetContent className="flex flex-col overflow-hidden">
  <SheetHeader className="shrink-0">...</SheetHeader>
  <form onSubmit={...} className="flex min-h-0 flex-1 flex-col">
    <ScrollArea className="-mx-6 min-h-0 flex-1 px-6">...fields...</ScrollArea>
    <div className="shrink-0 border-t pt-4">...Cancel / Save...</div>
  </form>
</SheetContent>
```

- Width: phone leaves a strip of page visible (`max-w-[90%]`) so it reads as a layer; desktop a sensible `sm:max-w-*`;
  optionally resizable by its inner edge.
- Long rows inside: `min-w-0`, `truncate`; nothing scrolls sideways.

## 7. Route-backed sheets close to a destination

A sheet whose open state IS the URL closes by pushing the route behind it, never `router.back()` (a sheet opened from
a sheet would reopen the first one; a pasted URL would leave the app). Work out the destination once at mount, flip
`open` to false first and navigate after the exit duration so the animation plays, and drop command-style query
params. `router.back()` on a button labelled "Go back" on a full page is fine.

## 8. Not a sheet

- Create-only or one-action sheets (record a payment, upload) do not need keep-open - there is no list to swap through.
- A list + detail inbox (select a row, read it in full beside the list) is a split view on desktop, a sheet below `lg`.
