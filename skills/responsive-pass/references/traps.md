# Traps that cost real time

Most of these are not responsiveness bugs. They are ways a fix silently breaks the page you were
fixing, or ways a scan tells you something false. Every rule in this skill asks you to leave a
comment recording a measurement, and the place that most wants one is exactly where a comment does
not compile.

## Traps you spring on yourself while editing

1. **A `//` comment in JSX child position renders as text.** It is a text node there; React prints
   the words on the page. Inside JSX children, comments must be braced.
2. **A braced comment cannot be the first thing inside `return (`, `? (` or `: (`.** It becomes a
   separate expression and the branch stops parsing. Put the comment above the `return`, or use a
   bare block or line comment in that position only (it is a JS context there, not a JSX child).
   Sprung three times across seven modules, once in an app SHELL where it would have taken the
   whole product down. Each time caught by re-running the check, not by reading the diff.
3. **A comment cannot contain its own terminator.** The usual path: you hit trap 2, switch to a bare
   block comment, then explain in it what the braced form looks like - writing the closing sequence
   ends the comment early. The syntax error is reported at the innocent fragment after it. Describe
   the form in words instead.
4. **A class string cannot contain its own quote.** `after:content-['']` inside a single-quoted
   `cn('...')` closes the string; seven `TS1005` errors appeared at once. Inside single quotes write
   `after:content-[""]`; inside double quotes keep `['']`. Brace-balance checks do NOT catch this -
   only the typecheck does.

**The check, after EVERY batch of edits** (not once at the end): for each edited file, count `{ }`,
`( )` and `[ ]` in the working copy and in `git show HEAD:<file>`, and flag any file whose
open-minus-close delta CHANGED. A correct edit shows no drift; a self-terminating comment shows up
immediately. Add a grep for `^\s*//` lines between JSX tags. Then the typecheck, once per wave.

```bash
for f in $(git diff --name-only -- '*.tsx'); do
  for p in '{}' '()' '[]'; do
    o=${p:0:1}; c=${p:1:1}
    now=$(( $(tr -cd "$o" < "$f" | wc -c) - $(tr -cd "$c" < "$f" | wc -c) ))
    was=$(( $(git show HEAD:"$f" 2>/dev/null | tr -cd "$o" | wc -c) - $(git show HEAD:"$f" 2>/dev/null | tr -cd "$c" | wc -c) ))
    [ "$now" != "$was" ] && echo "DRIFT $p $f: $was -> $now"
  done
done
```

## Layout facts that look like they should work and do not

5. **`flex-1` does not let a flex item shrink**, and neither does `truncate`. `min-width: auto` means
   "at least my content"; a form control also has an intrinsic width. Add `min-w-0`. Grid items
   behave the same way. The single most repeated mistake.
6. **`max-h-*` on a ScrollArea Root clips without scrolling.** Put it on `viewportClassName`.
7. **`h-full` inside a Radix ScrollArea computes to auto** (percentage heights do not resolve through
   a table box). Use the bounded flex column pattern.
8. **`flex-wrap` hides overflow by converting it into height.** It never trips a sideways check and
   reads as handled.
9. **`min-w-full` beside `w-max`** makes a strip look deliberate and still overflows.
10. **tailwind-merge is last-wins per property and modifier.** An unprefixed consumer `max-w-*`
    silently beats the primitive's `max-w-[90%]`; `sm:max-w-*` does not.
11. **`orientation="vertical"` forbids over-wide content.** Right for a page body; wrong for a pane
    holding a print-size preview, a diagram or a wide table without its own scroller.
12. **Unbounding a cramped list** gives it room and loses the pager thousands of pixels down. Make
    the chrome cheaper instead, or relax the bound below `lg` and cap the list.
13. **A wrapped grid looks fine on a laptop.** `sm:grid-cols-3` is three STACKED tiles at 360px;
    budget the collapsed form.
14. **Relaxing a client's bound desyncs its skeleton**, which is a different file. Every grid you
    widen does the same. No scanner sees it - each file is internally consistent.

## Ways a pass lies to you

15. **"Whole app done" by module name.** Count files. 94 of 849 files - auth, checkout, error pages,
    shared components - were missed by a "complete" pass.
16. **A check that never fires reads as a clean codebase.** Prove it fires on a known-broken file.
17. **A finding count is not a defect count.** Verify one per category; report the ratio.
18. **Measuring before load finished** reports the skeleton's defects as the page's.
19. **A file that documents a rule is not evidence it applied it** - one shell explained `dvh` at
    length and used `vh`.
20. **A `??` default turns a wrong property name into plausible output.** A typecheck error left
    standing next to another one hid a result PDF showing 0 marks for every subject. Get the
    typecheck to zero so new errors are visible.
21. **A ledger that disagrees with the code** - re-verify it each session before relying on it.
