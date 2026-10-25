# Popovers vs dialogs, empty and loading states, density, colour, overflow

## 1. Popover, not dialog, for routine actions

- **What:** a quick confirm or a small choice opens in a popover anchored to the button that triggered it - delete
  one item ("Delete this FAQ?" Cancel / Delete), "Apply to all classes" as a dropdown with every class ticked, untick
  to exclude. A centred dialog only for actions that remove many things or cannot be undone.
- **Why:** a dialog interrupts and dims the whole page for a two-second decision; the popover keeps the person's eyes
  where they pressed.
- **Find:** `AlertDialog`/`Dialog` whose body is one sentence and two buttons, or a short checkbox list.
- **Fix:** a shared `ConfirmPopover` (build it once if missing: Popover + text + two small buttons, destructive one
  in the danger colour, focus on Cancel). Gurukul has one in `@repo/ui`.
- Choices that would otherwise be a page of chips are a dropdown on a button too (see `shell-and-header.md`).

## 2. Loading states: pick by size

| What is loading | Use |
|---|---|
| A control's own action (submit, row save, toggle) | Spinner inside the control |
| A region with a shape (list, panel, table, form, chart) | Skeleton shaped like that layout |
| A whole page / route transition | The app's page loader (Gurukul `GurukulLoader`) |

- A skeleton mirrors ONE surface: same header, same band count/cols, same row heights, same breakpoints for bounds
  (`lg:h-...` vs `h-...`). A generic skeleton reused in five tabs is wrong in four.
- The route's `loading.tsx` (App Router) and the client's loading branch render the SAME skeleton component, with the
  real static title (only data is grey).
- **Editing a layout desyncs its skeleton silently** - change both in one edit and diff their classes.
- Delete a spinner's centring wrapper along with the spinner.
- **Find:** `Loader2`/spinner centred in a region (`flex h-64 items-center justify-center`); pages without
  `loading.tsx`; skeleton files whose classes differ from the page.

## 3. Empty states

- Every list, table and chart has an empty branch: an icon (Gurukul `EmptyState` draws it in an icon stack), one line
  saying what is missing, and the action that fills it ("Add the first route"). Search with no hits says so and offers
  to clear the search - it is a different empty from "nothing created yet".
- **No data is not zero:** no attendance rows = "not marked yet", not "0%". Never draw an empty chart as zero bars.
- Empty states are content: centred with generous padding is fine.

## 4. Density and typography (example scale - find the project's own)

Gurukul's main app, a dense staff app (`apps/main/CLAUDE.md`, reference page `settings/(people)/members`):

| Element | Class |
|---|---|
| Page `<h1>` | `text-xl font-semibold`, optional `h-5 w-5` icon; never a responsive step up |
| Page description | `text-xs`, `mt-0.5` |
| Section heading / CardTitle | `text-base font-semibold`, icons `h-4 w-4` |
| Header buttons | `size="sm"`, icons `h-3.5 w-3.5` |
| Inputs, selects | `h-9 text-sm` |
| Body, table cells | `text-sm`; meta lines `text-xs` |
| Stat value | `text-base` to `text-xl` `font-semibold` |
| Section rhythm | `gap-5` / `space-y-5` |

- `font-semibold` is the heading ceiling; no `font-bold`.
- **Nothing below `text-xs` (12px).** Smaller text at a weaker colour turns a density pass into an accessibility bug.
- The scale governs headings; a large displayed VALUE (a name, a KPI) is fine.
- Why it matters: a `text-3xl` title + big icon + subtitle cost ~78px; on a 1080px screen the page showed five of
  thirty-five rows. Chrome above a table is paid for in rows.
- Apps may differ on purpose (a sparser portal can use `text-2xl`); do not harmonise a deliberate difference.
- **Radius:** pressable controls share one radius (Gurukul `rounded-xl` on Button, Input, Select). `rounded-full` is a
  SHAPE for things that are round or carry a value (avatars, dots, chips, progress tracks, small circular icon
  buttons), not a style for buttons.

## 5. Colour: use the project's rule

- **Find the project's own palette rule first** - `AGENTS.md`, `CLAUDE.md`, a design-tokens file, the Tailwind theme.
  Follow it exactly; it overrides anything here. If none exists, ask before inventing one.
- Example of such a rule (Gurukul): only a short list of hues allowed (emerald, teal, amber, orange, rose, lime,
  neutral/zinc, a brand gold); never blue/violet/etc; **green is not a surface** - cards are neutral whatever their
  state, words and tinted values carry the state; narrow carve-outs (a chart series, a success toast, a decorative
  cover with no data on it). Decorative covers never go on tables, forms, stats, charts or print.
- When sweeping: fix the screen you are on; do not add new violations; do not mass-sweep without asking.

## 6. No sideways overflow in columns and panels

Chat columns, side panels and sheets must never scroll horizontally:
- flex children get `min-w-0`; cards in an `items-start` column get `w-full max-w-full`
- single-line text gets `truncate` (or wraps on purpose)
- ScrollAreas that should only scroll down pass `orientation="vertical"`
- wide content (a table) scrolls in its own horizontal ScrollArea; the panel never widens

Width behaviour at phone/tablet sizes beyond this is the `responsive-pass` skill.

## 7. Click-to-reveal on marketing pages (if the project has a marketing site)

On a public marketing page, content a visitor must CLICK to see (tabs, step pickers, "press any step") tends to go
unseen - visitors scroll, they do not click through a demo. Prefer a scroll story (steps scroll, a sticky panel shows
the active step; phones show each panel inline). Hover-to-preview on desktop is not a click and can stay. App screens
(staff tools) are not marketing pages - tabs there are fine.
