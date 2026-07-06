#!/usr/bin/env node
import { Command } from "commander";
import { loadSessions, DEFAULT_PROJECTS_ROOT } from "./parser.js";
import { loadPricing } from "./pricing.js";
import { loadConfig } from "./config.js";
import { buildReport, renderReport } from "./report.js";
import { buildAudit, renderAudit } from "./audit.js";
import { buildCalibration, renderCalibration } from "./calibrate.js";
import type { PricingFile, RouterConfig, SessionStats } from "./types.js";

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
  config?: string;
}

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option("-p, --project <path>", "limit to one project (real path or encoded dir name)")
    .option("-s, --since <days>", "look-back window in days", "30")
    .option("--json", "machine-readable JSON output")
    .option("--projects-root <dir>", "transcripts root", DEFAULT_PROJECTS_ROOT)
    .option("--pricing <file>", "path to a pricing.json override")
    .option("--config <file>", "path to a router.config.json override");
}

interface LoadedInputs {
  sessions: SessionStats[];
  pricing: PricingFile;
  config: RouterConfig;
  sinceDays: number;
}

async function loadInputs(opts: CommonOpts): Promise<LoadedInputs> {
  const sinceDays = Number(opts.since);
  if (!Number.isFinite(sinceDays) || sinceDays <= 0) {
    throw new Error("--since must be a positive number of days");
  }
  const [pricing, config, sessions] = await Promise.all([
    loadPricing(opts.pricing),
    loadConfig(opts.config),
    loadSessions({ projectsRoot: opts.projectsRoot, project: opts.project, sinceDays }),
  ]);
  return { sessions, pricing, config, sinceDays };
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
  const { sessions, pricing, sinceDays } = await loadInputs(opts);
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
).action(async (opts: CommonOpts) => {
  const { sessions, pricing, config } = await loadInputs(opts);
  const audit = buildAudit(sessions, pricing, config);
  if (opts.json) {
    console.log(JSON.stringify(audit, null, 2));
  } else if (audit.sessionsExamined === 0) {
    console.log("No sessions with token usage found in the requested window.");
  } else {
    console.log(renderAudit(audit));
  }
});

addCommonOptions(
  program
    .command("calibrate")
    .description("Compare the four-axis heuristic's tiers against models actually used"),
).action(async (opts: CommonOpts) => {
  const { sessions, pricing, config } = await loadInputs(opts);
  const calibration = buildCalibration(sessions, pricing, config);
  if (opts.json) {
    console.log(JSON.stringify(calibration, null, 2));
  } else if (calibration.sessions.length === 0) {
    console.log("No sessions with token usage found in the requested window.");
  } else {
    console.log(renderCalibration(calibration));
  }
});

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
