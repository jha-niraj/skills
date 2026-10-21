# Artifact guidelines for learning pages

These pages are read slowly and returned to often. Optimise for clarity over decoration.

## Layout
- **Setup Guide:** one long page with a sticky section bar and a progress checklist at the end.
- **Course:** a side rail (chapter list with done ticks and overall progress), one chapter visible at a time, prev/next buttons. Deep-link chapters with a bare `#chapter-3` anchor.
- Readable measure (about 65-70 characters), generous line height, a clear type scale.

## Code
- Every block has a language label and a copy button (`navigator.clipboard.writeText` inside the click handler, falling back to selecting the text).
- Syntax highlighting via highlight.js from cdnjs is fine. Inline the token colours as theme tokens so both themes read well.
- Escape `<`, `>` and `&` inside code blocks.
- Side-by-side comparisons use a 2-column grid that stacks to one column on phones.

## Diagrams
- Mermaid (rendered natively by artifacts) inside a container with a **fixed white background and black text** in both themes.
- In every diagram, set `primaryTextColor`, `textColor` to `#000000` and `edgeLabelBackground` to `#ffffff` in the init block. Give each `classDef` `color:#000000` and a light fill.
- Add a legend when colours carry meaning.

## Interactivity
- Quizzes: buttons per option; on click, lock the question, mark the right answer green and a wrong pick red, and show the explanation.
- Progress: if the `db` capability is available, store `progress/<course-id>` as `{done: {chapterId: true}}` so Claude can read it. Otherwise use localStorage, wrapped in try/catch.

## Content
- Definitions in plain words before any jargon is used.
- Examples from the learner's project domain.
- "This confuses everyone" boxes contain traps you verified by running code.
- No filler copy. Every sentence teaches something or tells the learner what to do.
