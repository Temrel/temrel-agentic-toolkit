# model-router (skill)

A model-invoked skill that recommends a model tier (Haiku / Sonnet / Opus) for a task the user is about to start, by scoring it 1–3 on four axes: **scope**, **novelty**, **risk**, and **expected iteration**. The total maps to a tier, with a safety override: any task scoring 3 on risk gets bumped up one tier.

## Why

Model choice is the single biggest cost lever in agentic engineering, and most people pick by habit — the same top-tier model for a rename as for a greenfield system. A cheap, explicit rubric applied at task-start beats vibes: it makes the downgrade decision (most tasks are Sonnet-or-below) as easy as the upgrade one.

The heuristic is deliberately simple for v1. The companion CLI at [`tools/model-router/`](../../../tools/model-router/) calibrates it against your real Claude Code usage data, so you can see where your habits and the rubric disagree.

## Install

From a clone of this toolkit, copy the skill folder to wherever Claude Code should pick it up.

**Into one project** (checked in with the repo, applies to everyone working in it):

```sh
git clone https://github.com/Temrel/temrel-agentic-toolkit.git
mkdir -p /path/to/your-repo/.claude/skills
cp -r temrel-agentic-toolkit/skills/model-invoked/model-router /path/to/your-repo/.claude/skills/
```

**Globally** (applies to every project on your machine, just for you):

```sh
mkdir -p ~/.claude/skills
cp -r temrel-agentic-toolkit/skills/model-invoked/model-router ~/.claude/skills/
```

Either way, the folder must contain `SKILL.md` directly (i.e. `.claude/skills/model-router/SKILL.md`). No restart needed — the next Claude Code session in scope will see it; verify with `/skills` or by asking "which model should I use for a one-line typo fix?" (expect a Haiku-tier answer in under 15 lines).

## Use

Nothing to invoke day-to-day: the agent loads the skill on its own when you describe a task you're about to start. You can also trigger it explicitly by asking "which model should I use for this".

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
