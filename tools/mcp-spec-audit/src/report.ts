import type { AuditResult, Finding, Severity } from "./types.js";
import { SEVERITY_LABEL, SEVERITY_ORDER } from "./types.js";

const SPEC_RC_URL =
  "https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/";

const SEVERITY_INTRO: Record<Severity, string> = {
  breaks: "Will not work against the 2026-07-28 revision. Migrate before adopting it.",
  deprecated: "Deprecated with a 12-month window. Works today; plan the replacement.",
  advisory: "Worth reviewing. Patterns the stateless revision makes unnecessary or replaces.",
};

function groupBySeverity(findings: Finding[]): Map<Severity, Finding[]> {
  const groups = new Map<Severity, Finding[]>();
  for (const severity of SEVERITY_ORDER) groups.set(severity, []);
  for (const finding of findings) groups.get(finding.severity)!.push(finding);
  return groups;
}

function distinctRules(findings: Finding[]): Map<string, { finding: Finding; count: number }> {
  const rules = new Map<string, { finding: Finding; count: number }>();
  for (const finding of findings) {
    const entry = rules.get(finding.ruleId);
    if (entry) entry.count++;
    else rules.set(finding.ruleId, { finding, count: 1 });
  }
  return rules;
}

export function renderTerminal(result: AuditResult): string {
  const lines: string[] = [];
  lines.push(`mcp-spec-audit (rules ${result.rulesVersion})`);
  lines.push(`Scanned ${result.filesScanned} file(s) under ${result.target}`);
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("No findings. Nothing in this codebase matched a 2026-07-28 migration rule.");
    return lines.join("\n");
  }

  const groups = groupBySeverity(result.findings);
  for (const severity of SEVERITY_ORDER) {
    const findings = groups.get(severity)!;
    if (findings.length === 0) continue;
    lines.push(`${SEVERITY_LABEL[severity]} (${findings.length})`);
    for (const finding of findings) {
      lines.push(`  ${finding.file}:${finding.line}  [${finding.ruleId}]`);
      lines.push(`    ${finding.message}`);
      lines.push(`    Fix: ${finding.replacement}`);
    }
    lines.push("");
  }

  lines.push(
    `Summary: ${result.counts.breaks} breaks, ${result.counts.deprecated} deprecated, ${result.counts.advisory} advisory`,
  );
  if (result.counts.breaks > 0) {
    lines.push("Exit code 1: BREAKS findings present.");
  }
  return lines.join("\n");
}

export function renderMarkdown(result: AuditResult, generatedAt: Date): string {
  const lines: string[] = [];
  lines.push("# MCP spec audit report");
  lines.push("");
  lines.push(`- Target: \`${result.target}\``);
  lines.push(`- Generated: ${generatedAt.toISOString()}`);
  lines.push(`- Rules version: ${result.rulesVersion}`);
  lines.push(`- Files scanned: ${result.filesScanned}`);
  lines.push(`- Spec: [MCP 2026-07-28 release candidate](${SPEC_RC_URL})`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Severity | Findings |");
  lines.push("| --- | --- |");
  for (const severity of SEVERITY_ORDER) {
    lines.push(`| ${SEVERITY_LABEL[severity]} | ${result.counts[severity]} |`);
  }
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("No findings. Nothing in this codebase matched a 2026-07-28 migration rule.");
    lines.push("");
    return lines.join("\n");
  }

  const groups = groupBySeverity(result.findings);

  lines.push("## Migration checklist");
  lines.push("");
  for (const severity of SEVERITY_ORDER) {
    const findings = groups.get(severity)!;
    if (findings.length === 0) continue;
    lines.push(`### ${SEVERITY_LABEL[severity]}`);
    lines.push("");
    for (const [ruleId, { finding, count }] of distinctRules(findings)) {
      const sites = count === 1 ? "1 site" : `${count} sites`;
      lines.push(`- [ ] ${finding.replacement} (\`${ruleId}\`, ${sites}, [spec](${finding.specLink}))`);
    }
    lines.push("");
  }

  lines.push("## Findings");
  lines.push("");
  for (const severity of SEVERITY_ORDER) {
    const findings = groups.get(severity)!;
    if (findings.length === 0) continue;
    lines.push(`### ${SEVERITY_LABEL[severity]}`);
    lines.push("");
    lines.push(SEVERITY_INTRO[severity]);
    lines.push("");
    for (const [ruleId, { finding }] of distinctRules(findings)) {
      lines.push(`#### \`${ruleId}\``);
      lines.push("");
      lines.push(`${finding.message} ([spec](${finding.specLink}))`);
      lines.push("");
      lines.push(`Fix: ${finding.replacement}`);
      lines.push("");
      for (const site of findings.filter((f) => f.ruleId === ruleId)) {
        lines.push(`- \`${site.file}:${site.line}\` \`${site.excerpt}\``);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
