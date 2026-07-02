#!/usr/bin/env bash
#
# verify.sh : runner for the verification starter.
#
# Usage:
#   ./verify.sh gates                 tier 1 only: run the code-based graders
#   ./verify.sh check [options]       tiers 1 + 2: gates, then LLM judge on the diff
#   ./verify.sh eval  [options]       score the judge against cases/cases.jsonl
#
# Options:
#   --config PATH        config file (default: verify.config.sh next to this script)
#   --intent "TEXT"      stated intent for check mode
#   --intent-file PATH   read the intent from a file instead
#   --diff-file PATH     judge this diff instead of running DIFF_CMD
#
# Exit codes:
#   0 pass, 1 a gate failed, 2 judge failed or eval below threshold, 3 config or usage error.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR="${SCRIPT_DIR}/report"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)"

# shellcheck source=graders/code-graders.sh
. "${SCRIPT_DIR}/graders/code-graders.sh"
# shellcheck source=graders/judge.sh
. "${SCRIPT_DIR}/graders/judge.sh"

say()  { printf '%s\n' "$*"; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
bad()  { printf '\033[31m%s\033[0m\n' "$*"; }
die()  { bad "verify.sh: $*" >&2; exit 3; }

usage() { sed -n '3,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

# ---------- arguments ----------

MODE="${1:-}"
case "$MODE" in
  gates|check|eval) shift ;;
  -h|--help) usage; exit 0 ;;
  "") usage; exit 3 ;;
  *) die "unknown subcommand '$MODE' (expected gates, check, or eval)" ;;
esac

CONFIG_FILE="${SCRIPT_DIR}/verify.config.sh"
INTENT=""
INTENT_FILE=""
DIFF_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --config)      CONFIG_FILE="${2:?--config needs a path}"; shift 2 ;;
    --intent)      INTENT="${2:?--intent needs text}"; shift 2 ;;
    --intent-file) INTENT_FILE="${2:?--intent-file needs a path}"; shift 2 ;;
    --diff-file)   DIFF_FILE="${2:?--diff-file needs a path}"; shift 2 ;;
    *) die "unknown option '$1'" ;;
  esac
done

# ---------- prerequisites and config ----------

command -v jq >/dev/null 2>&1 || die "jq is required (https://jqlang.org). Install it and re-run."
[ -f "$CONFIG_FILE" ] || die "no config at ${CONFIG_FILE}. Copy verify.config.example.sh to verify.config.sh and fill it in."

# Defaults, then let the config override them.
GATE_TYPECHECK=""
GATE_TEST=""
GATE_LINT=""
GATE_BUILD=""
JUDGE_CMD=""
DIFF_CMD="git diff HEAD"
EVAL_THRESHOLD=90

# shellcheck source=verify.config.example.sh
. "$CONFIG_FILE"

mkdir -p "${REPORT_DIR}/logs"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/verify.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

# ---------- report writer ----------

write_report() { # $1 mode, $2 gates json, $3 judge json, $4 eval json, $5 result
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -n --arg mode "$1" --arg ts "$ts" --arg result "$5" \
        --argjson gates "$2" --argjson judge "$3" --argjson evalr "$4" \
        '{mode: $mode, generated_at: $ts, result: $result, gates: $gates, judge: $judge, eval: $evalr}' \
        >"${REPORT_DIR}/report.json"

  {
    echo "# Verification report"
    echo
    echo "Mode: ${1}. Generated: ${ts}. Result: **$(printf '%s' "$5" | tr '[:lower:]' '[:upper:]')**."
    echo
    if [ "$(jq 'length' <<<"$2")" != "0" ]; then
      echo "## Tier 1: code-based graders"
      echo
      echo "| gate | status | seconds |"
      echo "| --- | --- | --- |"
      jq -r '.[] | "| \(.name) | \(.status) | \(.seconds // "") |"' <<<"$2"
    fi
    if [ "$3" != "null" ]; then
      echo
      echo "## Tier 2: model-based grader"
      echo
      echo "Verdict: **$(jq -r '.verdict // "error"' <<<"$3")**. $(jq -r '.summary // ""' <<<"$3")"
      if [ "$(jq -r '(.violations // []) | length' <<<"$3")" != "0" ]; then
        echo
        jq -r '(.violations // [])[] | "- " + .' <<<"$3"
      fi
    fi
    if [ "$4" != "null" ]; then
      echo
      echo "## Eval: judge versus recorded cases"
      echo
      echo "$(jq -r '.correct' <<<"$4") of $(jq -r '.total' <<<"$4") cases judged correctly ($(jq -r '.percent' <<<"$4")%). Threshold: $(jq -r '.threshold' <<<"$4")%."
      echo
      echo "| case | expected | judged | correct |"
      echo "| --- | --- | --- | --- |"
      jq -r '.cases[] | "| \(.id) | \(.expected) | \(.judged) | \(if .correct then "yes" else "NO" end) |"' <<<"$4"
    fi
    echo
    echo "## Tier 3: human grader"
    echo
    echo "This report does not replace your review. It decides where your eyes go first: read the failed gates and the judge's violations before anything else."
  } >"${REPORT_DIR}/report.md"

  say ""
  say "report     ${REPORT_DIR}/report.md"
}

# ---------- subcommands ----------

cmd_gates() {
  say "Tier 1: code-based graders"
  run_gates
  local result="pass" code=0
  if [ "$GATES_FAILED" -gt 0 ]; then result="fail"; code=1; fi
  write_report "gates" "$GATES_JSON" "null" "null" "$result"
  if [ "$code" -eq 0 ]; then ok "RESULT     pass"; else bad "RESULT     fail (${GATES_FAILED} gate(s) failed)"; fi
  exit "$code"
}

cmd_check() {
  say "Tier 1: code-based graders"
  run_gates
  local judge_json="null" verdict result="pass" code=0
  if [ "$GATES_FAILED" -gt 0 ]; then result="fail"; code=1; fi

  if [ -z "$JUDGE_CMD" ]; then
    warn "JUDGE_CMD is empty: skipping the model-based grader (tier 2)."
  else
    if [ -n "$INTENT_FILE" ]; then
      [ -f "$INTENT_FILE" ] || die "intent file not found: ${INTENT_FILE}"
      cp "$INTENT_FILE" "${TMP_DIR}/intent.txt"
    elif [ -n "$INTENT" ]; then
      printf '%s' "$INTENT" >"${TMP_DIR}/intent.txt"
    else
      die 'check needs the stated intent: pass --intent "..." or --intent-file PATH'
    fi

    if [ -n "$DIFF_FILE" ]; then
      [ -f "$DIFF_FILE" ] || die "diff file not found: ${DIFF_FILE}"
      cp "$DIFF_FILE" "${TMP_DIR}/diff.txt"
    else
      ( cd "$REPO_ROOT" && bash -c "$DIFF_CMD" ) >"${TMP_DIR}/diff.txt" 2>"${TMP_DIR}/diff-err.txt" \
        || die "DIFF_CMD failed: ${DIFF_CMD}"
    fi
    [ -s "${TMP_DIR}/diff.txt" ] || die "the diff is empty, nothing to judge. Pass --diff-file or check DIFF_CMD."

    say ""
    say "Tier 2: model-based grader (${JUDGE_CMD})"
    if judge_json="$(judge_one "${TMP_DIR}/intent.txt" "${TMP_DIR}/diff.txt")"; then
      verdict="$(jq -r '.verdict // "fail"' <<<"$judge_json" | tr '[:upper:]' '[:lower:]')"
      if [ "$verdict" = "pass" ]; then
        ok "judge      pass"
      else
        bad "judge      ${verdict}"
        result="fail"
        [ "$code" -eq 0 ] && code=2
      fi
      say "           $(jq -r '.summary // ""' <<<"$judge_json")"
      jq -r '(.violations // [])[] | "           - " + .' <<<"$judge_json"
    else
      bad "judge      error (no valid JSON verdict from JUDGE_CMD, see ${REPORT_DIR}/logs/judge-raw.log)"
      judge_json='{"verdict":"error","summary":"judge command failed or returned unparseable output"}'
      result="fail"
      [ "$code" -eq 0 ] && code=2
    fi
  fi

  write_report "check" "$GATES_JSON" "$judge_json" "null" "$result"
  if [ "$code" -eq 0 ]; then ok "RESULT     pass"; else bad "RESULT     fail"; fi
  exit "$code"
}

cmd_eval() {
  [ -n "$JUDGE_CMD" ] || die "eval needs JUDGE_CMD set in the config."
  local cases_file="${SCRIPT_DIR}/cases/cases.jsonl"
  [ -f "$cases_file" ] || die "no cases file at ${cases_file}."

  say "Eval: scoring the judge against recorded cases (${JUDGE_CMD})"
  local results="[]" total=0 correct=0
  local line id intent expected diff_ref judged verdict okflag

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [ -z "$line" ] && continue
    case "$line" in "#"*) continue ;; esac

    id="$(jq -r '.id // empty' <<<"$line" 2>/dev/null)" || die "invalid JSON line in cases.jsonl: ${line}"
    intent="$(jq -r '.intent // empty' <<<"$line")"
    expected="$(jq -r '.expected_verdict // empty' <<<"$line" | tr '[:upper:]' '[:lower:]')"
    { [ -n "$id" ] && [ -n "$intent" ] && [ -n "$expected" ]; } \
      || die "case is missing id, intent, or expected_verdict: ${line}"

    printf '%s' "$intent" >"${TMP_DIR}/intent.txt"
    diff_ref="$(jq -r '.diff_file // empty' <<<"$line")"
    if [ -n "$diff_ref" ]; then
      [ -f "${SCRIPT_DIR}/${diff_ref}" ] || die "case ${id}: diff_file not found: ${diff_ref}"
      cp "${SCRIPT_DIR}/${diff_ref}" "${TMP_DIR}/diff.txt"
    else
      jq -r '.diff // empty' <<<"$line" >"${TMP_DIR}/diff.txt"
      [ -s "${TMP_DIR}/diff.txt" ] || die "case ${id}: needs a diff or diff_file field"
    fi

    total=$((total + 1))
    if judged="$(judge_one "${TMP_DIR}/intent.txt" "${TMP_DIR}/diff.txt")"; then
      verdict="$(jq -r '.verdict // "error"' <<<"$judged" | tr '[:upper:]' '[:lower:]')"
    else
      verdict="error"
      judged='{"verdict":"error","summary":"judge command failed or returned unparseable output"}'
    fi

    if [ "$verdict" = "$expected" ]; then
      okflag=true
      correct=$((correct + 1))
      ok "case ${id}   expected ${expected}, judged ${verdict}   ok"
    else
      okflag=false
      bad "case ${id}   expected ${expected}, judged ${verdict}   MISS"
    fi

    results="$(jq --arg id "$id" --arg expected "$expected" --arg judged "$verdict" \
                  --argjson corr "$okflag" --argjson detail "$judged" \
                  '. + [{id: $id, expected: $expected, judged: $judged, correct: $corr, detail: $detail}]' <<<"$results")"
  done <"$cases_file"

  [ "$total" -gt 0 ] || die "cases.jsonl has no cases yet. Record real agent failures first (see cases/SCHEMA.md)."

  local pct=$((correct * 100 / total)) result code=0
  if [ "$pct" -ge "$EVAL_THRESHOLD" ]; then result="pass"; else result="fail"; code=2; fi

  local eval_json
  eval_json="$(jq -n --argjson total "$total" --argjson correct "$correct" \
                     --argjson percent "$pct" --argjson threshold "$EVAL_THRESHOLD" \
                     --argjson cases "$results" \
                     '{total: $total, correct: $correct, percent: $percent, threshold: $threshold, cases: $cases}')"

  write_report "eval" "[]" "null" "$eval_json" "$result"
  if [ "$code" -eq 0 ]; then
    ok "RESULT     pass (${correct}/${total} correct, ${pct}% >= ${EVAL_THRESHOLD}%)"
  else
    bad "RESULT     fail (${correct}/${total} correct, ${pct}% < ${EVAL_THRESHOLD}%)"
  fi
  exit "$code"
}

case "$MODE" in
  gates) cmd_gates ;;
  check) cmd_check ;;
  eval)  cmd_eval ;;
esac
