# autonomy-audit (skill)

A human-invoked skill that inventories every behaviour a Claude Code setup can trigger — hooks, skills, MCP servers, permission allow/deny rules, and CLAUDE.md directives — across both the user scope (`~/.claude`) and the current project. Each behaviour is classified as auto-firing, manual, or ambiguous, scored on three cost-of-wrong axes (token/time spend, reversibility, blast radius), and given a recommended trigger policy. The output is a markdown report (`autonomy-audit.md`) with an inventory table and diff-style suggested changes. The audit itself never edits a config.

## Why

Autonomy is a budget allocated per-behaviour, not a slider. A hook with a `*` matcher that runs the test suite, a skill whose description says "use whenever the user mentions X", a pre-approved `Bash(curl *)` rule — each one silently spends compute or touches the outside world without a human in the loop. The worst leaks are ambiguous skill descriptions: the model decides whether they fire based on phrasing alone, so the budget is being allocated by accident. The default rule this skill applies: anything that can spend more than ~1 minute of compute or touch anything external defaults to manual until it has earned auto; cheap + reversible + local may stay auto.

Fittingly, this skill is explicit-invoke-only (`disable-model-invocation: true`). A skill that audits autonomy leaks must not be one.

## What's in the folder

- `SKILL.md` — orchestration: run the script, refine its heuristics with judgment, summarize.
- `scripts/autonomy_audit.py` — the deterministic part: discovery, parsing, classification, scoring, and report generation. Stdlib-only Python 3, no network calls, read-only with respect to configs.
- `scripts/test_autonomy_audit.py` + `scripts/fixtures/` — unit tests against fixture configs (a wildcard hook, an auto-trigger skill description, remote and local MCP server entries). Run with `python3 -m unittest test_autonomy_audit` from `scripts/`.

## Install

```sh
git clone https://github.com/Temrel/temrel-agentic-toolkit.git
mkdir -p /path/to/your-repo/.claude/skills
cp -r temrel-agentic-toolkit/skills/human-invoked/autonomy-audit /path/to/your-repo/.claude/skills/
```

Or globally: `cp -r ... ~/.claude/skills/`. The folder must contain `SKILL.md` directly. The script can also be run standalone, no agent required:

```sh
python3 scripts/autonomy_audit.py            # audit cwd + user scope
python3 scripts/autonomy_audit.py /some/repo # audit another project
python3 scripts/autonomy_audit.py --no-user  # project scope only
```

Exit code 1 means changes are recommended, so it doubles as a CI check on repos that ship agent config.

## Use

Type `/autonomy-audit` (optionally with a path). The agent runs the scan, refines the mechanical suggestions — especially rewording ambiguous skill descriptions — and hands you `autonomy-audit.md`. Nothing is changed until you apply the diffs yourself.

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
