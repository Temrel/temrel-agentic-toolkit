import { scoreSession, type HeuristicResult, type Tier } from "./heuristic.js";
import { costOfUsage, resolveModelPricing } from "./pricing.js";
import { renderTable } from "./table.js";
import type { PricingFile, RouterConfig, SessionStats } from "./types.js";

export type ActualTier = Tier | "unknown";

export interface CalibrationRow {
  sessionId: string;
  project: string;
  lastActive: string | null;
  heuristic: HeuristicResult;
  /** Tier of the model that dominated the session's estimated cost. */
  actualTier: ActualTier;
  dominantModel: string | null;
  metrics: { filesTouched: number; userTurns: number; toolCalls: number; durationMinutes: number | null };
  agrees: boolean;
}

export interface CalibrationReport {
  dateRange: { from: string | null; to: string | null };
  proxies: RouterConfig["calibrate"];
  sessions: CalibrationRow[];
  /** matrix[heuristicTier][actualTier] = session count */
  matrix: Record<Tier, Record<ActualTier, number>>;
  agreementRate: number;
}

const TIERS: Tier[] = ["haiku", "sonnet", "opus"];
const ACTUAL_TIERS: ActualTier[] = ["haiku", "sonnet", "opus", "unknown"];

function emptyMatrix(): CalibrationReport["matrix"] {
  const m = {} as CalibrationReport["matrix"];
  for (const h of TIERS) {
    m[h] = { haiku: 0, sonnet: 0, opus: 0, unknown: 0 };
  }
  return m;
}

/** The tier of whichever model accounts for the most estimated cost. */
export function actualTierOf(s: SessionStats, pricing: PricingFile): { tier: ActualTier; model: string | null } {
  let bestModel: string | null = null;
  let bestTier: ActualTier = "unknown";
  let bestCost = -1;
  for (const [model, usage] of s.usageByModel) {
    const rates = resolveModelPricing(pricing, model);
    if (!rates) continue;
    const cost = costOfUsage(usage, rates);
    if (cost > bestCost) {
      bestCost = cost;
      bestModel = model;
      bestTier = rates.tier;
    }
  }
  return { tier: bestTier, model: bestModel };
}

export function buildCalibration(
  sessions: SessionStats[],
  pricing: PricingFile,
  config: RouterConfig,
): CalibrationReport {
  const rows: CalibrationRow[] = [];
  const matrix = emptyMatrix();
  let from: string | null = null;
  let to: string | null = null;
  let agree = 0;
  let comparable = 0;

  for (const s of sessions) {
    if (s.firstTimestamp && (from === null || s.firstTimestamp < from)) from = s.firstTimestamp;
    if (s.lastTimestamp && (to === null || s.lastTimestamp > to)) to = s.lastTimestamp;

    const heuristic = scoreSession(s, config);
    const actual = actualTierOf(s, pricing);
    matrix[heuristic.tier][actual.tier]++;
    const agrees = actual.tier !== "unknown" && actual.tier === heuristic.tier;
    if (actual.tier !== "unknown") {
      comparable++;
      if (agrees) agree++;
    }

    const durationMs =
      s.firstTimestamp && s.lastTimestamp
        ? Date.parse(s.lastTimestamp) - Date.parse(s.firstTimestamp)
        : null;
    rows.push({
      sessionId: s.sessionId,
      project: s.project,
      lastActive: s.lastTimestamp,
      heuristic,
      actualTier: actual.tier,
      dominantModel: actual.model,
      metrics: {
        filesTouched: s.filesTouched.size,
        userTurns: s.userTurns,
        toolCalls: s.toolCalls,
        durationMinutes: durationMs !== null && durationMs >= 0 ? durationMs / 60_000 : null,
      },
      agrees,
    });
  }

  rows.sort((a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? ""));

  return {
    dateRange: { from, to },
    proxies: config.calibrate,
    sessions: rows,
    matrix,
    agreementRate: comparable > 0 ? agree / comparable : 0,
  };
}

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "-";
}

export function renderCalibration(report: CalibrationReport): string {
  const out: string[] = [];
  out.push(
    `Data window: ${shortDate(report.dateRange.from)} -> ${shortDate(report.dateRange.to)} UTC ` +
      `(transcripts older than ~30 days may already be gone)`,
  );
  out.push("");
  out.push("Axis proxies (v1 approximations, configurable in router.config.json):");
  for (const axis of ["scope", "novelty", "risk", "iteration"] as const) {
    const p = report.proxies[axis];
    out.push(
      `  ${axis.padEnd(9)} <- ${p.metric} (2 at >=${p.scoreTwoAt}, 3 at >=${p.scoreThreeAt})`,
    );
  }
  out.push("");

  out.push("Heuristic tier (rows) vs model tier actually used (columns):");
  out.push(
    renderTable(
      ["heuristic \\ actual", ...ACTUAL_TIERS],
      TIERS.map((h) => [h, ...ACTUAL_TIERS.map((a) => String(report.matrix[h][a]))]),
    ),
  );
  out.push("");

  out.push("Per session:");
  out.push(
    renderTable(
      ["session", "project", "last active (UTC)", "S/N/R/I", "total", "heuristic", "actual", "dominant model", "agree"],
      report.sessions.map((r) => [
        r.sessionId.slice(0, 8),
        r.project.replace(/^-Users-[^-]+-/, ""),
        shortDate(r.lastActive),
        `${r.heuristic.scores.scope}/${r.heuristic.scores.novelty}/${r.heuristic.scores.risk}/${r.heuristic.scores.iteration}`,
        String(r.heuristic.total) + (r.heuristic.riskBumped ? "^" : ""),
        r.heuristic.tier,
        r.actualTier,
        r.dominantModel ?? "-",
        r.agrees ? "yes" : "NO",
      ]),
    ),
  );
  out.push("");
  out.push(
    `Agreement: ${(report.agreementRate * 100).toFixed(0)}% of ${report.sessions.length} sessions ` +
      `(^ = risk-3 bumped the tier). Disagreements are where your habits and the rubric part ways — ` +
      `they may indicate habit, or a weak proxy; see README caveats.`,
  );
  return out.join("\n");
}
