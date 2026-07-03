# Human-invoked skills

Skills a person triggers explicitly, typically as a slash command (`/your-skill`). Because the human has already declared intent by invoking it, the frontmatter description matters less here; the body can be more procedural and assume the skill is wanted.

Every skill in this folder **must** set `disable-model-invocation: true` in its `SKILL.md` frontmatter. In Claude Code, that removes the skill's description from the model's context so the agent cannot trigger it on its own; only the slash command runs it. This flag is Claude Code specific: other harnesses ignore it, which is why the folder placement exists as the portable signal of intent. See the [skills folder convention](../README.md) for the full layout and flag table.

## Items

- [example-command](./example-command/) : a stub slash-command skill and `SKILL.md` template to copy, with `disable-model-invocation: true` pre-set.
