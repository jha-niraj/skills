# Stage 1: the Setup Guide

Goal: the learner installs the toolchain and builds the project skeleton **themselves**, understanding every file and command. You write no code into their project in this stage. You explain, they type, you check.

## Before writing anything
- Look up the current official install instructions and the latest stable version for their OS (Context7 MCP, or the official docs). Write down the version the course targets.
- Check what's already installed on their machine with read-only commands (e.g. `go version`, `which rustc`) and mention what you found.

## The Setup Guide artifact: sections in this order
1. **What you're about to install, and why:** a toolchain map. Compare each piece with the learner's known ecosystem in a table (e.g. `go.mod` ↔ `package.json`, `go run` ↔ `pnpm exec tsx`).
2. **How the pieces fit:** one flowchart (white sheet, black text) from "source file" to "running program", naming compiler/interpreter, package manager, build output and test runner.
3. **Install, step by step** for their exact OS. Each step has: the command (copy button), what it does in one line, the command that verifies it worked, and the expected output.
4. **Create the project by hand:** the folder layout as a tree, then each file to create, with an explanation of what goes in it and why. Describe what to write; don't paste a finished file unless it's pure boilerplate the learner can't reasonably derive (e.g. a generated config). The learner writes hello-world and one passing test following the explanation.
5. **Editor setup:** the official extension, format-on-save, how to run a test from the editor.
6. **Common errors:** 4-6 real errors people hit during setup, each with what it means and the fix.
7. **Glossary:** every new term on the page, one or two lines each.
8. **Setup checklist** with progress the learner can tick.

## While the learner works
- They paste output or say "done with step N". Verify by reading files and running read-only commands; don't redo their work.
- When something fails, read the error with them: last line first, then the frame in their code (teach the habit).

## Gate
1. The learner runs hello-world and one test, and pastes the output.
2. Run a 4-question setup quiz with AskUserQuestion: what each tool does, one "predict the output" question, one "what went wrong" question.
3. On a pass (3 of 4 or better), record the stage done in LEARNING.md and move to Stage 2. On a miss, explain the wrong answers and ask 2 new questions on the same ideas.
