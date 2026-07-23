# mcp-spec-audit (skill)

A model-invoked skill that wraps the [mcp-spec-audit CLI](../../../tools/mcp-spec-audit/): the agent runs the static scan over an MCP server codebase, reads the JSON findings, and reports a prioritized migration summary (BREAKS, then DEPRECATED, then ADVISORY) with `file:line` citations and a pointer to the generated markdown checklist.

## Why

The MCP 2026-07-28 revision moves the protocol to a stateless core: the initialize handshake and `Mcp-Session-Id` are removed, the experimental Tasks API graduates with a changed lifecycle, and Roots, Sampling, and protocol-level Logging enter a 12-month deprecation window. "Is my server ready?" is exactly the kind of question an agent should answer with a tool run rather than from memory: the scanner produces evidence, and the skill turns that evidence into a plan.

## Install

The skill shells out to the CLI, so build that first (see the [CLI README](../../../tools/mcp-spec-audit/)), ideally with `npm link` so `mcp-spec-audit` is on your PATH. Then copy the skill folder to wherever Claude Code should pick it up.

**Into one project** (checked in with the repo, applies to everyone working in it):

```sh
git clone https://github.com/Temrel/temrel-agentic-toolkit.git
mkdir -p /path/to/your-repo/.claude/skills
cp -r temrel-agentic-toolkit/skills/model-invoked/mcp-spec-audit /path/to/your-repo/.claude/skills/
```

**Globally** (applies to every project on your machine, just for you):

```sh
mkdir -p ~/.claude/skills
cp -r temrel-agentic-toolkit/skills/model-invoked/mcp-spec-audit ~/.claude/skills/
```

Either way, the folder must contain `SKILL.md` directly (i.e. `.claude/skills/mcp-spec-audit/SKILL.md`). No restart needed; verify with `/skills` or by asking "is my MCP server ready for the 2026-07-28 spec?".

## Use

Ask anything like "audit this MCP server for the new spec", "are we ready for the stateless MCP revision?", or "what do we need to migrate off Sampling?". The agent runs the scan and summarizes; the full checklist lands in `mcp-spec-audit-report.md`.

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
