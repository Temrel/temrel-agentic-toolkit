# Tools and tool design

One of the six elements of agentic engineering. This is about the **functions an agent can call** and how well they are designed: the names, descriptions, inputs, and outputs that determine whether an agent can actually use a capability. A good tool is discoverable, hard to misuse, and gives the agent feedback it can act on.

## What belongs here

Tool-design helpers, MCP servers, schema generators, tool-description linters, and reference implementations of well-designed tools.

## Items

- [model-router](./model-router/) : a read-only CLI that analyses your local Claude Code transcripts — per-model/per-session cost report, an overkill audit for Opus-tier sessions, and calibration of the [model-router skill](../skills/model-invoked/model-router/)'s routing heuristic against your real usage.
- [mcp-spec-audit](./mcp-spec-audit/) : a static scanner that audits an MCP server codebase ahead of the MCP 2026-07-28 stateless spec revision and emits a migration checklist grouped by severity; pairs with the [mcp-spec-audit skill](../skills/model-invoked/mcp-spec-audit/) so an agent can run the audit and summarize it.

## Contributing

Have a tool-design helper or an MCP server worth sharing? See [CONTRIBUTING.md](../CONTRIBUTING.md). One genuinely useful item beats four toys.

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
