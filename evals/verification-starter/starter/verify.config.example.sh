# verify.config.example.sh : copy this file to verify.config.sh and fill it in.
#
#   cp verify.config.example.sh verify.config.sh
#
# Every gate is a shell command run from your repo root. Leave a gate empty to
# skip it. Start with one gate (tests or typecheck) and add the rest later.

# ---- Tier 1: code-based graders (deterministic, cheap, run first) ----

GATE_TYPECHECK=""   # e.g. "npx tsc --noEmit"      or "mypy ."         or "go vet ./..."
GATE_TEST=""        # e.g. "npm test"              or "pytest -q"      or "go test ./..."
GATE_LINT=""        # e.g. "npx eslint ."          or "ruff check ."   or "golangci-lint run"
GATE_BUILD=""       # e.g. "npm run build"         or "cargo build"    or "docker build ."

# ---- Tier 2: model-based grader (LLM as judge) ----
#
# Any command that reads a prompt on stdin and prints the model's reply on
# stdout. Pick whichever CLI you already have:
#
#   Claude Code:   JUDGE_CMD="claude -p"
#   llm CLI:       JUDGE_CMD="llm -m claude-sonnet-5"
#   Ollama:        JUDGE_CMD="ollama run llama3"
#   Your own:      JUDGE_CMD="./my-judge-wrapper.sh"

JUDGE_CMD=""

# ---- Diff source for check mode ----
#
# How to produce the diff that gets judged against the stated intent.
# "git diff HEAD" covers staged plus unstaged changes. For judging a whole
# branch, try "git diff main...HEAD".

DIFF_CMD="git diff HEAD"

# ---- Eval settings ----
#
# Minimum percentage of cases in cases/cases.jsonl the judge must classify
# correctly for ./verify.sh eval to pass.

EVAL_THRESHOLD=90
