import type { ModelPricing, PricingFile, RouterConfig, SessionStats, UsageTotals } from "../src/types.js";
import { emptyUsage } from "../src/types.js";

export function makeSession(overrides: Partial<SessionStats> & { usage?: Record<string, Partial<UsageTotals>> } = {}): SessionStats {
  const usageByModel = new Map<string, UsageTotals>();
  for (const [model, u] of Object.entries(overrides.usage ?? {})) {
    usageByModel.set(model, { ...emptyUsage(), ...u });
  }
  return {
    sessionId: "00000000-0000-4000-8000-000000000000",
    project: "-Users-tester-code-alpha",
    filePath: "/tmp/fake.jsonl",
    usageByModel,
    apiMessagesByModel: new Map(),
    firstTimestamp: "2026-07-01T10:00:00.000Z",
    lastTimestamp: "2026-07-01T10:05:00.000Z",
    userTurns: 1,
    assistantTurns: 3,
    toolCalls: 2,
    filesTouched: new Set(),
    skippedLines: 0,
    totalLines: 10,
    ...overrides,
  };
}

const opusRates: ModelPricing = {
  tier: "opus",
  input: 5,
  output: 25,
  cache_write_5m: 6.25,
  cache_write_1h: 10,
  cache_read: 0.5,
};

export const testPricing: PricingFile = {
  verified_on: "2026-06-24",
  source: "test",
  currency: "USD",
  unit: "per_million_tokens",
  models: {
    "claude-opus-4-8": opusRates,
    "claude-fable-5": { ...opusRates, input: 10, output: 50, cache_write_5m: 12.5, cache_write_1h: 20, cache_read: 1 },
    "claude-sonnet-5": { tier: "sonnet", input: 3, output: 15, cache_write_5m: 3.75, cache_write_1h: 6, cache_read: 0.3 },
    "claude-haiku": { tier: "haiku", input: 1, output: 5, cache_write_5m: 1.25, cache_write_1h: 2, cache_read: 0.1 },
  },
  reference_tier_models: { haiku: "claude-haiku", sonnet: "claude-sonnet-5", opus: "claude-opus-4-8" },
};

export const testConfig: RouterConfig = {
  audit: {
    maxToolCalls: 5,
    maxAssistantTurns: 6,
    maxDurationMinutes: 10,
    overkillTiers: ["opus"],
    downgradeToModel: "claude-sonnet-5",
  },
  calibrate: {
    scope: { metric: "filesTouched", scoreTwoAt: 2, scoreThreeAt: 6 },
    novelty: { metric: "userTurns", scoreTwoAt: 3, scoreThreeAt: 8 },
    risk: { metric: "filesTouched", scoreTwoAt: 1, scoreThreeAt: 10 },
    iteration: { metric: "toolCalls", scoreTwoAt: 10, scoreThreeAt: 40 },
  },
};
