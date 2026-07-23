import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CompiledRule } from "./rules.js";
import type { AuditResult, Finding, RuleLanguage, SeverityCounts } from "./types.js";
import { SEVERITY_ORDER } from "./types.js";

const EXT_LANGUAGE: Record<string, RuleLanguage> = {
  ".py": "python",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "typescript",
  ".jsx": "typescript",
  ".mjs": "typescript",
  ".cjs": "typescript",
  ".go": "go",
  ".cs": "csharp",
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  "coverage",
  ".next",
  "target",
  "bin",
  "obj",
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Whole-line comments are skipped to keep false positives down; trailing
 * comments are still matched (a "TODO migrate tasks/result" is a real signal).
 */
function isCommentLine(line: string, language: RuleLanguage): boolean {
  const trimmed = line.trimStart();
  if (language === "python") return trimmed.startsWith("#");
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*")
  );
}

async function collectFiles(root: string, specialNames: Set<string>): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ext in EXT_LANGUAGE || specialNames.has(entry.name)) files.push(full);
      }
    }
  }
  await walk(root);
  return files.sort();
}

function rulesForFile(
  rules: CompiledRule[],
  fileName: string,
  language: RuleLanguage | undefined,
): CompiledRule[] {
  return rules.filter((rule) => {
    if (rule.fileName) return rule.fileName === fileName;
    if (!language) return false;
    return rule.languages.includes("any") || rule.languages.includes(language);
  });
}

function scanContent(
  content: string,
  relPath: string,
  language: RuleLanguage | undefined,
  rules: CompiledRule[],
): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (language && isCommentLine(line, language)) continue;
    for (const rule of rules) {
      if (rule.regex.test(line)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message,
          replacement: rule.replacement,
          specLink: rule.specLink,
          file: relPath,
          line: i + 1,
          excerpt: line.trim().slice(0, 160),
        });
      }
    }
  }
  return findings;
}

export async function scan(
  target: string,
  rules: CompiledRule[],
  rulesVersion: string,
): Promise<AuditResult> {
  const root = path.resolve(target);
  const rootStat = await stat(root);
  const specialNames = new Set(
    rules.map((rule) => rule.fileName).filter((name): name is string => Boolean(name)),
  );

  const files = rootStat.isDirectory() ? await collectFiles(root, specialNames) : [root];
  const findings: Finding[] = [];
  let filesScanned = 0;

  for (const file of files) {
    const fileStat = await stat(file);
    if (fileStat.size > MAX_FILE_BYTES) continue;
    const fileName = path.basename(file);
    const language = EXT_LANGUAGE[path.extname(file)];
    const applicable = rulesForFile(rules, fileName, language);
    if (applicable.length === 0) continue;
    filesScanned++;
    const content = await readFile(file, "utf8");
    const relPath = rootStat.isDirectory() ? path.relative(root, file) : fileName;
    findings.push(...scanContent(content, relPath, language, applicable));
  }

  findings.sort((a, b) => {
    const severity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severity !== 0) return severity;
    return a.file.localeCompare(b.file) || a.line - b.line;
  });

  const counts: SeverityCounts = { breaks: 0, deprecated: 0, advisory: 0 };
  for (const finding of findings) counts[finding.severity]++;

  return { target: root, rulesVersion, filesScanned, findings, counts };
}
