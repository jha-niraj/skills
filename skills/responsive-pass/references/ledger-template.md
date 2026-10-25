# Ledger template

The ledger records which modules are passed, what changed, and what still needs a human at 360x640.
The rules live in the skill; the ledger is only the record. One ledger per app when apps differ in
priority (a phone-only portal and a laptop-first staff app fail in different ways). Re-verify the
ledger's claims against the code at the start of each session - a ledger that disagrees with the
code costs more than none, because the reader stops checking.

Copy below into `<plan or docs folder>/responsive-pass-ledger.md`.

```markdown
# Responsiveness pass - <app>

Rules: <path to this skill or the project's responsiveness doc>. This file is the LEDGER only.

How to use: work down a module's "Check by hand" list at 360 x 640 in an iframe. Tick in place;
add findings under "Found in manual pass" with measurements.

## Status

| # | Module | Files scanned / total | Files changed | Automated pass | Manual pass | Notes |
|---|---|---:|---:|---|---|---|
| 1 | <module> | 33 / 33 | 9 | Done x2 | [ ] | |

Coverage: **<scanned> of <total> `.tsx` files** (`find <app> -name '*.tsx' ...`). Typecheck: <run
and clean | not run, why>. Trap check (brace/paren balance vs HEAD): <passed on N files>.

Out of scope by decision: <app or module, reason>.

## Coverage by area

| area | files | changed |
|---|---:|---:|
| `components/` | 56 | 12 |

## Shared primitives changed

Changes here affect every module; regressions show up far from where they were introduced.
- `<path>` - <what changed and why>

## Scan calibration

| category | raw | real | note |
|---|---:|---:|---|

Verified false positives (do not re-flag): `<file:line>` - <why it is correct>.

---

## <N>. <Module>

<files changed> of <files>. <passes>. <commit or "uncommitted">.

### What was changed
- <defect, measured, and the fix> - e.g. "4-button footer (~600px on a 328px line) -> two rows below sm"

### Check by hand
- [ ] <specific, observable check on a named surface>

### Known and deliberately not fixed
- <item> - <why, and what it would take>

### Found in manual pass
_(nothing recorded yet)_ | **Done <date>.** <N> routes measured at 360x640. <defects with
measurements, fixed and re-measured>. Clean: <routes>.
```

## Writing good entries

- Lead each "what was changed" line with the symptom a user would see, then the number.
- "Check by hand" items name a surface and an observable outcome ("open the add-holiday sheet; Save
  stays visible while the form scrolls"), never a rule ("check sheets").
- Record shortfalls honestly: "icon controls are 40px, 4px under the floor" - not "tap targets fixed".
- Record reverted changes and why (a skeleton converted, then reverted because its client had no
  strip).
- Record false readings too ("clipped 1391px" was the skeleton, measured before load finished).
