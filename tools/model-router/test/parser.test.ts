import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverTranscripts,
  encodeProjectPath,
  loadSessions,
  parseTranscript,
  sessionDurationMinutes,
} from "../src/parser.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const ALPHA = join(FIXTURES, "-Users-tester-code-alpha", "11111111-2222-4333-8444-555555555555.jsonl");

describe("encodeProjectPath", () => {
  it("encodes slashes and dots as dashes", () => {
    expect(encodeProjectPath("/Users/tester/code/alpha")).toBe("-Users-tester-code-alpha");
    expect(encodeProjectPath("/Users/t/my.app")).toBe("-Users-t-my-app");
  });
});

describe("discoverTranscripts", () => {
  it("finds session jsonl files across projects", async () => {
    const files = await discoverTranscripts(FIXTURES);
    expect(files).toHaveLength(2);
  });

  it("filters by real project path", async () => {
    const files = await discoverTranscripts(FIXTURES, "/Users/tester/code/alpha");
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("-Users-tester-code-alpha");
  });

  it("returns empty for a missing root instead of throwing", async () => {
    expect(await discoverTranscripts(join(FIXTURES, "nope"))).toEqual([]);
  });
});

describe("parseTranscript", () => {
  it("dedupes usage by message id (one API message split across entries)", async () => {
    const s = await parseTranscript(ALPHA);
    // msg_A appears twice with identical usage — must be counted once.
    const opus = s.usageByModel.get("claude-opus-4-8")!;
    expect(opus.input).toBe(1000 + 2000); // msg_A once + msg_B
    expect(opus.output).toBe(200 + 300);
    expect(s.assistantTurns).toBe(3); // msg_A, msg_B, msg_C (synthetic excluded)
  });

  it("splits cache writes by TTL and handles missing breakdown", async () => {
    const s = await parseTranscript(ALPHA);
    const opus = s.usageByModel.get("claude-opus-4-8")!;
    expect(opus.cacheWrite5m).toBe(100);
    expect(opus.cacheWrite1h).toBe(400);
    const sonnet = s.usageByModel.get("claude-sonnet-5")!;
    // msg_C has no cache_creation breakdown -> unknown-TTL bucket.
    expect(sonnet.cacheWriteUnknownTtl).toBe(250);
  });

  it("skips synthetic model entries entirely", async () => {
    const s = await parseTranscript(ALPHA);
    expect(s.usageByModel.has("<synthetic>")).toBe(false);
  });

  it("counts unparseable lines without crashing", async () => {
    const s = await parseTranscript(ALPHA);
    expect(s.skippedLines).toBe(1);
    expect(s.totalLines).toBe(9);
  });

  it("counts tool calls and files touched, deduped by block id", async () => {
    const s = await parseTranscript(ALPHA);
    expect(s.toolCalls).toBe(2);
    expect([...s.filesTouched].sort()).toEqual([
      "/Users/tester/code/alpha/src/new.ts",
      "/Users/tester/code/alpha/src/parser.ts",
    ]);
  });

  it("counts only human prompts as user turns (tool results excluded)", async () => {
    const s = await parseTranscript(ALPHA);
    expect(s.userTurns).toBe(1);
  });

  it("tracks first/last timestamps and duration", async () => {
    const s = await parseTranscript(ALPHA);
    expect(s.firstTimestamp).toBe("2026-07-01T10:00:00.000Z");
    expect(s.lastTimestamp).toBe("2026-07-01T10:05:00.000Z");
    expect(sessionDurationMinutes(s)).toBe(5);
  });
});

describe("loadSessions", () => {
  const now = new Date("2026-07-06T00:00:00Z");

  it("applies the since-days window", async () => {
    const recent = await loadSessions({ projectsRoot: FIXTURES, sinceDays: 30, now });
    expect(recent.map((s) => s.project)).toEqual(["-Users-tester-code-alpha"]);

    const all = await loadSessions({ projectsRoot: FIXTURES, sinceDays: 365, now });
    expect(all).toHaveLength(2);
  });

  it("filters by project", async () => {
    const beta = await loadSessions({
      projectsRoot: FIXTURES,
      project: "/Users/tester/code/beta",
      sinceDays: 365,
      now,
    });
    expect(beta).toHaveLength(1);
    expect(beta[0].usageByModel.get("claude-opus-4-8")!.input).toBe(100);
  });
});
