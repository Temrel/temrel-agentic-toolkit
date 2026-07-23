import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRules, type CompiledRule } from "../src/rules.js";
import { scan } from "../src/scanner.js";
import { renderMarkdown, renderTerminal } from "../src/report.js";
import type { AuditResult } from "../src/types.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

let rules: CompiledRule[];
let rulesVersion: string;

beforeAll(async () => {
  const loaded = await loadRules();
  rules = loaded.rules;
  rulesVersion = loaded.version;
});

function ruleIds(result: AuditResult): Set<string> {
  return new Set(result.findings.map((finding) => finding.ruleId));
}

describe("python fixture", () => {
  let result: AuditResult;
  beforeAll(async () => {
    result = await scan(path.join(FIXTURES, "py-server"), rules, rulesVersion);
  });

  it("finds exactly the expected rules", () => {
    expect(ruleIds(result)).toEqual(
      new Set([
        "tasks-result-experimental",
        "tasks-list-experimental",
        "related-task-meta-experimental",
        "roots-protocol-deprecated",
        "roots-sdk-python-deprecated",
        "sampling-protocol-deprecated",
        "sampling-sdk-python-deprecated",
        "logging-sdk-python-deprecated",
        "session-id-header",
        "shared-session-store",
        "initialize-handshake-python",
        "legacy-auth-api-key",
        "fastmcp-import-python",
        "uncached-tools-list-python",
      ]),
    );
  });

  it("reports file and line for a known finding", () => {
    const fastmcp = result.findings.find((f) => f.ruleId === "fastmcp-import-python");
    expect(fastmcp?.file).toBe("server.py");
    expect(fastmcp?.line).toBe(7);
  });

  it("skips whole-line comments", () => {
    // CreateTaskResult appears only inside a # comment in the fixture.
    expect(ruleIds(result).has("create-task-result-experimental")).toBe(false);
  });

  it("has breaks findings, so the CI exit code would be 1", () => {
    expect(result.counts.breaks).toBeGreaterThan(0);
  });
});

describe("typescript fixture", () => {
  let result: AuditResult;
  beforeAll(async () => {
    result = await scan(path.join(FIXTURES, "ts-server"), rules, rulesVersion);
  });

  it("finds exactly the expected rules", () => {
    expect(ruleIds(result)).toEqual(
      new Set([
        "create-task-result-experimental",
        "task-support-experimental",
        "tasks-status-notification-experimental",
        "model-immediate-response-experimental",
        "roots-sdk-ts-deprecated",
        "sampling-sdk-ts-deprecated",
        "logging-sdk-ts-deprecated",
        "logging-notification-deprecated",
        "session-id-header",
        "session-id-generator-ts",
        "initialize-handshake-ts",
        "sticky-sessions",
        "monolithic-ts-sdk-import",
        "monolithic-ts-sdk-dependency",
        "cjs-require-ts-sdk",
        "uncached-tools-list-ts",
      ]),
    );
  });

  it("flags the package.json dependency", () => {
    const dep = result.findings.find((f) => f.ruleId === "monolithic-ts-sdk-dependency");
    expect(dep?.file).toBe("package.json");
  });

  it("flags the CommonJS require in the .cjs file", () => {
    const cjs = result.findings.find((f) => f.ruleId === "cjs-require-ts-sdk");
    expect(cjs?.file).toBe(path.join("src", "legacy-client.cjs"));
  });
});

describe("clean fixture", () => {
  it("reports zero findings on compliant code", async () => {
    const result = await scan(path.join(FIXTURES, "clean-server"), rules, rulesVersion);
    expect(result.findings).toEqual([]);
    expect(result.counts).toEqual({ breaks: 0, deprecated: 0, advisory: 0 });
  });
});

describe("report rendering", () => {
  let result: AuditResult;
  beforeAll(async () => {
    result = await scan(path.join(FIXTURES, "ts-server"), rules, rulesVersion);
  });

  it("renders terminal output grouped by severity", () => {
    const text = renderTerminal(result);
    expect(text).toContain("BREAKS (");
    expect(text).toContain("DEPRECATED (");
    expect(text).toContain("ADVISORY (");
    expect(text).toContain("Exit code 1");
  });

  it("renders a markdown report with checklist and file:line references", () => {
    const md = renderMarkdown(result, new Date("2026-07-23T00:00:00Z"));
    expect(md).toContain("# MCP spec audit report");
    expect(md).toContain("## Migration checklist");
    expect(md).toContain("- [ ]");
    expect(md).toContain("src/index.ts:");
    expect(md).toContain("2026-07-28-release-candidate");
  });

  it("emits no em or en dashes anywhere", () => {
    const md = renderMarkdown(result, new Date("2026-07-23T00:00:00Z"));
    const text = renderTerminal(result);
    expect(md).not.toMatch(/[–—]/);
    expect(text).not.toMatch(/[–—]/);
  });
});
