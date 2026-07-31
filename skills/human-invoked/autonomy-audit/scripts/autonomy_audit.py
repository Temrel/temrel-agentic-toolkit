#!/usr/bin/env python3
"""autonomy-audit: inventory every behaviour a Claude Code setup can trigger.

Discovers hooks, skills, MCP servers, permission rules, and CLAUDE.md
directives across the user scope (~/.claude) and a project, classifies each
as auto-firing / manual / ambiguous, scores cost-of-wrong on three axes
(token/time spend, reversibility, blast radius), and writes a markdown
report with a recommended trigger policy and diff-style suggested changes.

Read-only with respect to configs: the only file it writes is the report.

Usage:
    python3 autonomy_audit.py [PROJECT_PATH] [--out autonomy-audit.md]
                              [--json] [--no-user]
                              [--user-scope DIR] [--claude-json FILE]

Exit codes: 0 = no policy changes needed, 1 = changes recommended,
2 = scan failed.

Stdlib only. Heuristics are keyword-based and deliberately conservative:
they over-flag rather than under-flag, and the report says so.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys

LEVELS = {"low": 0, "med": 1, "high": 2}
EXCLUDE_DIRS = {".git", "node_modules", "dist", "build", ".venv", "venv",
                "__pycache__", "fixtures"}

# --- classification vocabularies -------------------------------------------

AUTO_PHRASES = [
    "whenever", "use when", "any time", "anytime", "automatically",
    "trigger", "triggers", "activates when", "applies when", "applies to",
    "use this skill when", "user mentions", "or mentions", "proactively",
    "read before", "load this", "even without the word", "even if",
]
MANUAL_PHRASES = [
    "only when the user explicitly", "explicitly asks", "explicitly invoke",
    "user asks", "user requests", "slash command", "user invokes",
    "invoked by the user", "when asked",
]

SPEND_HIGH = [
    "npm test", "npm run", "npm ci", "npm install", "pytest", "tox",
    "make ", "docker", "build", "install", "compile", "tsc", "webpack",
    "cargo", "gradle", "mvn", "terraform", "scan", "audit", "claude -p",
    "test suite", "full sweep", "e2e",
]
SPEND_LOW_STARTS = {
    "echo", "printf", "jq", "cat", "true", "date", "osascript", "afplay",
    "say", "notify-send", "touch", "ls", "pwd", "which", "head", "tail",
}

BLAST_HIGH = [
    "git push", "deploy", "publish", "ssh ", "scp ", "rsync", "aws ",
    "gcloud", "az ", "kubectl", "sendmail", "slack", "webhook", "prod",
    "sudo", "send", "email", "post ",
]
BLAST_MED = [
    "curl", "wget", "http://", "https://", "gh ", "api", "fetch",
    "~/", "$home", "/etc", "/usr", "/var", "network",
]

REV_HIGH = [
    "rm ", "rm -", "delete", "drop ", "--force", "reset --hard", "push",
    "publish", "send", "deploy", "truncate", "kill ", "overwrite",
]
REV_MED = [
    "sed -i", " > ", "tee ", "mv ", "cp ", "git commit", "write", "edit",
    "chmod", "install", "fix", "apply", "create", "save",
]

INSTR_GUARD = re.compile(r"(?i)\b(never|do not|don'?t|must not)\b")
INSTR_AUTO = re.compile(
    r"(?i)\b(always|automatically|whenever|every time|each time|"
    r"by default|proactively|must|prefer)\b")

READONLY_TOOL_PREFIXES = ("get_", "list_", "read_", "search_", "describe_",
                          "fetch_", "find_", "query_")


def _lvl_max(*levels: str) -> str:
    return max(levels, key=lambda l: LEVELS[l])


def _hit(text: str, phrases) -> bool:
    # word-boundary matching so e.g. "gh " never matches inside "high "
    for p in phrases:
        pat = re.escape(p)
        if p[0].isalnum():
            pat = r"\b" + pat
        if p[-1].isalnum():
            pat = pat + r"\b"
        if re.search(pat, text):
            return True
    return False


# --- scoring ----------------------------------------------------------------

def score_command(cmd: str):
    """Score a shell command string -> (spend, reversibility, blast)."""
    c = " " + cmd.lower().strip() + " "
    first = cmd.strip().split()[0] if cmd.strip() else ""

    if _hit(c, SPEND_HIGH):
        spend = "high"
    elif first in SPEND_LOW_STARTS and len(cmd) < 120:
        spend = "low"
    else:
        spend = "med"

    if _hit(c, REV_HIGH):
        rev = "high"
    elif _hit(c, REV_MED):
        rev = "med"
    else:
        rev = "low"

    if _hit(c, BLAST_HIGH):
        blast = "high"
    elif _hit(c, BLAST_MED):
        blast = "med"
    else:
        blast = "low"

    return spend, rev, blast


def score_skill(description: str, body: str):
    """Score a skill from its description + body text."""
    text = (description + " " + body).lower()
    runs_commands = ("```sh" in body or "```bash" in body
                     or re.search(r"(?im)^\s*\d+\.\s+run\b", body))
    if _hit(text, SPEND_HIGH):
        spend = "high"
    elif runs_commands:
        spend = "med"
    else:
        spend = "low"

    if _hit(text, REV_HIGH):
        rev = "high"
    elif re.search(r"(?i)\b(edit|write|fix|apply|modify|create)\b", text):
        rev = "med"
    else:
        rev = "low"

    if _hit(text, BLAST_HIGH):
        blast = "high"
    elif _hit(text, BLAST_MED):
        blast = "med"
    else:
        blast = "low"

    return spend, rev, blast


def classify_description(description: str, disable_model_invocation: bool):
    """Classify a skill's trigger from its frontmatter -> auto|manual|ambiguous."""
    if disable_model_invocation:
        return "manual"
    d = (description or "").lower()
    auto = _hit(d, AUTO_PHRASES)
    manual = _hit(d, MANUAL_PHRASES)
    if auto and not manual:
        return "auto"
    if manual and not auto:
        return "manual"
    return "ambiguous"


def recommend(kind: str, spend: str, rev: str, blast: str) -> str:
    if kind in ("guardrail", "permission-deny"):
        return "keep"
    if spend == "high" or blast in ("med", "high") or rev == "high":
        return "manual"
    if spend == "low" and rev == "low" and blast == "low":
        return "auto ok"
    return "review"


def behaviour(kind, name, source, trigger, spend, rev, blast,
              detail="", suggestion=None, active=True):
    return {
        "kind": kind,
        "name": name,
        "source": source,
        "trigger": trigger,
        "spend": spend,
        "reversibility": rev,
        "blast_radius": blast,
        "recommendation": recommend(kind, spend, rev, blast),
        "detail": detail,
        "suggestion": suggestion,
        "active": active,
    }


# --- parsing helpers ---------------------------------------------------------

def load_json(path: str, warnings: list):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except (json.JSONDecodeError, OSError) as e:
        warnings.append(f"could not parse {path}: {e}")
        return None


def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    out, key = {}, None
    for line in text[3:end].splitlines():
        if not line.strip():
            continue
        m = re.match(r"^([A-Za-z][\w-]*):\s*(.*)$", line)
        if m:
            key = m.group(1)
            out[key] = m.group(2).strip()
        elif key:
            out[key] += " " + line.strip()
    return out


def truncate(s: str, n: int = 70) -> str:
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


# --- discovery ---------------------------------------------------------------

def discover_hooks(settings: dict, source: str):
    out = []
    for event, entries in (settings.get("hooks") or {}).items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            matcher = entry.get("matcher", "")
            for hook in entry.get("hooks", []):
                cmd = hook.get("command", "")
                spend, rev, blast = score_command(cmd)
                suggestion = None
                if matcher in ("", "*"):
                    suggestion = {
                        "type": "narrow-hook-matcher",
                        "diff": (
                            f"# {source} — {event} hook\n"
                            f'- "matcher": "{matcher or ""}"\n'
                            f'+ "matcher": "<only the tools this hook actually '
                            f'needs, e.g. Write|Edit>"'
                        ),
                    }
                out.append(behaviour(
                    "hook",
                    f"{event} hook: {truncate(cmd, 50)}",
                    source, "auto", spend, rev, blast,
                    detail=f"matcher={matcher!r} command={truncate(cmd, 120)}",
                    suggestion=suggestion,
                ))
    return out


def discover_skills(root: str, source_label: str, active: bool = True):
    out = []
    if not os.path.isdir(root):
        return out
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        if "SKILL.md" not in filenames:
            continue
        path = os.path.join(dirpath, "SKILL.md")
        try:
            with open(path, encoding="utf-8") as f:
                text = f.read()
        except OSError:
            continue
        fm = parse_frontmatter(text)
        name = fm.get("name") or os.path.basename(dirpath)
        desc = fm.get("description", "")
        dmi = str(fm.get("disable-model-invocation", "")).lower() == "true"
        trigger = classify_description(desc, dmi)
        spend, rev, blast = score_skill(desc, text)
        suggestion = None
        if trigger in ("auto", "ambiguous") and \
                recommend("skill", spend, rev, blast) != "auto ok":
            rel = os.path.relpath(path, start=os.path.expanduser("~")) \
                if path.startswith(os.path.expanduser("~")) else path
            suggestion = {
                "type": "gate-skill",
                "diff": (
                    f"# {rel} — frontmatter\n"
                    f" ---\n name: {name}\n"
                    f" description: {truncate(desc, 90)}\n"
                    f"+disable-model-invocation: true\n ---"
                ),
                "note": ("or reword the description from a proactive trigger "
                         "('use whenever…') to explicit-invoke-only "
                         "('use only when the user explicitly asks…')"),
            }
        out.append(behaviour(
            "skill", f"skill: {name}", path, trigger, spend, rev, blast,
            detail=truncate(desc, 160), suggestion=suggestion, active=active,
        ))
    return out


def discover_mcp(config: dict, source: str):
    out = []
    for name, spec in (config or {}).items():
        if not isinstance(spec, dict):
            continue
        url = spec.get("url", "")
        is_remote = bool(url) or spec.get("type") in ("http", "sse")
        tools = spec.get("tools") or spec.get("allowedTools") or []
        detail = (f"url={url}" if is_remote
                  else f"command={truncate(str(spec.get('command', '')) + ' ' + ' '.join(spec.get('args', [])), 100)}")
        if tools:
            detail += f" tools={','.join(map(str, tools))}"
        blast = "high" if is_remote else "med"
        suggestion = {
            "type": "review-mcp",
            "diff": (
                f"# {source} — mcpServers.{name}\n"
                f"  keep only if actively used; otherwise remove, or deny "
                f"write-shaped tools:\n"
                f'+ "permissions": {{ "ask": ["mcp__{name}__*"] }}'
            ),
        }
        out.append(behaviour(
            "mcp-server", f"MCP server: {name}", source, "auto",
            "low", "med", blast, detail=detail, suggestion=suggestion,
        ))
    return out


def _parse_rule(rule: str):
    m = re.match(r"^([\w-]+)\((.*)\)$", rule)
    if m:
        return m.group(1), m.group(2)
    return rule, ""


def discover_permissions(settings: dict, source: str):
    out = []
    perms = settings.get("permissions") or {}
    allow = perms.get("allow") or []
    deny = perms.get("deny") or []
    quiet = 0
    for rule in allow:
        tool, inner = _parse_rule(rule)
        if tool == "Bash":
            spend, rev, blast = score_command(inner)
            tokens = inner.rstrip("* ").split()
            broad = inner.rstrip().endswith("*") and len(tokens) <= 1
            if broad:
                spend = _lvl_max(spend, "med")
                rev = _lvl_max(rev, "med")
        elif tool in ("WebFetch", "WebSearch"):
            spend, rev, blast = "low", "low", "med"
        elif rule.startswith("mcp__"):
            tool_name = rule.split("__")[-1]
            ro = tool_name.startswith(READONLY_TOOL_PREFIXES)
            spend, rev, blast = "low", ("low" if ro else "high"), "med"
        else:
            spend, rev, blast = "low", "low", "low"
        rec = recommend("permission-allow", spend, rev, blast)
        if rec == "auto ok":
            quiet += 1
            continue
        suggestion = None
        if rec == "manual" and tool == "Bash" and "*" in rule:
            suggestion = {
                "type": "tighten-allow-rule",
                "diff": (
                    f"# {source} — permissions.allow\n"
                    f'- "{rule}"\n'
                    f'+ "Bash({inner.rstrip("* ").strip() or "<cmd>"} '
                    f'<narrower pattern>)"  # or delete: this pre-approves '
                    f"an open-ended command class"
                ),
            }
        elif rec == "manual":
            suggestion = {
                "type": "remove-stale-allow-rule",
                "diff": (
                    f"# {source} — permissions.allow\n"
                    f'- "{rule}"  # standing approval that touches the '
                    f"outside world; remove and re-approve interactively "
                    f"when needed"
                ),
            }
        out.append(behaviour(
            "permission-allow", f"allow rule: {truncate(rule, 60)}",
            source, "auto", spend, rev, blast,
            detail="pre-approved; runs without a prompt when the model "
                   "chooses to", suggestion=suggestion,
        ))
    if quiet:
        out.append(behaviour(
            "permission-allow", f"{quiet} low-risk allow rules (aggregated)",
            source, "auto", "low", "low", "low",
            detail="read-only or trivially cheap; individually omitted",
        ))
    if deny:
        out.append(behaviour(
            "permission-deny", f"{len(deny)} deny rules", source, "n/a",
            "low", "low", "low",
            detail="; ".join(truncate(r, 40) for r in deny[:5]),
        ))
    return out


def discover_instructions(path: str, source: str):
    out = []
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except OSError:
        return out
    # join wrapped bullet/paragraph lines into logical blocks so a
    # multi-line bullet is classified once, not per fragment
    blocks: list[str] = []
    in_fence = False
    prev_blank = True
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or stripped.startswith("#"):
            prev_blank = True
            continue
        if not stripped:
            prev_blank = True
            continue
        new_block = prev_blank or re.match(r"^\s*([-*+]|\d+\.)\s", line)
        if new_block or not blocks:
            blocks.append(stripped)
        else:
            blocks[-1] += " " + stripped
        prev_blank = False

    for stripped in blocks:
        if INSTR_GUARD.search(stripped):
            out.append(behaviour(
                "guardrail", f"instruction: {truncate(stripped, 60)}",
                source, "n/a", "low", "low", "low",
                detail=truncate(stripped, 160),
            ))
        elif INSTR_AUTO.search(stripped):
            spend, rev, blast = score_command(stripped)
            out.append(behaviour(
                "instruction", f"instruction: {truncate(stripped, 60)}",
                source, "auto", spend, rev, blast,
                detail=truncate(stripped, 160),
                suggestion={
                    "type": "scope-instruction",
                    "diff": (f"# {source}\n- {truncate(stripped, 100)}\n"
                             f"+ <same rule, scoped: name the exact situation "
                             f"it applies to, or move it into an "
                             f"explicit-invoke skill>"),
                } if recommend("instruction", spend, rev, blast) != "auto ok"
                else None,
            ))
        if len(out) >= 40:
            break
    return out


# --- audit -------------------------------------------------------------------

def audit(project: str, user_scope: str | None, claude_json: str | None):
    warnings: list[str] = []
    behaviours: list[dict] = []
    scanned: list[str] = []
    project = os.path.abspath(project)

    def take(path, fn, *args):
        if os.path.exists(path):
            scanned.append(path)
            return fn(*args)
        return []

    # user scope
    if user_scope:
        for fname in ("settings.json", "settings.local.json"):
            spath = os.path.join(user_scope, fname)
            settings = load_json(spath, warnings)
            if settings:
                scanned.append(spath)
                behaviours += discover_hooks(settings, spath)
                behaviours += discover_permissions(settings, spath)
        skills_dir = os.path.join(user_scope, "skills")
        behaviours += take(skills_dir, discover_skills, skills_dir,
                           "user")
        cmd_path = os.path.join(user_scope, "CLAUDE.md")
        behaviours += take(cmd_path, discover_instructions, cmd_path,
                           cmd_path)
        if claude_json:
            cj = load_json(claude_json, warnings)
            if cj:
                scanned.append(claude_json)
                behaviours += discover_mcp(cj.get("mcpServers"), claude_json)
                proj_entry = (cj.get("projects") or {}).get(project) or {}
                behaviours += discover_mcp(
                    proj_entry.get("mcpServers"),
                    f"{claude_json} (projects[{project}])")

    # project scope
    for fname in ("settings.json", "settings.local.json"):
        spath = os.path.join(project, ".claude", fname)
        settings = load_json(spath, warnings)
        if settings:
            scanned.append(spath)
            behaviours += discover_hooks(settings, spath)
            behaviours += discover_permissions(settings, spath)
            behaviours += discover_mcp(settings.get("mcpServers"), spath)
    mcp_path = os.path.join(project, ".mcp.json")
    mcp_cfg = load_json(mcp_path, warnings)
    if mcp_cfg:
        scanned.append(mcp_path)
        behaviours += discover_mcp(mcp_cfg.get("mcpServers"), mcp_path)

    proj_skills = os.path.join(project, ".claude", "skills")
    behaviours += take(proj_skills, discover_skills, proj_skills, "project")
    # skills the repo distributes but has not installed into .claude/
    seen = {b["source"] for b in behaviours}
    for dirpath, dirnames, filenames in os.walk(project):
        dirnames[:] = [d for d in dirnames
                       if d not in EXCLUDE_DIRS and d != ".claude"]
        if "SKILL.md" in filenames:
            path = os.path.join(dirpath, "SKILL.md")
            if path not in seen:
                behaviours += discover_skills(dirpath, "repo", active=False)
                dirnames[:] = []

    for fname in ("CLAUDE.md", "CLAUDE.local.md",
                  os.path.join(".claude", "CLAUDE.md")):
        p = os.path.join(project, fname)
        behaviours += take(p, discover_instructions, p, p)

    kind_order = {"hook": 0, "skill": 1, "mcp-server": 2,
                  "permission-allow": 3, "permission-deny": 4,
                  "instruction": 5, "guardrail": 6}
    behaviours.sort(key=lambda b: (kind_order.get(b["kind"], 9), b["name"]))
    return {
        "meta": {
            "project": project,
            "user_scope": user_scope,
            "scanned": scanned,
            "warnings": warnings,
            "generated": datetime.date.today().isoformat(),
        },
        "behaviours": behaviours,
    }


# --- report ------------------------------------------------------------------

def render_markdown(result: dict) -> str:
    meta, bs = result["meta"], result["behaviours"]
    changes = [b for b in bs if b["suggestion"]
               and b["trigger"] in ("auto", "ambiguous")
               and b["recommendation"] in ("manual", "review")]
    ambiguous = [b for b in bs if b["kind"] == "skill"
                 and b["trigger"] == "ambiguous"]
    lines = [
        "# Autonomy audit",
        "",
        f"Generated {meta['generated']} for `{meta['project']}` "
        f"(user scope: `{meta['user_scope'] or 'skipped'}`).",
        "",
        "Autonomy is a budget allocated per-behaviour, not a slider. This "
        "report inventories every behaviour the setup can trigger, tags its "
        "cost-of-wrong, and recommends a trigger policy. **Default rule:** "
        "anything that can spend more than ~1 minute of compute or touch "
        "anything external defaults to manual until it has earned auto; "
        "cheap + reversible + local may stay auto. All three cost axes are "
        "scored as cost-of-wrong: high = worse. Heuristics are keyword-based "
        "and conservative — verify a row before acting on it.",
        "",
        f"**Summary:** {len(bs)} behaviours · "
        f"{sum(1 for b in bs if b['trigger'] == 'auto')} auto-firing · "
        f"{len(ambiguous)} ambiguous skill descriptions · "
        f"{len(changes)} recommended policy changes.",
        "",
        "## Inventory",
        "",
        "| Behaviour | Kind | Source | Trigger | Spend | Reversibility "
        "| Blast radius | Recommended |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    home = os.path.expanduser("~")
    for b in bs:
        src = b["source"].replace(meta["project"] + os.sep, "") \
                          .replace(home, "~")
        name = b["name"] + ("" if b["active"] else " *(not installed)*")
        lines.append(
            f"| {name} | {b['kind']} | `{src}` | {b['trigger']} "
            f"| {b['spend']} | {b['reversibility']} | {b['blast_radius']} "
            f"| {b['recommendation']} |")

    lines += [
        "",
        "Recommendation legend: **manual** = gate behind explicit "
        "invocation/approval until it has earned auto; **review** = medium "
        "cost, decide per-behaviour; **auto ok** = cheap, reversible, "
        "local; **keep** = guardrail that reduces autonomy, leave in place.",
        "",
        "## Ambiguous skill descriptions (silent autonomy leaks)",
        "",
    ]
    if ambiguous:
        lines.append(
            "These descriptions neither clearly auto-trigger nor clearly "
            "restrict to explicit invocation. The model decides — "
            "which means the autonomy budget is being spent by phrasing, "
            "not policy:")
        lines.append("")
        for b in ambiguous:
            src = b["source"].replace(home, "~")
            lines.append(f"- **{b['name']}** (`{src}`): {b['detail']}")
    else:
        lines.append("None found.")

    lines += ["", "## Suggested changes", ""]
    if changes:
        lines.append(
            "Proposed edits only — this audit never modifies configs:")
        for b in changes:
            lines += ["", f"### {b['name']}", "", "```diff",
                      b["suggestion"]["diff"], "```"]
            if b["suggestion"].get("note"):
                lines.append(f"\n{b['suggestion']['note']}")
    else:
        lines.append("No changes recommended.")

    if meta["warnings"]:
        lines += ["", "## Warnings", ""]
        lines += [f"- {w}" for w in meta["warnings"]]
    lines.append("")
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("project", nargs="?", default=".",
                    help="project to audit (default: cwd)")
    ap.add_argument("--out", default="autonomy-audit.md",
                    help="markdown report path (default: autonomy-audit.md)")
    ap.add_argument("--json", action="store_true",
                    help="also print the full result as JSON to stdout")
    ap.add_argument("--no-user", action="store_true",
                    help="skip the user scope (~/.claude)")
    ap.add_argument("--user-scope", default=os.path.expanduser("~/.claude"),
                    help="override the user scope directory")
    ap.add_argument("--claude-json",
                    default=os.path.expanduser("~/.claude.json"),
                    help="override the ~/.claude.json path (MCP servers)")
    args = ap.parse_args(argv)

    try:
        result = audit(
            args.project,
            None if args.no_user else args.user_scope,
            None if args.no_user else (
                args.claude_json if os.path.exists(args.claude_json)
                else None),
        )
    except Exception as e:  # noqa: BLE001 - report scan failure as exit 2
        print(f"autonomy-audit: scan failed: {e}", file=sys.stderr)
        return 2

    report = render_markdown(result)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(report)
    if args.json:
        print(json.dumps(result, indent=2))
    changes = sum(1 for b in result["behaviours"]
                  if b["suggestion"] and b["trigger"] in ("auto", "ambiguous")
                  and b["recommendation"] in ("manual", "review"))
    print(f"autonomy-audit: {len(result['behaviours'])} behaviours, "
          f"{changes} recommended changes -> {args.out}", file=sys.stderr)
    return 1 if changes else 0


if __name__ == "__main__":
    sys.exit(main())
