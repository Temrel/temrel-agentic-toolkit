import { describe, expect, it } from "vitest";
import { bumpTier, scoreAxis, scoreSession, tierForTotal } from "../src/heuristic.js";
import { buildCalibration } from "../src/calibrate.js";
import { makeSession, testConfig, testPricing } from "./helpers.js";

describe("tierForTotal", () => {
  it("maps the routing table boundaries", () => {
    expect(tierForTotal(4)).toBe("haiku");
    expect(tierForTotal(6)).toBe("haiku");
    expect(tierForTotal(7)).toBe("sonnet");
    expect(tierForTotal(9)).toBe("sonnet");
    expect(tierForTotal(10)).toBe("opus");
    expect(tierForTotal(12)).toBe("opus");
  });
});

describe("bumpTier", () => {
  it("bumps one tier and saturates at opus", () => {
    expect(bumpTier("haiku")).toBe("sonnet");
    expect(bumpTier("sonnet")).toBe("opus");
    expect(bumpTier("opus")).toBe("opus");
  });
});

describe("scoreAxis", () => {
  const proxy = { metric: "toolCalls" as const, scoreTwoAt: 10, scoreThreeAt: 40 };
  it("scores 1/2/3 around the boundaries", () => {
    expect(scoreAxis(9, proxy)).toBe(1);
    expect(scoreAxis(10, proxy)).toBe(2);
    expect(scoreAxis(39, proxy)).toBe(2);
    expect(scoreAxis(40, proxy)).toBe(3);
  });
});

describe("scoreSession", () => {
  it("scores a minimal session as haiku-tier", () => {
    const s = makeSession({ toolCalls: 1, userTurns: 1, filesTouched: new Set() });
    const r = scoreSession(s, testConfig);
    expect(r.scores).toEqual({ scope: 1, novelty: 1, risk: 1, iteration: 1 });
    expect(r.total).toBe(4);
    expect(r.tier).toBe("haiku");
    expect(r.riskBumped).toBe(false);
  });

  it("applies the risk-3 bump", () => {
    // 12 files touched -> scope 3 (>=6), risk 3 (>=10); 1 turn, 1 tool call.
    const files = new Set(Array.from({ length: 12 }, (_, i) => `/f/${i}.ts`));
    const s = makeSession({ toolCalls: 1, userTurns: 1, filesTouched: files });
    const r = scoreSession(s, testConfig);
    expect(r.total).toBe(8); // 3+1+3+1
    expect(r.baseTier).toBe("sonnet");
    expect(r.riskBumped).toBe(true);
    expect(r.tier).toBe("opus");
  });

  it("scores a heavy session as opus-tier without the bump", () => {
    const files = new Set(["/a.ts", "/b.ts", "/c.ts", "/d.ts", "/e.ts", "/f.ts"]);
    const s = makeSession({ toolCalls: 45, userTurns: 9, filesTouched: files });
    const r = scoreSession(s, testConfig);
    expect(r.scores).toEqual({ scope: 3, novelty: 3, risk: 2, iteration: 3 });
    expect(r.total).toBe(11);
    expect(r.tier).toBe("opus");
  });
});

describe("buildCalibration", () => {
  it("compares heuristic tier with the cost-dominant model's tier", () => {
    const lightOnOpus = makeSession({
      toolCalls: 1,
      userTurns: 1,
      filesTouched: new Set(),
      usage: { "claude-opus-4-8": { input: 1_000_000 } },
    });
    const heavyOnOpus = makeSession({
      sessionId: "00000000-0000-4000-8000-000000000001",
      toolCalls: 45,
      userTurns: 9,
      filesTouched: new Set(Array.from({ length: 12 }, (_, i) => `/f/${i}.ts`)),
      usage: { "claude-opus-4-8": { input: 1_000_000 } },
    });
    const cal = buildCalibration([lightOnOpus, heavyOnOpus], testPricing, testConfig);
    expect(cal.matrix.haiku.opus).toBe(1); // heuristic says haiku, ran on opus
    expect(cal.matrix.opus.opus).toBe(1); // agreement
    expect(cal.agreementRate).toBeCloseTo(0.5, 6);
  });

  it("marks sessions with only unpriced models as unknown", () => {
    const mystery = makeSession({ usage: { "totally-new-model": { input: 1000 } } });
    const cal = buildCalibration([mystery], testPricing, testConfig);
    expect(cal.sessions[0].actualTier).toBe("unknown");
    expect(cal.agreementRate).toBe(0);
  });

  it("picks the dominant model by cost in mixed sessions", () => {
    const mixed = makeSession({
      usage: {
        "claude-haiku": { input: 1_000_000 }, // $1
        "claude-opus-4-8": { input: 1_000_000 }, // $5 -> dominant
      },
    });
    const cal = buildCalibration([mixed], testPricing, testConfig);
    expect(cal.sessions[0].dominantModel).toBe("claude-opus-4-8");
    expect(cal.sessions[0].actualTier).toBe("opus");
  });
});
