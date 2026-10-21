# skills

Agent skills by [@jha-niraj](https://github.com/jha-niraj).

| Skill | What it does |
|---|---|
| [`learn-anything`](skills/learn-anything/SKILL.md) | A personal mentor for learning any language or tool by building. It interviews you, writes a setup guide you follow yourself, then a chapter-by-chapter course with quizzes and practice files with failing tests. It reviews your code after every chapter and tracks progress in `LEARNING.md`. |

## Install

With the [skills CLI](https://github.com/vercel-labs/skills):

```bash
# into the current project
npx skills add jha-niraj/skills --skill learn-anything -a claude-code

# for every project (global)
npx skills add jha-niraj/skills --skill learn-anything -a claude-code -g
```

Then, in Claude Code:

```
/learn-anything golang
```

## How learn-anything works

1. **Interview:** your background, goal, a project to learn through, your time and your machine.
2. **Setup Guide:** an artifact that explains the toolchain and the project layout. You install and scaffold everything yourself.
3. **Course:** an approved chapter outline, then a course artifact with definitions, side-by-side comparisons with what you already know, examples, common traps and quizzes, plus `practice/chapter_NN/` folders with failing tests.
4. **Mentor loop:** after each chapter, Claude runs your tests, reviews your code and quizzes you, a little harder each time.
5. **Build:** your own project, milestone by milestone, with Claude as reviewer.

## License

MIT
