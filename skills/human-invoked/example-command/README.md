# example-command

**What:** A stub human-invoked skill and `SKILL.md` template you copy to create new slash commands.

**Why:** So a new human-invoked skill starts with `disable-model-invocation: true` already set, keeping the folder convention and the runtime behaviour in agreement.

## How to use it

1. Copy this `example-command/` folder.
2. Rename it to your command's name.
3. Edit `SKILL.md`: set the `name` and `description` in the frontmatter, keep `disable-model-invocation: true`, then write the body.
4. Update this README with your skill's real what, why, and issue link.

See the [skills folder convention](../../README.md) for the full layout and the invocation flag table (the flags are Claude Code specific).

## Introduced in

This template ships with the skills folder split. Future human-invoked skills should link here to the Temrel issue that introduced them.

## Subscribe

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new tool or skill every week.
