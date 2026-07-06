import { describe, expect, it } from "vitest";
import { buildAudit } from "../src/audit.js";
import { makeSession, testConfig, testPricing } from "./helpers.js";

const lightOpus = () =>
  makeSession({
    toolCalls: 2,
    assistantTurns: 3,
    firstTimestamp: "2026-07-01T10:00:00.000Z",
    lastTimestamp: "2026-07-01T10:05:00.000Z",
    usage: { "claude-opus-4-8": { input: 1_000_000, output: 1_000_000 } },
  });

describe("buildAudit", () => {
  it("flags a light session on an opus-tier model", () => {
    const audit = buildAudit([lightOpus()], testPricing, testConfig);
    expect(audit.flagged).toHaveLength(1);
    // Overspend: (5+25) - (3+15) = 12 per Mtok pair.
    expect(audit.flagged[0].actualCostUsd).toBeCloseTo(30, 6);
    expect(audit.flagged[0].downgradedCostUsd).toBeCloseTo(18, 6);
    expect(audit.flagged[0].overspendUsd).toBeCloseTo(12, 6);
    expect(audit.totalOverspendUsd).toBeCloseTo(12, 6);
  });

  it("does not flag sessions over any single threshold", () => {
    const tooManyTools = { ...lightOpus(), toolCalls: 6 };
    const tooManyTurns = { ...lightOpus(), assistantTurns: 7 };
    const tooLong = { ...lightOpus(), lastTimestamp: "2026-07-01T10:11:00.000Z" };
    const audit = buildAudit([tooManyTools, tooManyTurns, tooLong], testPricing, testConfig);
    expect(audit.flagged).toHaveLength(0);
    expect(audit.sessionsExamined).toBe(3);
  });

  it("flags exactly at the threshold boundary (<= semantics)", () => {
    const atBoundary = makeSession({
      toolCalls: 5,
      assistantTurns: 6,
      firstTimestamp: "2026-07-01T10:00:00.000Z",
      lastTimestamp: "2026-07-01T10:10:00.000Z",
      usage: { "claude-opus-4-8": { input: 1000 } },
    });
    const audit = buildAudit([atBoundary], testPricing, testConfig);
    expect(audit.flagged).toHaveLength(1);
  });

  it("ignores light sessions on non-overkill tiers", () => {
    const lightSonnet = makeSession({
      toolCalls: 1,
      assistantTurns: 2,
      usage: { "claude-sonnet-5": { input: 1_000_000 } },
    });
    const audit = buildAudit([lightSonnet], testPricing, testConfig);
    expect(audit.flagged).toHaveLength(0);
  });

  it("computes overspend only on the opus-tier share of mixed sessions", () => {
    const mixed = makeSession({
      toolCalls: 1,
      assistantTurns: 2,
      usage: {
        "claude-opus-4-8": { input: 1_000_000 },
        "claude-sonnet-5": { input: 50_000_000 },
      },
    });
    const audit = buildAudit([mixed], testPricing, testConfig);
    expect(audit.flagged).toHaveLength(1);
    // Only the opus Mtok counts: $5 actual vs $3 at sonnet rates.
    expect(audit.flagged[0].overspendUsd).toBeCloseTo(2, 6);
    expect(audit.flagged[0].models).toEqual(["claude-opus-4-8"]);
  });

  it("prices fable-tier usage against the downgrade model too", () => {
    const fable = makeSession({
      toolCalls: 0,
      assistantTurns: 1,
      usage: { "claude-fable-5": { output: 1_000_000 } },
    });
    const audit = buildAudit([fable], testPricing, testConfig);
    // fable output $50 vs sonnet $15 -> $35 overspend.
    expect(audit.flagged[0].overspendUsd).toBeCloseTo(35, 6);
  });

  it("skips sessions with unknown duration rather than guessing", () => {
    const noTimestamps = makeSession({
      firstTimestamp: null,
      lastTimestamp: null,
      toolCalls: 0,
      assistantTurns: 1,
      usage: { "claude-opus-4-8": { input: 1_000_000 } },
    });
    const audit = buildAudit([noTimestamps], testPricing, testConfig);
    expect(audit.flagged).toHaveLength(0);
  });

  it("throws when the downgrade model has no pricing entry", () => {
    const badConfig = {
      ...testConfig,
      audit: { ...testConfig.audit, downgradeToModel: "no-such-model" },
    };
    expect(() => buildAudit([lightOpus()], testPricing, badConfig)).toThrow(/no entry/);
  });
});
