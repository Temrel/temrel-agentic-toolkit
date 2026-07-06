# model-router (skill)

A model-invoked skill that recommends a model tier (Haiku / Sonnet / Opus) for a task the user is about to start, by scoring it 1–3 on four axes: **scope**, **novelty**, **risk**, and **expected iteration**. The total maps to a tier, with a safety override: any task scoring 3 on risk gets bumped up one tier.

## Why

Model choice is the single biggest cost lever in agentic engineering, and most people pick by habit — the same top-tier model for a rename as for a greenfield system. A cheap, explicit rubric applied at task-start beats vibes: it makes the downgrade decision (most tasks are Sonnet-or-below) as easy as the upgrade one.

The heuristic is deliberately simple for v1. The companion CLI at [`tools/model-router/`](../../../tools/model-router/) calibrates it against your real Claude Code usage data, so you can see where your habits and the rubric disagree.

## Use

Copy this folder into your project's `.claude/skills/` (or reference it from your skills setup). The agent loads it on its own when you describe a task; you can also invoke it explicitly by asking "which model should I use for this".

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
