# Stage 2: the Course

## 1. Propose the outline first
- Draft 8-14 chapters ordered so that each builds on the last, each tied to a piece of the learner's project. The last chapter is a capstone that becomes the first milestone of Stage 4.
- Show the outline as a table (chapter, what you learn, what you build in practice, estimated time from their weekly budget).
- Ask with AskUserQuestion: approve, reorder, add or drop topics. Build nothing until it's approved.

## 2. The Course artifact
One page, with lesson navigation (a side rail on desktop, a select on phones), one chapter visible at a time, and progress per chapter. Every chapter has these parts, in order:

1. **Why this matters for your project**: 2-3 lines tying it to their project.
2. **Concepts with definitions**: each new term is named, defined in plain words, and added to the page glossary.
3. **Side by side**: the same idea in the language they know and in the new one.
4. **Code examples**: short, runnable, using their project's domain, with a copy button and a language label. Each one has a "what it does" line before it and the output after it.
5. **This confuses everyone**: 2-4 real traps (verify them by running the code, not from memory).
6. **Quick check**: 3-5 multiple-choice questions on the page, with an explanation for both right and wrong answers.
7. **Practice box**: the folder to open, the functions to write, and the exact test command.
8. **Mark done** button.

Diagrams: white sheet, black text, light fills, labels on arrows. Use them for flows and structures, not decoration.

## 3. Practice files
For each chapter, create `practice/chapter_NN/` in the learning project with:
- **Stubs**: real signatures, a docstring or comment that states the task, 1-2 examples and a hint naming the feature to use, and a body that fails loudly (the language's "not implemented" error).
- **Tests**: the spec, with realistic data from the learner's project. Cover the normal case, an edge case (empty, zero, unicode) and an error case.
- One chapter around the middle should include **a file with real bugs** for the learner to find from failing tests and the stack trace. A later chapter should flip the roles: code with hidden bugs, and the **learner writes the tests** that catch them.

Verify every chapter before handing it over:
1. Write a correct reference solution in a scratch location.
2. Run the tests and confirm they pass.
3. Restore the stubs and confirm the tests fail.
4. Delete the reference solution completely. Never leave answers on disk.

Keep the practice folder out of the default test run if the language allows it (so unfinished chapters don't break the main suite), and say how to run one chapter.

## 4. Hand-over
Record the artifact URL, the chapter list and practice paths in LEARNING.md, set `stage: 3-mentor`, `current_chapter: 1`, and tell the learner exactly how to start chapter 1.
