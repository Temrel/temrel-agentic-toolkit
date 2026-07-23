import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { DEFAULT_RULES_PATH, loadRules, validateRules } from "../src/rules.js";
import type { RulesFile } from "../src/types.js";

describe("rules.json", () => {
  it("loads and every rule compiles", async () => {
    const { version, rules } = await loadRules();
    expect(version).toBe("2026-07-28-rc1");
    expect(rules.length).toBeGreaterThan(20);
    for (const rule of rules) {
      expect(rule.regex).toBeInstanceOf(RegExp);
      expect(rule.specLink).toMatch(/^https:\/\//);
    }
  });

  it("has unique ids and valid severities", async () => {
    const raw = JSON.parse(await readFile(DEFAULT_RULES_PATH, "utf8")) as RulesFile;
    expect(validateRules(raw)).toEqual([]);
    const ids = raw.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all three severities", async () => {
    const { rules } = await loadRules();
    const severities = new Set(rules.map((rule) => rule.severity));
    expect(severities).toEqual(new Set(["breaks", "deprecated", "advisory"]));
  });

  it("contains no em or en dashes in user-facing text", async () => {
    const raw = await readFile(DEFAULT_RULES_PATH, "utf8");
    expect(raw).not.toMatch(/[–—]/);
  });

  it("rejects a broken rules file", () => {
    const bad = {
      version: "x",
      specLinks: {},
      rules: [
        { id: "a", languages: ["python"], pattern: "(", severity: "breaks", message: "m", replacement: "r", specLink: "s" },
        { id: "a", languages: ["klingon"], pattern: "ok", severity: "nope", message: "", replacement: "r", specLink: "s" },
      ],
    } as unknown as RulesFile;
    const errors = validateRules(bad);
    expect(errors.some((e) => e.includes("does not compile"))).toBe(true);
    expect(errors.some((e) => e.includes("duplicate rule id"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown language"))).toBe(true);
    expect(errors.some((e) => e.includes("invalid severity"))).toBe(true);
  });
});
