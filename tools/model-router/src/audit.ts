import { sessionDurationMinutes } from "./parser.js";
import { costOfUsage, formatUsd, resolveModelPricing } from "./pricing.js";
import { renderTable } from "./table.js";
import type { PricingFile, RouterConfig, SessionStats } from "./types.js";

export interface AuditFlag {
  sessionId: string;
  project: string;
  lastActive: string | null;
  models: string[];
  toolCalls: number;
  assistantTurns: number;
  durationMinutes: number | null;
  actualCostUsd: number;
  downgradedCostUsd: number;
  overspendUsd: number;
}

export interface AuditReport {
  dateRange: { from: string | null; to: string | null };
  pricingVerifiedOn: string;
  thresholds: RouterConfig["audit"];
  sessionsExamined: number;
  flagged: AuditFlag[];
  totalOverspendUsd: number;
}

/**
 * Flag sessions that ran on an overkill-tier model (default: opus) while
 * looking light on every observable dimension: few tool calls, few assistant
 * turns, AND short duration. Overspend is what the overkill-tier tokens cost
 * minus the same tokens at the configured downgrade model's rates.
 */
export function buildAudit(
  sessions: SessionStats[],
  pricing: PricingFile,
  config: RouterConfig,
): AuditReport {
  const t = config.audit;
  const downgradeRates = resolveModelPricing(pricing, t.downgradeToModel);
  if (!downgradeRates) {
    throw new Error(
      `Audit downgrade model "${t.downgradeToModel}" has no entry in the pricing file`,
    );
  }

  const flagged: AuditFlag[] = [];
  let from: string | null = null;
  let to: string | null = null;

  for (const s of sessions) {
    if (s.firstTimestamp && (from === null || s.firstTimestamp < from)) from = s.firstTimestamp;
    if (s.lastTimestamp && (to === null || s.lastTimestamp > to)) to = s.lastTimestamp;

    const duration = sessionDurationMinutes(s);
    const isLight =
      s.toolCalls <= t.maxToolCalls &&
      s.assistantTurns <= t.maxAssistantTurns &&
      duration !== null &&
      duration <= t.maxDurationMinutes;
    if (!isLight) continue;

    // Overspend covers only the usage that ran on an overkill-tier model.
    let actual = 0;
    let downgraded = 0;
    const overkillModels: string[] = [];
    for (const [model, usage] of s.usageByModel) {
      const rates = resolveModelPricing(pricing, model);
      if (!rates || !t.overkillTiers.includes(rates.tier)) continue;
      overkillModels.push(model);
      actual += costOfUsage(usage, rates);
      downgraded += costOfUsage(usage, downgradeRates);
    }
    if (overkillModels.length === 0) continue;

    flagged.push({
      sessionId: s.sessionId,
      project: s.project,
      lastActive: s.lastTimestamp,
      models: overkillModels,
      toolCalls: s.toolCalls,
      assistantTurns: s.assistantTurns,
      durationMinutes: duration,
      actualCostUsd: actual,
      downgradedCostUsd: downgraded,
      overspendUsd: Math.max(0, actual - downgraded),
    });
  }

  flagged.sort((a, b) => b.overspendUsd - a.overspendUsd);

  return {
    dateRange: { from, to },
    pricingVerifiedOn: pricing.verified_on,
    thresholds: t,
    sessionsExamined: sessions.length,
    flagged,
    totalOverspendUsd: flagged.reduce((sum, f) => sum + f.overspendUsd, 0),
  };
}

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "-";
}

export function renderAudit(report: AuditReport): string {
  const t = report.thresholds;
  const out: string[] = [];
  out.push(
    `Data window: ${shortDate(report.dateRange.from)} -> ${shortDate(report.dateRange.to)} UTC ` +
      `(transcripts older than ~30 days may already be gone)`,
  );
  out.push(
    `Costs estimated from pricing.json verified on ${report.pricingVerifiedOn} — verify rates at https://claude.com/pricing before trusting dollar figures.`,
  );
  out.push(
    `Overkill = [${t.overkillTiers.join(", ")}]-tier model with <=${t.maxToolCalls} tool calls, ` +
      `<=${t.maxAssistantTurns} assistant turns, and <=${t.maxDurationMinutes} min duration ` +
      `(thresholds in router.config.json). Overspend vs ${t.downgradeToModel} rates.`,
  );
  out.push("");

  if (report.flagged.length === 0) {
    out.push(`No likely-overkill sessions among ${report.sessionsExamined} examined.`);
    return out.join("\n");
  }

  out.push(
    renderTable(
      ["session", "project", "last active (UTC)", "model(s)", "tools", "turns", "mins", "actual", "at downgrade", "overspend"],
      report.flagged.map((f) => [
        f.sessionId.slice(0, 8),
        f.project.replace(/^-Users-[^-]+-/, ""),
        shortDate(f.lastActive),
        f.models.join(", "),
        String(f.toolCalls),
        String(f.assistantTurns),
        f.durationMinutes === null ? "-" : f.durationMinutes.toFixed(0),
        formatUsd(f.actualCostUsd),
        formatUsd(f.downgradedCostUsd),
        formatUsd(f.overspendUsd),
      ]),
    ),
  );
  out.push("");
  out.push(
    `Flagged ${report.flagged.length} of ${report.sessionsExamined} sessions. ` +
      `Total estimated overspend: ${formatUsd(report.totalOverspendUsd)} ` +
      `(at pricing verified ${report.pricingVerifiedOn}).`,
  );
  return out.join("\n");
}
