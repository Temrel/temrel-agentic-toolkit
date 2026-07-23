---
name: mcp-spec-audit
description: Audit an MCP server codebase for the MCP 2026-07-28 stateless spec revision by running the mcp-spec-audit CLI and summarizing its findings. Use when the user asks to audit, check, or migrate an MCP server for the new spec, asks whether their server is ready for MCP 2026-07-28 or "the stateless revision", or mentions migrating off Roots, Sampling, protocol Logging, or the experimental Tasks API.
---

# MCP spec audit

Run the static scanner over an MCP server codebase, then turn its findings into a prioritized migration summary.

## Steps

1. Locate the CLI. Try `mcp-spec-audit --version` first (it may be npm-linked). If absent, run it from a clone of the agentic toolkit:

   ```sh
   cd <toolkit>/tools/mcp-spec-audit && npm install && npm run build
   node dist/index.js <path-to-server>
   ```

2. Run the audit against the server root the user pointed at, with `--json` for parsing plus the default markdown report:

   ```sh
   mcp-spec-audit <path> --json --report mcp-spec-audit-report.md
   ```

   Exit code 1 means BREAKS findings exist; 0 means none; 2 means the scan itself failed.

3. Read the JSON. Each finding has `ruleId`, `severity` (`breaks` / `deprecated` / `advisory`), `file`, `line`, `message`, `replacement`, and `specLink`.

## Summarize for the user

- Lead with the verdict: ready, or not, and the count per severity.
- BREAKS first: experimental 2025-11-25 Tasks API usage that must move to the graduated lifecycle (`tasks/get`, `tasks/update`, `tasks/cancel`). These block adoption of the new revision.
- DEPRECATED next: Roots, Sampling, and protocol-level Logging keep working for 12 months. Name the replacement per finding (tool parameters or config; direct LLM provider calls; stderr or OpenTelemetry).
- ADVISORY last: session-state assumptions, legacy auth, SDK v2 renames and package splits, uncached `tools/list`. Frame these as cleanup that the stateless revision makes possible or the SDKs will force at upgrade time.
- Cite findings as `file:line` and point the user at `mcp-spec-audit-report.md` for the full checklist.
- Suggest a migration order: breaks, then deprecated, then advisory; within a group, protocol changes before SDK renames.

## Cautions

- The scanner is regex-based and conservative; treat `advisory` findings worded with "if this is MCP..." as candidates to verify by reading the flagged line before asserting them.
- Do not edit the user's code as part of the audit. Offer to fix findings as a separate step.
- Do not invent spec details beyond what the report's spec links say.
