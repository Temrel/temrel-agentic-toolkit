/** Token totals for one model within one session. */
export interface UsageTotals {
  input: number;
  output: number;
  /** Cache-write tokens with a 5-minute TTL (from usage.cache_creation.ephemeral_5m_input_tokens). */
  cacheWrite5m: number;
  /** Cache-write tokens with a 1-hour TTL (from usage.cache_creation.ephemeral_1h_input_tokens). */
  cacheWrite1h: number;
  /** Cache-write tokens with no TTL breakdown available (older schema); priced at the 5m rate. */
  cacheWriteUnknownTtl: number;
  cacheRead: number;
}

export interface SessionStats {
  sessionId: string;
  /** Encoded project directory name, e.g. "-Users-you-code-foo". */
  project: string;
  filePath: string;
  /** Per-model token totals, keyed by model id. Excludes "<synthetic>". */
  usageByModel: Map<string, UsageTotals>;
  /** Count of unique API messages (deduped by message.id) per model. */
  apiMessagesByModel: Map<string, number>;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  /** Human prompts (user entries with origin.kind === "human" or plain-string content). */
  userTurns: number;
  /** Unique assistant API messages across all models. */
  assistantTurns: number;
  /** tool_use blocks emitted by the assistant (deduped by block id). */
  toolCalls: number;
  /** Distinct file paths touched via Edit/Write/NotebookEdit tool calls. */
  filesTouched: Set<string>;
  /** Lines that failed to parse as JSON, or parsed to something unusable. */
  skippedLines: number;
  totalLines: number;
}

export interface ModelPricing {
  tier: "haiku" | "sonnet" | "opus";
  input: number;
  output: number;
  cache_write_5m: number;
  cache_write_1h: number;
  cache_read: number;
}

export interface PricingFile {
  verified_on: string;
  source: string;
  currency: string;
  unit: string;
  models: Record<string, ModelPricing>;
  reference_tier_models: Record<string, string>;
}

export interface RouterConfig {
  audit: {
    maxToolCalls: number;
    maxAssistantTurns: number;
    maxDurationMinutes: number;
    overkillTiers: string[];
    downgradeToModel: string;
  };
  calibrate: {
    scope: AxisProxy;
    novelty: AxisProxy;
    risk: AxisProxy;
    iteration: AxisProxy;
  };
}

export interface AxisProxy {
  metric: "filesTouched" | "userTurns" | "toolCalls" | "durationMinutes";
  scoreTwoAt: number;
  scoreThreeAt: number;
}

export function emptyUsage(): UsageTotals {
  return { input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheWriteUnknownTtl: 0, cacheRead: 0 };
}

export function addUsage(a: UsageTotals, b: UsageTotals): void {
  a.input += b.input;
  a.output += b.output;
  a.cacheWrite5m += b.cacheWrite5m;
  a.cacheWrite1h += b.cacheWrite1h;
  a.cacheWriteUnknownTtl += b.cacheWriteUnknownTtl;
  a.cacheRead += b.cacheRead;
}
