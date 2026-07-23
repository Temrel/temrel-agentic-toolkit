#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { loadRules } from "./rules.js";
import { scan } from "./scanner.js";
import { renderMarkdown, renderTerminal } from "./report.js";

/*
 * mcp-spec-audit: static scan of an MCP server codebase against the
 * 2026-07-28 spec revision. Pure static analysis: no network calls, no code
 * execution, and it never modifies the scanned codebase.
 */

interface CliOpts {
  json?: boolean;
  report: string | false;
  rules?: string;
}

const program = new Command();
program
  .name("mcp-spec-audit")
  .description(
    "Audit an MCP server codebase for the MCP 2026-07-28 stateless spec revision. Static analysis only; exit code 1 if any BREAKS findings.",
  )
  .version("0.1.0")
  .argument("<path>", "root of the MCP server codebase to scan")
  .option("--json", "machine-readable JSON output instead of the terminal report")
  .option("--report <file>", "markdown report path", "mcp-spec-audit-report.md")
  .option("--no-report", "skip writing the markdown report")
  .option("--rules <file>", "path to an alternative rules.json")
  .action(async (target: string, opts: CliOpts) => {
    const { version, rules } = await loadRules(opts.rules);
    const result = await scan(target, rules, version);

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(renderTerminal(result));
    }

    if (opts.report !== false) {
      const reportPath = path.resolve(opts.report);
      await writeFile(reportPath, renderMarkdown(result, new Date()), "utf8");
      if (!opts.json) console.log(`\nReport written to ${reportPath}`);
    }

    process.exitCode = result.counts.breaks > 0 ? 1 : 0;
  });

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 2;
});
