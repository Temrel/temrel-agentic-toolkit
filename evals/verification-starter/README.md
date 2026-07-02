# verification-starter

**What:** A copy-me starter kit for verifying agent-written code: deterministic gates, an LLM-as-judge review of the diff against stated intent, and a small eval harness that scores the judge against your recorded failures.

**Why:** Agents write PRs in seconds and you pay for it at review time (the audit tax). A verification layer pays that tax on purpose: machines clear the first hurdles, and your eyes go only where they are needed.

## The three tiers

The starter implements the grader stack from Anthropic's eval framing, in the order you should run it:

1. **Code-based graders** (tier 1): typecheck, tests, lint, build. Deterministic, cheap, and fast. They catch the stupid mistakes for free.
2. **Model-based grader** (tier 2): an LLM judge that reads the diff against the stated intent, not just whether it builds. It catches silent no-ops, pretend implementations, deleted tests, and scope creep.
3. **Human grader** (tier 3): you. Anything that survives tiers 1 and 2 gets your eyes, with a report telling you where to look first.

## What's in the box

```
starter/
  verify.sh                    the runner (gates / check / eval)
  verify.config.example.sh     your commands go here: gates, judge, threshold
  graders/
    code-graders.sh            tier 1: deterministic gates
    judge.sh                   tier 2: LLM-as-judge plumbing
  judge/
    rubric.md                  the judge prompt: diff versus intent, strict JSON verdict
  cases/
    cases.jsonl                your recorded agent failures (3 worked examples included)
    SCHEMA.md                  the case format, and how to grow to 20 cases
    diffs/                     diff fixtures for the example cases
  triggers/
    README.md                  wiring: git hook, Claude Code hook, watch loop
    pre-push.sh                example git pre-push hook
  report/                      verify.sh writes report.md and report.json here
```

## Quickstart

1. Copy the `starter/` folder into your repo, for example as `verification/`.
2. Create your config and fill in the commands for your stack:

   ```sh
   cd verification
   cp verify.config.example.sh verify.config.sh
   ```

3. Run the deterministic gates (tier 1):

   ```sh
   ./verify.sh gates
   ```

4. Judge your current diff against what it was supposed to do (tiers 1 + 2):

   ```sh
   ./verify.sh check --intent "Add rate limiting to the login endpoint"
   ```

5. Score the judge against recorded cases (the eval):

   ```sh
   ./verify.sh eval
   ```

Every run writes `report/report.md` and `report/report.json`. Exit codes: 0 pass, 1 a gate failed, 2 the judge failed or the eval fell below threshold, 3 config or usage error.

## The judge is any CLI you already have

`JUDGE_CMD` is any command that reads a prompt on stdin and prints the model's reply on stdout:

```sh
JUDGE_CMD="claude -p"                  # Claude Code
JUDGE_CMD="llm -m claude-sonnet-5"     # llm CLI
JUDGE_CMD="ollama run llama3"          # local model
```

No SDK, no API keys handled by this tool, no provider lock-in.

## The eval loop

Every time an agent PR gets kicked back in review, record it: save the diff, write down the intent, note the verdict a careful reviewer gave. That is one line in `cases/cases.jsonl`. At around 20 cases, `./verify.sh eval` tells you, with a number instead of a feeling, whether your judge catches the failures you actually see. When you tighten the rubric, re-run the eval to prove it got better and not worse.

Then wire it on a trigger (git hook, Claude Code hook, or a watch loop) so it fires without you remembering to fire it. See [triggers/README.md](./starter/triggers/README.md).

## Config generator

The [browser page](./index.html) for this item explains the three tiers and generates a filled-in `verify.config.sh` from the commands you type. Everything runs locally in your browser; nothing is uploaded.

## Requirements

- bash and git (anywhere)
- [jq](https://jqlang.org) for JSON handling
- any LLM CLI for tier 2 (optional: tier 1 works without one)

## Notes and limits

- The judge is a model: it will sometimes be wrong. That is exactly why the eval exists, and why tier 3 is a human.
- Judge calls cost tokens. The gates are free; run them first and often, and the judge on checkpoints.
- The example cases are synthetic seeds. The starter becomes genuinely yours when the cases are your real failures.

## Introduced in

Temrel issue: [The Audit Tax: why your agent made you slower](https://spark.temrel.com/p/the-audit-tax-why-your-agent-made-you-slower-d4e0). Back to the repo: [temrel-agentic-toolkit](https://github.com/temrel/temrel-agentic-toolkit).

## Subscribe

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new agentic-engineering tool or skill every week.
