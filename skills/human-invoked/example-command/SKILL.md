---
name: example-command
description: A copy-me template for a human-invoked skill. Replace this with a one-line summary of what running /your-command does.
disable-model-invocation: true
---

# Example command

This is a template for a human-invoked skill. Copy this folder, rename it, and edit the frontmatter and body below to create a real slash command. Keep `disable-model-invocation: true`: it is what stops the agent from running this skill on its own (Claude Code only; other harnesses ignore it).

## What running this does

State in a sentence what happens when a human types `/your-command`. Because the human has already declared intent by invoking it, you do not need to describe triggers; go straight to the procedure.

## Instructions

Write the procedure here, as direct instructions to the agent. A good human-invoked skill body:

1. States the goal in a sentence.
2. Lists the steps to follow, in order.
3. Says what to do with arguments, if the command takes any.
4. Defines what "done" looks like, so the agent knows when to stop.

Keep it short and procedural. The skill only runs when explicitly asked for, so it can be more prescriptive than a model-invoked skill.

## Example

Show one small, concrete example of the command being run and the correct result.
