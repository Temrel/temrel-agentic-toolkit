# Model-invoked skills

Skills the agent loads on its own, without being asked. The agent scans each skill's frontmatter `description` and pulls the skill in when the task at hand matches, so the description line carries the triggering: make it precise about what the skill does and when to reach for it.

Skills here need no invocation flags: the default (both user and model can invoke) is right for most. If a skill is pure background knowledge that should never appear in the `/` menu, set `user-invocable: false` in its frontmatter. That flag is Claude Code specific; see the [skills folder convention](../README.md) for the full flag table.

## Items

- [example-skill](./example-skill/) : a stub skill and `SKILL.md` template to copy.
- [model-router](./model-router/) : recommends a model tier (Haiku / Sonnet / Opus) for a task by scoring scope, novelty, risk, and expected iteration; pairs with the [model-router CLI](../../tools/model-router/) for calibration against real usage.
