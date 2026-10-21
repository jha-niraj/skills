# LEARNING.md: the progress file

Lives at the root of the learning project. Plain Markdown so the learner can read and edit it too. Keep it short; it's a state file, not a diary.

```markdown
# Learning: <topic>

## Profile
- Goal: <why they're learning it>
- Knows: <languages/tools used for comparisons>
- Level at start: <level>
- Project: <the project they learn through>
- Time: <hours per week>
- Machine / editor: <OS> / <editor>
- Style: <theory-first or example-first>, quizzes <gentle|honest|tough>
- Target version: <e.g. Go 1.25.x, verified YYYY-MM-DD>

## State
- stage: <0-interview | 1-setup | 2-course | 3-mentor | 4-build | 5-next>
- current_chapter: <n or ->
- next_step: <one concrete action for the learner>

## Artifacts
- Setup Guide: <url>
- Course (level 1): <url>

## Chapters
| # | Title | Practice | Status | Quiz |
|---|---|---|---|---|
| 1 | ... | practice/chapter_01 | done | 4/4 |
| 2 | ... | practice/chapter_02 | in progress | - |

## Weak spots
- <concept>: <what went wrong, date>

## Log
- YYYY-MM-DD: <one line: what was done, what's next>
```

Rules:
- Update `State` whenever it changes, and add one `Log` line per session.
- Remove a weak spot once a later quiz shows it's fixed.
- Never store secrets or personal data beyond what the learner chose to share.
