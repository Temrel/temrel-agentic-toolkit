export type Severity = "breaks" | "deprecated" | "advisory";

export type RuleLanguage = "python" | "typescript" | "go" | "csharp" | "any";

export interface Rule {
  id: string;
  languages: RuleLanguage[];
  /** Restrict the rule to files with this exact basename (e.g. package.json). */
  fileName?: string;
  pattern: string;
  flags?: string;
  severity: Severity;
  message: string;
  replacement: string;
  specLink: string;
}

export interface RulesFile {
  version: string;
  specLinks: Record<string, string>;
  rules: Rule[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  replacement: string;
  specLink: string;
  /** Path relative to the scan root. */
  file: string;
  line: number;
  excerpt: string;
}

export interface SeverityCounts {
  breaks: number;
  deprecated: number;
  advisory: number;
}

export interface AuditResult {
  target: string;
  rulesVersion: string;
  filesScanned: number;
  findings: Finding[];
  counts: SeverityCounts;
}

export const SEVERITY_ORDER: Severity[] = ["breaks", "deprecated", "advisory"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  breaks: "BREAKS",
  deprecated: "DEPRECATED",
  advisory: "ADVISORY",
};
