# skills

Agent skills by [@jha-niraj](https://github.com/jha-niraj).

| Skill | What it does |
|---|---|
| [`learn-anything`](skills/learn-anything/SKILL.md) | A personal mentor for learning any language or tool by building. It interviews you, writes a setup guide you follow yourself, then a chapter-by-chapter course with quizzes and practice files with failing tests. It reviews your code after every chapter and tracks progress in `LEARNING.md`. |
| [`app-speed`](skills/app-speed/SKILL.md) | Fast navigation and sign-in / sign-out for a Next.js App Router app (tested on Cloudflare Workers + OpenNext + better-auth): shell prefetch on intent, a staggered sidebar prefetch queue, a GET read route instead of serialised Server Actions, cookie-only middleware, a real landing shell after sign-in, sign-out answered before the framework. Ships a navigation benchmark script. |
| [`query-and-render-speed`](skills/query-and-render-speed/SKILL.md) | Server-rendered pages that load fast: fewer sequential database round trips, batching, no N+1 loops, one Suspense boundary per block with the header above it, and the right way to hand data to each block (server component, `use()` promise, TanStack seeding). |
| [`responsive-pass`](skills/responsive-pass/SKILL.md) | A responsiveness pass over a whole app: bounded page heights, no sideways overflow, tables and toolbars on a phone, sheets, tap targets, a scan by file count with known false-positive rates, and a manual pass at 360x640 in an iframe. |
| [`page-layout`](skills/page-layout/SKILL.md) | One layout grammar for data-heavy apps: no edge-to-edge pages, title left and tabs right, one stat band, charts only where a page answers "how is this going", tables with a sticky header in a ~10-row scroll area, list items edited in a right sheet that swaps instead of closing, popovers for routine confirms. |

## Install

With the [skills CLI](https://github.com/vercel-labs/skills):

```bash
# into the current project
npx skills add jha-niraj/skills --skill learn-anything -a claude-code

# for every project (global)
npx skills add jha-niraj/skills --skill learn-anything -a claude-code -g
```

Any other skill installs the same way, e.g. `--skill app-speed`. To track this repo locally instead, symlink a
skill folder into `~/.claude/skills/` (that is how the author installs them, so edits apply at once).

Then, in Claude Code:

```
/learn-anything golang
```

## How the build skills work

`app-speed`, `query-and-render-speed`, `responsive-pass` and `page-layout` share one routine:

1. **Ask** whether to map the codebase first (whole codebase, one app, one page, or skip).
2. **Map, read-only,** into a map file: each rule, what the code does today (file:line), `ok` / `gap` /
   `differs - decision needed`.
3. **Question the playbook** where the codebase reasonably differs, then ask every decision with tickable options.
4. **Plan file** with tasks that are ticked only with a `Verified:` line.
5. **Build in waves** (parallel subagents on separate files, one typecheck per wave).
6. **Verify or measure** and say plainly what was not verified.

They were learned on a real product (a school management app) and use its components as worked examples; in your
codebase the map finds the equivalents, or the skill builds the missing piece in your shared UI package first.

## How learn-anything works

1. **Interview:** your background, goal, a project to learn through, your time and your machine.
2. **Setup Guide:** an artifact that explains the toolchain and the project layout. You install and scaffold everything yourself.
3. **Course:** an approved chapter outline, then a course artifact with definitions, side-by-side comparisons with what you already know, examples, common traps and quizzes, plus `practice/chapter_NN/` folders with failing tests.
4. **Mentor loop:** after each chapter, Claude runs your tests, reviews your code and quizzes you, a little harder each time.
5. **Build:** your own project, milestone by milestone, with Claude as reviewer.

## License

MIT
