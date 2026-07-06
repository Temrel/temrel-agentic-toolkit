import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelPricing, PricingFile, UsageTotals } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
/** pricing.json ships at the package root, one level above src/ or dist/. */
export const DEFAULT_PRICING_PATH = join(HERE, "..", "pricing.json");
export const DEFAULT_CONFIG_PATH = join(HERE, "..", "router.config.json");

export async function loadPricing(path: string = DEFAULT_PRICING_PATH): Promise<PricingFile> {
  const raw = JSON.parse(await readFile(path, "utf8")) as PricingFile;
  if (!raw.verified_on || !raw.models || Object.keys(raw.models).length === 0) {
    throw new Error(`Invalid pricing file at ${path}: needs "verified_on" and non-empty "models"`);
  }
  return raw;
}

/**
 * Resolve pricing for a model id: exact match first, then the longest
 * matching key prefix (so "claude-opus-4-9-20270101" falls back to
 * "claude-opus"). Returns null when nothing matches.
 */
export function resolveModelPricing(pricing: PricingFile, modelId: string): ModelPricing | null {
  const exact = pricing.models[modelId];
  if (exact) return exact;
  let best: { key: string; value: ModelPricing } | null = null;
  for (const [key, value] of Object.entries(pricing.models)) {
    if (modelId.startsWith(key) && (best === null || key.length > best.key.length)) {
      best = { key, value };
    }
  }
  return best?.value ?? null;
}

/** Dollar cost of a usage block at the given per-Mtok rates. */
export function costOfUsage(usage: UsageTotals, rates: ModelPricing): number {
  return (
    (usage.input * rates.input +
      usage.output * rates.output +
      usage.cacheWrite5m * rates.cache_write_5m +
      usage.cacheWrite1h * rates.cache_write_1h +
      // Unknown-TTL cache writes are priced at the cheaper 5m rate: a
      // deliberate underestimate, flagged in the README.
      usage.cacheWriteUnknownTtl * rates.cache_write_5m +
      usage.cacheRead * rates.cache_read) /
    1_000_000
  );
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
