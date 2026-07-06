import type { PricingFile, SessionStats, UsageTotals } from "./types.js";
import { addUsage, emptyUsage } from "./types.js";
import { costOfUsage, formatUsd, resolveModelPricing } from "./pricing.js";
import { formatTokens, renderTable } from "./table.js";

export interface SessionReportRow {
  sessionId: string;
  project: string;
  lastActive: string | null;
  models: string[];
  tokens: UsageTotals;
  costUsd: number | null;
  unpricedModels: string[];
}

export interface ModelAggregateRow {
  model: string;
  sessions: number;
  tokens: UsageTotals;
  costUsd: number | null;
}

export interface Report {
  generatedFrom: { projectsRoot: string; project: string | null; sinceDays: number };
  dateRange: { from: string | null; to: string | null };
  pricingVerifiedOn: string;
  sessions: SessionReportRow[];
  byModel: ModelAggregateRow[];
  totals: { sessions: number; costUsd: number; costPerSessionUsd: number; skippedLines: number };
}

export function buildReport(
  sessions: SessionStats[],
  pricing: PricingFile,
  meta: Report["generatedFrom"],
): Report {
  const byModel = new Map<string, ModelAggregateRow>();
  const sessionRows: SessionReportRow[] = [];
  let totalCost = 0;
  let skippedLines = 0;
  let from: string | null = null;
  let to: string | null = null;

  for (const s of sessions) {
    skippedLines += s.skippedLines;
    if (s.firstTimestamp && (from === null || s.firstTimestamp < from)) from = s.firstTimestamp;
    if (s.lastTimestamp && (to === null || s.lastTimestamp > to)) to = s.lastTimestamp;

    const sessionTokens = emptyUsage();
    let sessionCost = 0;
    const unpriced: string[] = [];

    for (const [model, usage] of s.usageByModel) {
      addUsage(sessionTokens, usage);
      const rates = resolveModelPricing(pricing, model);
      if (rates) sessionCost += costOfUsage(usage, rates);
      else unpriced.push(model);

      let agg = byModel.get(model);
      if (!agg) {
        agg = { model, sessions: 0, tokens: emptyUsage(), costUsd: rates ? 0 : null };
        byModel.set(model, agg);
      }
      agg.sessions++;
      addUsage(agg.tokens, usage);
      if (rates && agg.costUsd !== null) agg.costUsd += costOfUsage(usage, rates);
    }

    totalCost += sessionCost;
    sessionRows.push({
      sessionId: s.sessionId,
      project: s.project,
      lastActive: s.lastTimestamp,
      models: [...s.usageByModel.keys()],
      tokens: sessionTokens,
      costUsd: unpriced.length === s.usageByModel.size ? null : sessionCost,
      unpricedModels: unpriced,
    });
  }

  sessionRows.sort((a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? ""));

  return {
    generatedFrom: meta,
    dateRange: { from, to },
    pricingVerifiedOn: pricing.verified_on,
    sessions: sessionRows,
    byModel: [...byModel.values()].sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0)),
    totals: {
      sessions: sessionRows.length,
      costUsd: totalCost,
      costPerSessionUsd: sessionRows.length > 0 ? totalCost / sessionRows.length : 0,
      skippedLines,
    },
  };
}

function cacheWriteTotal(t: UsageTotals): number {
  return t.cacheWrite5m + t.cacheWrite1h + t.cacheWriteUnknownTtl;
}

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "-";
}

export function renderReport(report: Report): string {
  const out: string[] = [];
  out.push(
    `Data window: ${shortDate(report.dateRange.from)} -> ${shortDate(report.dateRange.to)} UTC ` +
      `(last ${report.generatedFrom.sinceDays} days requested; transcripts older than ~30 days may already be gone)`,
  );
  out.push(
    `Costs estimated from pricing.json verified on ${report.pricingVerifiedOn} — verify rates at https://claude.com/pricing before trusting dollar figures.`,
  );
  out.push("");

  out.push("Per model:");
  out.push(
    renderTable(
      ["model", "sessions", "input", "output", "cache write", "cache read", "est. cost"],
      report.byModel.map((m) => [
        m.model,
        String(m.sessions),
        formatTokens(m.tokens.input),
        formatTokens(m.tokens.output),
        formatTokens(cacheWriteTotal(m.tokens)),
        formatTokens(m.tokens.cacheRead),
        m.costUsd === null ? "n/a (no pricing)" : formatUsd(m.costUsd),
      ]),
    ),
  );
  out.push("");

  out.push("Per session (most recent first):");
  out.push(
    renderTable(
      ["session", "project", "last active (UTC)", "model(s)", "input", "output", "cache write", "cache read", "est. cost"],
      report.sessions.map((s) => [
        s.sessionId.slice(0, 8),
        s.project.replace(/^-Users-[^-]+-/, ""),
        shortDate(s.lastActive),
        s.models.join(", ") + (s.unpricedModels.length > 0 ? " (unpriced!)" : ""),
        formatTokens(s.tokens.input),
        formatTokens(s.tokens.output),
        formatTokens(cacheWriteTotal(s.tokens)),
        formatTokens(s.tokens.cacheRead),
        s.costUsd === null ? "n/a" : formatUsd(s.costUsd),
      ]),
    ),
  );
  out.push("");

  out.push(
    `Total: ${report.totals.sessions} sessions, est. ${formatUsd(report.totals.costUsd)} ` +
      `(${formatUsd(report.totals.costPerSessionUsd)}/session), at pricing verified ${report.pricingVerifiedOn}.`,
  );
  if (report.totals.skippedLines > 0) {
    out.push(`Note: ${report.totals.skippedLines} unparseable transcript lines were skipped.`);
  }
  return out.join("\n");
}
