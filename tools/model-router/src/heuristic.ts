import { sessionDurationMinutes } from "./parser.js";
import type { AxisProxy, RouterConfig, SessionStats } from "./types.js";

export type Tier = "haiku" | "sonnet" | "opus";

export interface AxisScores {
  scope: number;
  novelty: number;
  risk: number;
  iteration: number;
}

export interface HeuristicResult {
  scores: AxisScores;
  total: number;
  /** Tier from the total alone. */
  baseTier: Tier;
  /** Tier after the risk-3 bump override. */
  tier: Tier;
  riskBumped: boolean;
}

export function tierForTotal(total: number): Tier {
  if (total <= 6) return "haiku";
  if (total <= 9) return "sonnet";
  return "opus";
}

export function bumpTier(tier: Tier): Tier {
  if (tier === "haiku") return "sonnet";
  if (tier === "sonnet") return "opus";
  return "opus";
}

function metricValue(s: SessionStats, metric: AxisProxy["metric"]): number {
  switch (metric) {
    case "filesTouched":
      return s.filesTouched.size;
    case "userTurns":
      return s.userTurns;
    case "toolCalls":
      return s.toolCalls;
    case "durationMinutes":
      return sessionDurationMinutes(s) ?? 0;
  }
}

export function scoreAxis(value: number, proxy: AxisProxy): number {
  if (value >= proxy.scoreThreeAt) return 3;
  if (value >= proxy.scoreTwoAt) return 2;
  return 1;
}

/** Approximate the skill's four-axis score from observable session proxies. */
export function scoreSession(s: SessionStats, config: RouterConfig): HeuristicResult {
  const c = config.calibrate;
  const scores: AxisScores = {
    scope: scoreAxis(metricValue(s, c.scope.metric), c.scope),
    novelty: scoreAxis(metricValue(s, c.novelty.metric), c.novelty),
    risk: scoreAxis(metricValue(s, c.risk.metric), c.risk),
    iteration: scoreAxis(metricValue(s, c.iteration.metric), c.iteration),
  };
  const total = scores.scope + scores.novelty + scores.risk + scores.iteration;
  const baseTier = tierForTotal(total);
  const riskBumped = scores.risk === 3;
  return {
    scores,
    total,
    baseTier,
    tier: riskBumped ? bumpTier(baseTier) : baseTier,
    riskBumped,
  };
}
