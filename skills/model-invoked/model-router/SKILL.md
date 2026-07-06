---
name: model-router
description: Recommend a model tier (Haiku / Sonnet / Opus) for a coding task by scoring it on scope, novelty, risk, and expected iteration. Use when the user describes a task they are about to start, or explicitly asks "which model should I use for this".
---

# Model router

Recommend which model tier a task warrants, so routine work doesn't burn Opus-tier tokens and hard work doesn't get under-powered.

## When to use this

- The user describes a task they are about to start (a feature, fix, refactor, script, migration) and hasn't yet picked a model.
- The user explicitly asks "which model should I use for this" or similar.

Never refuse to answer. If the task description is ambiguous, score conservatively (round the uncertain axis up, not down) and say which axis is uncertain.

## Scoring rubric

Score the task on four axes, each 1–3:

| Axis | 1 | 2 | 3 |
| --- | --- | --- | --- |
| **Scope** | Single-file edit | Multi-file feature | Cross-cutting refactor or greenfield system |
| **Novelty** | Pattern exists in repo | Familiar domain, new pattern | Unfamiliar domain or algorithmically hard |
| **Risk** | Throwaway or easily reverted | User-facing but tested | Data-touching, security-sensitive, or hard to roll back |
| **Iteration** | Likely one-shot | A few review cycles | Long-horizon agentic session with many tool calls |

## Routing rule

| Total score | Recommendation |
| --- | --- |
| 4–6 | Haiku-tier (mechanical edits, renames, boilerplate) |
| 7–9 | Sonnet 5 (the default; medium-effort agentic work) |
| 10–12 | Opus-tier (high ambiguity, high risk, long horizon) |

**Override:** if Risk scores 3, bump the recommendation up one tier (Haiku → Sonnet, Sonnet → Opus; Opus stays Opus).

## Output format

Keep the whole answer under 15 lines:

1. The recommendation, first line, bolded.
2. The four scores, one line each, with one-line reasoning per axis.
3. The estimated relative cost multiplier vs the recommended tier if the user insists on the tier above (per-Mtok list price ratio: Haiku→Sonnet ≈ 3x, Sonnet→Opus ≈ 1.7x on input / 1.7x on output; Opus→Fable ≈ 2x). If Opus is already recommended, note Fable 5 as the tier above.

## Example

> Task: "Rename a config key across the repo and update the docs."

**Recommendation: Haiku-tier** (total 5, no override)
- Scope 2 — touches many files, but mechanically.
- Novelty 1 — pure find-and-replace, pattern exists.
- Risk 1 — trivially reverted in one commit.
- Iteration 1 — one-shot with a grep to verify.
Insisting on Sonnet 5 instead ≈ 3x the per-token cost for no quality gain.
