#!/usr/bin/env node
import { Command } from "commander";
import { loadSessions, DEFAULT_PROJECTS_ROOT } from "./parser.js";
import { loadPricing } from "./pricing.js";
import { buildReport, renderReport } from "./report.js";

/*
 * model-router — read-only analysis of local Claude Code transcripts.
 * This tool never writes to or modifies transcript files, and makes no
 * network calls.
 */

interface CommonOpts {
  project?: string;
  since: string;
  json?: boolean;
  projectsRoot: string;
  pricing?: string;
}

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option("-p, --project <path>", "limit to one project (real path or encoded dir name)")
    .option("-s, --since <days>", "look-back window in days", "30")
    .option("--json", "machine-readable JSON output")
    .option("--projects-root <dir>", "transcripts root", DEFAULT_PROJECTS_ROOT)
    .option("--pricing <file>", "path to a pricing.json override");
}

const program = new Command();
program
  .name("model-router")
  .description(
    "Analyze local Claude Code session transcripts: cost report, overkill audit, and heuristic calibration. Read-only, no network.",
  )
  .version("0.1.0");

addCommonOptions(
  program
    .command("report")
    .description("Per-session and per-model token/cost breakdown"),
).action(async (opts: CommonOpts) => {
  const sinceDays = Number(opts.since);
  if (!Number.isFinite(sinceDays) || sinceDays <= 0) {
    program.error("--since must be a positive number of days");
  }
  const pricing = await loadPricing(opts.pricing);
  const sessions = await loadSessions({
    projectsRoot: opts.projectsRoot,
    project: opts.project,
    sinceDays,
  });
  const report = buildReport(sessions, pricing, {
    projectsRoot: opts.projectsRoot,
    project: opts.project ?? null,
    sinceDays,
  });
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.totals.sessions === 0) {
    console.log("No sessions with token usage found in the requested window.");
  } else {
    console.log(renderReport(report));
  }
});

addCommonOptions(
  program
    .command("audit")
    .description("Flag sessions where the model used was likely overkill"),
).action(() => {
  console.error(
    "audit is not implemented yet — pending parser sign-off (see tools/model-router/README.md).",
  );
  process.exitCode = 1;
});

addCommonOptions(
  program
    .command("calibrate")
    .description("Compare the four-axis heuristic's tiers against models actually used"),
).action(() => {
  console.error(
    "calibrate is not implemented yet — pending parser sign-off (see tools/model-router/README.md).",
  );
  process.exitCode = 1;
});

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
