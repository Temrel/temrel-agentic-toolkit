<p align="left">
  <a href="https://spark.temrel.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/temrel-logo-white.svg">
      <img src="./assets/temrel-logo-blue.svg" alt="Temrel" width="340">
    </picture>
  </a>
</p>

# The Agentic Toolkit

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A growing, curated collection of small, practical tools and agent skills for **agentic engineering**: the craft of shipping real, production software with AI coding agents (Claude Code, Cursor, and similar).

Agentic engineering has six core elements, and this repo is organised by them: context engineering, tools and tool design, agent skills, evals and verification, orchestration and multi-agent workflows, and guardrails and security. Context engineering is just one of these elements, not the whole picture.

This is the companion asset to [Temrel](https://spark.temrel.com), a weekly newsletter. The newsletter is the "why", this repo is the "what".

## The six elements

| Folder | Element | What lives here |
| --- | --- | --- |
| [`context/`](./context/) | Context engineering | Tools for shaping what an agent knows |
| [`tools/`](./tools/) | Tools and tool design | Tool-design helpers, MCP servers |
| [`skills/`](./skills/) | Agent skills | Reusable Claude skills, split by invoker: `model-invoked/` and `human-invoked/` |
| [`evals/`](./evals/) | Evals and verification | Eval harnesses, verification utilities |
| [`orchestration/`](./orchestration/) | Orchestration and multi-agent workflows | Multi-agent and workflow helpers |
| [`guardrails/`](./guardrails/) | Guardrails and security | Sandboxing, approval gates, security checks |

## Index of items

| Item | Type | Description | Link |
| --- | --- | --- | --- |
| context-linter | tool | Paste a CLAUDE.md or any agent context file and get a bloat score, token estimate, and line-referenced trim suggestions. Runs fully in your browser. | [open](./context/context-linter/) |
| verification-starter | starter kit | A copy-me verification layer for agent-written code: deterministic gates, an LLM-as-judge diff review against stated intent, and a 20-case eval harness, in dependency-free shell. Includes a browser config generator. | [open](./evals/verification-starter/) |

## Star this repo

If any of this is useful, please **star the repo**. It is the single most helpful thing you can do: it tells us which elements to build out next, and it helps other engineers find the toolkit.

## Subscribe

One item is added here per newsletter issue, with the full reasoning in the issue itself.

**[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit)** to get the next one, plus the thinking behind it.

## How this grows

This repo expands one item at a time. Every week, a Temrel issue introduces exactly one new tool or skill and that item lands here as a self-contained folder under the element it belongs to. Slow, curated, and practical, rather than a dumping ground. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the model and how to add your own.

## License

[MIT](./LICENSE). Copyright (c) 2026 Temrel Ltd.
