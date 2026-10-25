# The manual pass at 360 x 640

The automated pass finds what markup reveals. The manual pass finds the rest: a list given 0px by
chrome that only adds up at runtime, a header button at x=355..545, badges whose ink and ground are
the same colour. In one app the manual pass over 24 "already passed" routes found 12 more defects.

## Why 360, not 390

The extra 30px hides a whole class of overflow: step indicators, three-button footers and seven-tab
strips that fit 390 and not 360. Measure at 360 x 640; add 390 x 844 beside it when the user's real
devices are larger.

## Never resize the user's browser

Resizing their window disrupts their own browsing and other sessions' tabs. Instead:

1. Open a NEW tab on the app's origin (a dev server the user runs, or one you started with
   permission). Any same-origin page works as the host, e.g. `/`.
2. Replace its body with phone-sized iframes (same origin, so you can measure inside them):

```js
document.body.innerHTML = `
  <div style="display:flex;gap:24px;padding:16px;background:#ddd;align-items:flex-start">
    <iframe id="p360" src="/students" style="width:360px;height:640px;border:0;background:#fff"></iframe>
    <iframe id="p390" src="/students" style="width:390px;height:844px;border:0;background:#fff"></iframe>
  </div>`;
```

3. Screenshot the tab. To switch route, set `document.getElementById('p360').src = '/next'`.
4. If screenshots are unavailable, every figure comes from the measurement script below - say so.
5. No browser tools at all: hand the user the iframe snippet and the measurement script to paste in
   devtools, and record the pass as not run.

Do not test an authenticated page by putting a password or cookie in a command or a file. Use the
session the user is already signed in with in that browser.

## Wait before measuring

Measure only after `iframe.contentDocument.readyState === 'complete'` AND the skeleton has gone
(no `[aria-busy="true"]`, no `.animate-pulse` in the main region). Two "defects" in one pass were the
loading screen: a vendors page "clipped 1391px" was its skeleton, and a 21px clip did not reproduce.

## Measurement script

Run inside the iframe's window (`const w = document.getElementById('p360').contentWindow`):

```js
(() => {
  const d = w.document, W = w.innerWidth, out = { route: w.location.pathname };
  // 1. Page-level sideways scroll
  out.docOverflowX = d.documentElement.scrollWidth - d.documentElement.clientWidth;
  // 2. Elements extending past the right edge, split by whether an ancestor really scrolls
  const scrollsX = el => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = w.getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true;
    }
    return false;
  };
  const off = [];
  d.querySelectorAll('button, a, input, select, [role="tab"], h1, h2, table').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > W + 1) off.push({
      tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 40),
      x: Math.round(r.left) + '..' + Math.round(r.right), inScroller: scrollsX(el) });
  });
  out.offscreen = off.filter(o => !o.inScroller);       // real defects
  out.offscreenInScroller = off.filter(o => o.inScroller).length; // fine: reachable by scrolling
  // 3. Content clipped by overflow-hidden boxes (bounded roots)
  out.clipped = [...d.querySelectorAll('*')].filter(el => {
    const s = w.getComputedStyle(el);
    return s.overflowY === 'hidden' && el.scrollHeight - el.clientHeight > 4 && el.clientHeight > 100;
  }).slice(0, 5).map(el => ({ cls: el.className.toString().slice(0, 60),
    clippedPx: el.scrollHeight - el.clientHeight }));
  // 4. Tap targets under 44px (visual box; an ::after expansion will not show here - read those)
  out.smallTargets = [...d.querySelectorAll('button, a[href], [role="button"]')].filter(el => {
    const r = el.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44);
  }).length;
  return out;
})();
```

Read the result:
- `docOverflowX > 0` - the page moves sideways. Find the widest descendant, not the root.
- `offscreen` - controls past the right edge with no scrolling ancestor: unreachable. A 760px table
  in its own horizontal scroller lands in `offscreenInScroller` and is fine.
- `clipped` on a bounded root - a list or panel given less room than its content with no scroller
  (one payroll page clipped 1494px).
- `smallTargets` is a lead, not a verdict: hit-area pseudo-elements do not change the measured box.

## Then look - the checks a script cannot make

For each route, at 360px, in the populated state:
- [ ] The page does not move sideways when dragged.
- [ ] 4-6 list rows are visible before the list's own scroller engages; pagination is reachable.
- [ ] Every action in the header and footer is reachable, the primary inline, the rest in one menu.
- [ ] The phone toolbar is one row: search plus one menu/filter button.
- [ ] Tabs: switch tabs after scrolling down - the strip is still reachable.
- [ ] Open each sheet: a strip of page shows; the footer stays pinned while the form scrolls; you
      can submit without scrolling to find the button.
- [ ] The detail page is reachable from the row's name.
- [ ] Every capped list scrolls to its true bottom - if it stops mid-row with no scrollbar, a cap is
      on a ScrollArea Root.
- [ ] Reload: the page does not resize when data replaces the skeleton.
- [ ] Every badge and icon is visible (same-colour ink and ground renders empty) - in light and dark.
- [ ] Charts: legend above the plot, axis labels present and legible.
- [ ] Long names, 8+ digit money figures and long labels: name truncates, money does not.
- [ ] With browser chrome showing (real phone or a devtools device frame), the bottom edge of the
      shell and the last row are not under the URL bar.

Empty tables hide most defects. If a detail route cannot be reached because a table is empty, ask
before seeding; seed only a dev database, with an idempotent script and an obvious prefix.

## Record

Per route: clean, or each defect with the measurement (`clipped 129px`, `"Send" at x=355..545`), the
cause, the fix, and the re-measurement after the fix. Add these under the module's "Found in manual
pass" in the ledger.
