# mcp-spec-audit (CLI)

Audit an MCP server codebase before the MCP 2026-07-28 spec revision lands. `mcp-spec-audit <path>` statically scans the code, classifies every finding as **BREAKS**, **DEPRECATED**, or **ADVISORY**, and writes a markdown migration checklist with file:line references, each finding linking to the relevant spec material.

It pairs with the [mcp-spec-audit skill](../../skills/model-invoked/mcp-spec-audit/): the skill lets an agent run the audit for you and summarize the findings; the CLI is the scanner itself, usable standalone or in CI.

**Guarantees:** pure static analysis. No network calls, no code execution, and it never modifies the scanned codebase.

## Why: the stateless core

The [2026-07-28 release candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) reshapes MCP around a stateless core. The `initialize` handshake and the `Mcp-Session-Id` header are gone, so any request can land on any server instance and sticky routing or shared session stores are no longer needed. The experimental 2025-11-25 Tasks API graduates with a changed lifecycle (`tasks/get`, `tasks/update`, `tasks/cancel`; `tasks/list` is removed). Roots, Sampling, and protocol-level Logging are deprecated with a 12-month window. Authorization is hardened around OAuth 2.1, and `tools/list` responses gain `ttlMs` and `cacheScope` so clients can cache. Servers written against earlier revisions or SDK v1 will keep working for a while, but the migration is real work, and it is cheaper to find the sites now than after the window closes.

## What it checks

| Severity | Meaning | Rules cover |
| --- | --- | --- |
| BREAKS | Will not work against 2026-07-28; exit code 1 | Experimental 2025-11-25 Tasks API usage: `tasks/result`, `tasks/list`, `notifications/tasks/status`, `CreateTaskResult`, `taskSupport`, `io.modelcontextprotocol/related-task` and `model-immediate-response` _meta keys |
| DEPRECATED | 12-month window; plan the replacement | Roots (`roots/list`, `list_roots`, `listRoots`), Sampling (`sampling/createMessage`, `create_message`, `createMessage`), protocol-level Logging (`logging/setLevel`, `notifications/message`, `send_log_message`, `sendLoggingMessage`) |
| ADVISORY | Review; the stateless revision replaces or obsoletes these | `Mcp-Session-Id` handling, `sessionIdGenerator`, initialize-handshake hooks, sticky sessions and session stores, API-key auth where OAuth 2.1 is now mandated, `mcp.server.fastmcp` imports (renamed `MCPServer` in Python SDK v2), CommonJS `require()` of the TypeScript SDK (v2 is ESM-only), monolithic `@modelcontextprotocol/sdk` imports and dependencies (v2 splits into `@modelcontextprotocol/server` and `@modelcontextprotocol/client`), uncached `tools/list` calls that could honor `ttlMs` |

Python and TypeScript/JavaScript get language-specific rules. Go and C# files are scanned too, but only by the language-agnostic protocol-string rules (JSON-RPC method names, headers, _meta keys).

## Install

```sh
cd tools/mcp-spec-audit
npm install
npm run build
npm link        # optional: puts `mcp-spec-audit` on your PATH
```

Requires Node 20+. During development, `npm run dev -- <path>` runs from source via tsx.

## Usage

```sh
mcp-spec-audit <path> [--json] [--report <file>] [--no-report] [--rules <file>]
```

- `<path>` is the root of the MCP server codebase (or a single file).
- `--json` switches the terminal output to machine-readable JSON.
- `--report` sets the markdown report path (default `mcp-spec-audit-report.md` in the current directory); `--no-report` skips it.
- `--rules` points at an alternative rules file.

**Exit codes:** 1 if any BREAKS findings (CI-friendly), 0 otherwise, 2 on error.

The markdown report groups findings by severity, leads with a checkbox migration checklist (one item per triggered rule, with site counts), and lists every site as `file:line` with the matched excerpt.

## How to add a rule

Rules are declarative data in [`rules.json`](./rules.json); a new spec revision should be a rule-file change, not a code change. One rule looks like:

```json
{
  "id": "my-new-rule",
  "languages": ["python"],
  "pattern": "\\bsome_removed_api\\b",
  "flags": "i",
  "severity": "deprecated",
  "message": "What was found and why it matters.",
  "replacement": "What to do instead.",
  "specLink": "https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/"
}
```

- `languages` is any of `python`, `typescript` (also covers JS), `go`, `csharp`, or `any`.
- `pattern` is a JavaScript regex matched per line; `flags` is optional.
- Optional `fileName` restricts the rule to an exact basename (used for `package.json` dependency checks).
- `severity` is `breaks`, `deprecated`, or `advisory`; only `breaks` affects the exit code.

The rules test suite validates every rule (unique id, compiling pattern, valid severity, spec link), so `npm test` after editing is enough to catch mistakes. Verify any new API name against the official spec or SDK docs before encoding it; do not encode guesses.

## Known limitations

False positives are traded away aggressively; expect this tool to miss exotic cases rather than flag compliant code. In particular:

- Matching is line-based regex, not full parsing. Identifiers split across lines, aliased imports, or dynamically built method strings are missed.
- Whole-line comments are skipped, but trailing comments on code lines are still matched.
- Generic names carry residual ambiguity: `createMessage`/`create_message` may be another library's API, and `session_store`/sticky-session hits may belong to your web framework rather than MCP. These are worded conditionally and never severity `breaks`.
- Absence cannot be detected: a server with no auth at all produces no auth finding. The `x-api-key` rule only catches visible legacy auth.
- `tasks/get` and `tasks/cancel` exist in both the experimental and graduated Tasks APIs, so they are not flagged on their own; the removed methods around them are.
- Go and C# coverage is protocol-string level only.

## Tests

```sh
npm test
```

Fixtures under `test/fixtures/` include a deliberately non-compliant Python server, a deliberately non-compliant TypeScript server (plus a CommonJS client and a legacy `package.json`), and a compliant pair asserted to produce zero findings. Tests pin the exact rule set each fixture must trigger and assert the rendered report contains no em dashes.

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
