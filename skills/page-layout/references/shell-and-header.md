# Page shell, width and header

## 1. No page is edge to edge

- **What:** every page's content sits inside the app shell's horizontal padding. Reading pages (articles, settings
  forms, a single record) also get a max width (`max-w-3xl` to `max-w-5xl`) so lines do not run 2000px long.
- **Why:** full-bleed content runs under the sidebar and past the right edge, has no breathing room, and reads as a
  broken page. In Gurukul nine pages cancelled the shell's padding with `-mx-4 sm:-mx-6 lg:-mx-8` while the shell only
  rendered `px-4`: they over-cancelled by 17px a side on desktop, and because `<main>` was `overflow-hidden` the
  content was CLIPPED, which looked like cut-off rows rather than a scrollbar.
- **Find:** `grep -rn -- "-mx-" app/`, `w-screen`, `100vw`, page roots with no padding inside a shell that has none.
- **Fix:** delete the negative margin. If a band truly must run to the shell's edge (a toolbar background), cancel
  EXACTLY the padding the shell renders at each width - read the shell, never trust a comment about it.
- **Example:** Gurukul `apps/main/app/(main)/_components/main-layout-client.tsx` pads `px-4 pt-2 pb-24 lg:pb-2` at
  every width; the only correct cancel is `-mx-4`.

## 2. The shell pads; a page does not pad again

- **What:** one component owns page padding. A page root adds none of its own (`py-6 md:py-10`, `p-6`, `container`).
- **Why:** doubled padding pushes the title 48px down and costs table rows. Gurukul found 32 page roots doing it; it
  had been fixed once in one module and came back because nobody swept.
- **Find:** first element of every page / page client. **Fix:** remove it. A centred empty state with large padding
  is content, not page padding - it stays.

## 3. Full-height pages

- **What:** a page that is one list or table under fixed chrome fills exactly the visible height:

```tsx
<div className="flex h-[var(--gk-page-h)] flex-col overflow-hidden">
  <header className="shrink-0">...title, tabs, actions...</header>
  <div className="shrink-0">...band, toolbar...</div>
  <div className="min-h-0 min-w-0 flex-1">
    <ScrollArea className="h-full">...rows...</ScrollArea>
  </div>
  <div className="shrink-0">...pagination...</div>
</div>
```

- **Why:** the header and toolbar never scroll away; the list uses all remaining height.
- `--gk-page-h` is a CSS variable the app shell publishes (viewport minus top bar, minus bottom nav on phones). Find
  your app's equivalent; if none, publish one from the shell - never a hand-written `calc(100vh - 64px)` per page.
- **Traps:** `h-screen` ignores the shell's chrome; `h-full` inside a Radix ScrollArea resolves to nothing (its inner
  wrapper is `display: table`); a `border` on a height-bounded container eats 2px - prefer `ring-1`.
- Dashboards of stacked sections are NOT full-height pages; they scroll normally.
- **Example:** Gurukul `apps/main/app/(main)/schoolwebsite/_components/website-page.tsx` - one shell for a whole
  module: header, optional band, optional toolbar, ScrollArea body; a `split` mode for list + detail inboxes.

## 4. Header: title left, tabs right

- **What:** one row. Left: icon (optional), title, one-line description. Right: tabs (the shared Tabs component,
  TabsList only), then small action buttons. Tabs sync to `?tab=` via `history.replaceState`, seeded from the
  server's `searchParams`, so reload and shared links land on the same tab and switching never re-renders the route.
- **Why:** the user's words - "the tab needs to be on the right side because this is where the hands of the people
  go". A full-width underline strip under the header costs a whole row of height.
- **Find:** `TabsList` placed under the header; `border-b` tab strips; buttons that switch views by local state.
- **Fix:** move into the header's right side; if tabs and actions do not fit at phone width, tabs go first, actions
  collapse into one menu.
- **Example:** Gurukul `useUrlTab(values, initial, fallback)` in `website-page.tsx`.

## 5. Chips and phone toolbars

- **A long chip set is one button** with a dropdown showing the current choice; searchable when long. Gurukul had 23
  FAQ page chips wrapping to two rows; it became one button.
- **Phone toolbar is one row:** search stays visible, every other filter/status/export goes into one dropdown button.
  Desktop may show them inline.
- **Find:** maps of `rounded-full` filter buttons; toolbars that wrap at 390px. **Fix:** a `DropdownMenu` /
  `Popover` + `Command` (searchable) trigger labelled with the current value.

## 6. Save reachable from the sheet

When a page has one header Save and its items are edited in a sheet that covers the header, the sheet's footer shows
the same Save (Gurukul `schoolwebsite/_components/page-save.tsx`: the header Save registers its state in a context;
the sheet footer reads it). Never two independent saves for the same data.

## 7. Route groups and guards (if the framework has them)

Route groups exist to carry a shared guard or layout and mirror the navigation's groups. Moving a page out of a group
can silently remove its only access guard - write the guard first, then move. Keep the folder tree and the sidebar
map in agreement, so a screen can be found from either.
