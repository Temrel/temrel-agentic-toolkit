import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Rule, RulesFile, Severity } from "./types.js";

const VALID_SEVERITIES: Severity[] = ["breaks", "deprecated", "advisory"];
const VALID_LANGUAGES = ["python", "typescript", "go", "csharp", "any"];

export const DEFAULT_RULES_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "rules.json",
);

export interface CompiledRule extends Rule {
  regex: RegExp;
}

export function validateRules(parsed: RulesFile): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  if (!parsed.version) errors.push("rules file is missing a version");
  if (!Array.isArray(parsed.rules) || parsed.rules.length === 0) {
    errors.push("rules file has no rules");
    return errors;
  }
  for (const rule of parsed.rules) {
    const label = rule.id ?? "<missing id>";
    if (!rule.id) errors.push("a rule is missing an id");
    if (seen.has(rule.id)) errors.push(`duplicate rule id: ${label}`);
    seen.add(rule.id);
    if (!VALID_SEVERITIES.includes(rule.severity)) {
      errors.push(`rule ${label}: invalid severity "${rule.severity}"`);
    }
    if (!Array.isArray(rule.languages) || rule.languages.length === 0) {
      errors.push(`rule ${label}: missing languages`);
    } else {
      for (const lang of rule.languages) {
        if (!VALID_LANGUAGES.includes(lang)) {
          errors.push(`rule ${label}: unknown language "${lang}"`);
        }
      }
    }
    for (const field of ["pattern", "message", "replacement", "specLink"] as const) {
      if (!rule[field]) errors.push(`rule ${label}: missing ${field}`);
    }
    try {
      new RegExp(rule.pattern, rule.flags ?? "");
    } catch (err) {
      errors.push(`rule ${label}: pattern does not compile (${String(err)})`);
    }
  }
  return errors;
}

export async function loadRules(rulesPath?: string): Promise<{
  version: string;
  rules: CompiledRule[];
}> {
  const filePath = rulesPath ?? DEFAULT_RULES_PATH;
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as RulesFile;
  const errors = validateRules(parsed);
  if (errors.length > 0) {
    throw new Error(`Invalid rules file ${filePath}:\n  ${errors.join("\n  ")}`);
  }
  return {
    version: parsed.version,
    rules: parsed.rules.map((rule) => ({
      ...rule,
      regex: new RegExp(rule.pattern, rule.flags ?? ""),
    })),
  };
}
