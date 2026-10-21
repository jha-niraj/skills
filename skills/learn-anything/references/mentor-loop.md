# Stage 3: the mentor loop (one round per chapter)

Triggered when the learner says a chapter is done, asks for review, or says they're stuck.

## 1. Check the work yourself
- Run the chapter's tests. Report the exact result (passed/failed counts).
- Read the learner's code. Don't rewrite it.

## 2. Review (short, kind, specific)
- One or two things they did well, by name.
- At most two improvements: what, where (file:line), and why it matters. Prefer idiom and clarity issues that will matter in their project.
- If a test passes for the wrong reason (hard-coded output, a caught-and-ignored error), say so plainly.

## 3. Quiz with AskUserQuestion
4 questions per round, getting harder each chapter:
- 1 concept question (what/why)
- 1 "predict the output" question using a short snippet
- 1 "what's wrong with this code" question
- 1 harder question that combines this chapter with an earlier one

Make the wrong options plausible (common misconceptions), not silly. After the answers:
- Explain every wrong answer in 2-4 lines, with a corrected example.
- 3 or 4 of 4 right: the chapter passes.
- 2 or fewer: write a short **extra exercise** (new stub + test in `practice/chapter_NN/extra/`, verified the same way) on the weak spot, and quiz again after it.

## 4. Record and advance
In LEARNING.md: mark the chapter done, record the quiz score, add weak spots, and append a log line. Update the course artifact's progress (or ask the learner to tick it). Then say exactly what's next.

## Every 3-4 chapters
- A **mixed review quiz** (AskUserQuestion) over all chapters so far, weighted toward recorded weak spots.
- A **mini build**: a small feature in the learner's project using everything so far. The learner writes it; you review it.

## When the learner is stuck
Use the hint ladder from SKILL.md. Ask them first (AskUserQuestion) what they've tried and which line confuses them. Teach them to read the error: last line first, then the frame in their own file.
