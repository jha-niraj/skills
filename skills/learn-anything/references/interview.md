# Stage 0: the interview

Goal: enough about the learner to shape every later page. All of this is asked with AskUserQuestion, in 2-3 calls of up to 4 questions each. Offer sensible options and let "Other" catch the rest.

## Call 1: who and what
1. **What do you want to learn?** Confirm the exact target and scope (e.g. "Go, for backend services" vs "Go, for CLIs").
2. **What do you already know well?** Languages, frameworks. This picks the comparison language for every side-by-side.
3. **Why?** Job, a specific project, curiosity, an interview. This sets the depth and which topics come first.
4. **Your level with this topic:** never touched it / read some / used it a little / used it but with gaps.

## Call 2: how
1. **A project to learn through.** Offer 2-3 small, real projects that fit their goal (e.g. for Go: a URL shortener API, a CLI that renames files, a log parser), or their own idea. Every example and exercise will use this project's domain.
2. **Time per week:** under 3 h / 3-6 h / 6-10 h / more.
3. **Machine:** macOS (Apple Silicon or Intel) / Linux / Windows (WSL or native). This decides the install steps.
4. **Editor:** VS Code / JetBrains / Vim or Neovim / other.

## Call 3 (only if needed): style
- Theory-first or example-first.
- Quiz difficulty: gentle / honest / tough.
- Where the learning project should live (absolute path).

## After the interview
1. Summarise the profile back in 5-6 lines and ask (AskUserQuestion) for confirmation or corrections.
2. Create the learning project folder if it doesn't exist (this is the only thing you create in Stage 0).
3. Write `LEARNING.md` with the profile, `stage: 1-setup`, and an empty log (see `progress-file.md`).
