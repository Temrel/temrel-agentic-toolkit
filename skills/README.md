# Agent skills

One of the six elements of agentic engineering. A **skill** is a reusable, self-contained capability you hand to an agent: a focused set of instructions (and optionally scripts or resources) that the agent loads when a task calls for it. Skills keep your base context lean by moving specialised know-how out of the always-on prompt and into something the agent pulls in on demand.

## Folder convention

Skills are split at the top level by **who invokes them**:

- [`model-invoked/`](./model-invoked/) : skills the agent loads on its own. The agent reads the `description` in the skill's frontmatter and pulls the skill in when a task matches. You never type anything; a good description is what makes these fire.
- [`human-invoked/`](./human-invoked/) : skills a person triggers explicitly, typically as a slash command (`/your-skill`). These can assume clear intent, so their descriptions matter less and their bodies can be more procedural.

The same skill format works in both places; the folder tells you (and contributors) which invocation style it is designed for.

Each skill is its own folder under one of those two, and every skill folder contains a `SKILL.md`:

```
skills/
  model-invoked/
    your-skill/
      SKILL.md      # YAML frontmatter (name + description) then the skill body
      README.md     # what, why, link back to the Temrel issue, subscribe link
  human-invoked/
    your-command/
      SKILL.md
      README.md
```

The `SKILL.md` starts with YAML frontmatter holding a `name` and a one-line `description` (for model-invoked skills, the description is what an agent reads to decide whether the skill is relevant), followed by a short body of instructions.

## Invocation flags (Claude Code specific)

The folders are the signpost; frontmatter flags are the enforcement. Claude Code supports two `SKILL.md` frontmatter fields that control who can invoke a skill:

| Frontmatter | User can invoke | Model can invoke |
| --- | --- | --- |
| (default) | Yes | Yes |
| `disable-model-invocation: true` | Yes | No |
| `user-invocable: false` | No | Yes |

The convention in this repo:

- Skills under `human-invoked/` **must** set `disable-model-invocation: true`. This removes the skill's description from the model's context entirely, so the agent cannot trigger it on its own, but it stays available as a slash command (`/your-skill`).
- Skills under `model-invoked/` may additionally set `user-invocable: false` if they are background knowledge that should never appear in the `/` menu. Most should leave it unset so humans can still invoke them directly.

Note that these flags are **Claude Code specific**. Other harnesses (the Agent SDK, Cursor, and similar) do not honour them, so a human-invoked skill dropped into another tool may become model-invocable there. The folder placement is the portable signal of intent; the flag is what makes Claude Code actually enforce it. See the [Claude Code skills reference](https://code.claude.com/docs/en/skills) for the full frontmatter field list.

## Add a skill by copying a template

Copy the template that matches your invocation style, rename the folder, and edit its `SKILL.md`:

- Model-invoked: copy [`model-invoked/example-skill/`](./model-invoked/example-skill/).
- Human-invoked: copy [`human-invoked/example-command/`](./human-invoked/example-command/), which already sets `disable-model-invocation: true`.

Both templates are intentionally minimal so you can drop in a new skill in minutes.

## Items

- [model-invoked/example-skill](./model-invoked/example-skill/) : a stub skill and `SKILL.md` template to copy.
- [human-invoked/example-command](./human-invoked/example-command/) : a stub slash-command skill with `disable-model-invocation: true` pre-set.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md). One genuinely useful item beats four toys.

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
