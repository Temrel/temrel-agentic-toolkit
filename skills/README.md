# Agent skills

One of the six elements of agentic engineering. A **skill** is a reusable, self-contained capability you hand to an agent: a focused set of instructions (and optionally scripts or resources) that the agent loads when a task calls for it. Skills keep your base context lean by moving specialised know-how out of the always-on prompt and into something the agent pulls in on demand.

## Folder convention

Each skill is its own folder under `skills/`, and every skill folder contains a `SKILL.md`:

```
skills/
  your-skill/
    SKILL.md      # YAML frontmatter (name + description) then the skill body
    README.md     # what, why, link back to the Temrel issue, subscribe link
```

The `SKILL.md` starts with YAML frontmatter holding a `name` and a one-line `description` (the description is what an agent reads to decide whether the skill is relevant), followed by a short body of instructions.

## Add a skill by copying the template

The fastest way to start is to copy [`example-skill/`](./example-skill/), rename the folder, and edit its `SKILL.md`. The template is intentionally minimal so you can drop in a new skill in minutes.

## Items

- [example-skill](./example-skill/) : a stub skill and `SKILL.md` template to copy.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md). One genuinely useful item beats four toys.

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
