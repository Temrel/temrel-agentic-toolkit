# context-linter

**What:** A browser tool that scores an agent context file (CLAUDE.md, system prompt, instruction file) for bloat and tells you exactly what to cut.

**Why:** Agent context is re-read on every turn, so dead weight costs tokens and quietly degrades behaviour. A quick lint keeps your context lean and honest.

## What it does

Paste a context file and it computes, all locally in your browser:

- An **estimated token count** (heuristic: roughly characters / 4) and an **approximate input cost** across a few models.
- A **0 to 100 bloat score** built from detectable signals: total size versus a healthy band, duplicated lines and sections, stale markers (old dates, TODO, deprecated, temporary), and over-long preambles.
- **Specific, line-referenced findings**: what to cut and why, each tagged with the lines it points at.
- A **one-line trim summary** with the projected token saving if you act on the findings.

## Privacy

Your file never leaves your browser. There is no backend and no upload: all analysis runs in client-side JavaScript. That is the whole point, so you can safely paste a real, private CLAUDE.md.

## Run it

- Hosted: open it via the toolkit's GitHub Pages site.
- Locally: open `index.html` in any browser. No build step, no dependencies, no server.

## Notes and limits

Token counts are estimates, not an exact tokenizer result, and model prices are approximate and change over time. Treat both as guidance for relative comparisons, not billing.

## Introduced in

The first item in The Agentic Toolkit, shipped with the initial scaffold. Back to the repo: [temrel-agentic-toolkit](https://github.com/temrel/temrel-agentic-toolkit).

## Subscribe

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new agentic-engineering tool or skill every week.
