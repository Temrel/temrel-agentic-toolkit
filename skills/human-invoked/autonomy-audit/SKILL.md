---
name: autonomy-audit
description: Inventory every behaviour this Claude Code setup can trigger (hooks, skills, MCP servers, permission rules, CLAUDE.md directives), classify each as auto-firing or manual, tag its cost-of-wrong, and write a recommended trigger policy to autonomy-audit.md. Takes an optional path to audit a different project.
disable-model-invocation: true
---

# Autonomy audit

Autonomy is a budget allocated per-behaviour, not a slider. Running `/autonomy-audit` inventories everything the current Claude Code setup can do without being asked, scores what each behaviour costs when it fires wrongly, and proposes — never applies — a trigger policy. This skill is itself explicit-invoke-only (`disable-model-invocation: true`), because a skill that audits autonomy leaks must not be one.

## Instructions

1. Run the discovery script from this skill's folder. It is stdlib-only Python, read-only with respect to configs, and writes `autonomy-audit.md` to the cwd:

   ```sh
   python3 <skill-dir>/scripts/autonomy_audit.py [PATH] --json
   ```

   With no argument it audits the cwd plus the user scope (`~/.claude`, `~/.claude.json`). If the user gave a path, pass it as `PATH`. Exit 0 means no changes recommended, 1 means changes recommended, 2 means the scan failed — read stderr and fix the invocation before proceeding.

2. Read the JSON on stdout. Each behaviour has `kind`, `name`, `source`, `trigger` (`auto` / `manual` / `ambiguous`), the three cost axes (`spend`, `reversibility`, `blast_radius`, each low/med/high, high = worse), a `recommendation` (`auto ok` / `review` / `manual` / `keep`), and optionally a mechanical `suggestion` diff.

3. Refine the report with judgment the script cannot apply. The script's classifications are keyword heuristics; you have the actual text. In `autonomy-audit.md`:
   - For each skill flagged **ambiguous**, read its real description and replace the script's generic advice with a concrete reworded description (e.g. change "use whenever X is mentioned" to "use only when the user explicitly asks to X"), keeping the skill's genuine purpose intact.
   - Correct any row where the heuristic plainly misfired (e.g. a "delete" keyword inside a doc sentence), and say you corrected it.
   - Edit only `autonomy-audit.md`. Never edit settings.json, SKILL.md files, .mcp.json, or CLAUDE.md — the audit proposes, the human applies.

4. Summarize for the user, leading with the budget picture:
   - How many behaviours can fire without being asked, and which of those are expensive or external.
   - The ambiguous skill descriptions, by name — these are the silent autonomy leaks, because the model decides whether they fire based on phrasing alone.
   - The top 3–5 suggested changes, and a pointer to `autonomy-audit.md` for the rest.

## The policy rule being applied

Anything that can spend more than ~1 minute of compute, or touch anything external (network, filesystem outside the repo, prod systems, or sends data out), defaults to **manual until it has earned auto**. Cheap + reversible + local may stay auto. Guardrails (deny rules, "never do X" instructions) are kept.

## Done when

`autonomy-audit.md` exists in the cwd with the inventory table, ambiguous-skill flags, and refined suggested changes; the user has the summary; no config file was modified.
