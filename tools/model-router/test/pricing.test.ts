import { describe, expect, it } from "vitest";
import { costOfUsage, loadPricing, resolveModelPricing, DEFAULT_PRICING_PATH } from "../src/pricing.js";
import type { ModelPricing, PricingFile } from "../src/types.js";
import { emptyUsage } from "../src/types.js";

const rates: ModelPricing = {
  tier: "opus",
  input: 5,
  output: 25,
  cache_write_5m: 6.25,
  cache_write_1h: 10,
  cache_read: 0.5,
};

describe("costOfUsage", () => {
  it("prices each token class per Mtok", () => {
    const usage = emptyUsage();
    usage.input = 1_000_000;
    usage.output = 1_000_000;
    usage.cacheWrite5m = 1_000_000;
    usage.cacheWrite1h = 1_000_000;
    usage.cacheRead = 1_000_000;
    expect(costOfUsage(usage, rates)).toBeCloseTo(5 + 25 + 6.25 + 10 + 0.5, 10);
  });

  it("prices unknown-TTL cache writes at the 5m rate", () => {
    const usage = emptyUsage();
    usage.cacheWriteUnknownTtl = 2_000_000;
    expect(costOfUsage(usage, rates)).toBeCloseTo(12.5, 10);
  });

  it("is zero for empty usage", () => {
    expect(costOfUsage(emptyUsage(), rates)).toBe(0);
  });
});

describe("resolveModelPricing", () => {
  const pricing: PricingFile = {
    verified_on: "2026-06-24",
    source: "test",
    currency: "USD",
    unit: "per_million_tokens",
    models: {
      "claude-opus-4-8": rates,
      "claude-opus": { ...rates, input: 4 },
      "claude-haiku": { ...rates, tier: "haiku", input: 1 },
    },
    reference_tier_models: { opus: "claude-opus-4-8" },
  };

  it("prefers an exact match", () => {
    expect(resolveModelPricing(pricing, "claude-opus-4-8")!.input).toBe(5);
  });

  it("falls back to the longest matching prefix", () => {
    expect(resolveModelPricing(pricing, "claude-opus-4-9-20270101")!.input).toBe(4);
    expect(resolveModelPricing(pricing, "claude-haiku-4-5-20251001")!.input).toBe(1);
  });

  it("returns null for unknown models rather than guessing", () => {
    expect(resolveModelPricing(pricing, "gpt-5")).toBeNull();
    expect(resolveModelPricing(pricing, "<synthetic>")).toBeNull();
  });
});

describe("loadPricing", () => {
  it("loads the shipped pricing.json and has a verified_on date", async () => {
    const pricing = await loadPricing(DEFAULT_PRICING_PATH);
    expect(pricing.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resolveModelPricing(pricing, "claude-opus-4-8")).not.toBeNull();
    expect(resolveModelPricing(pricing, "claude-sonnet-5")).not.toBeNull();
    expect(resolveModelPricing(pricing, "claude-fable-5")).not.toBeNull();
  });

  it("rejects a pricing file with no models", async () => {
    await expect(loadPricing("/dev/null")).rejects.toThrow();
  });
});
