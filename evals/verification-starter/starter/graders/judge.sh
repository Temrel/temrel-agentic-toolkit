# judge.sh : tier 2, the model-based grader (LLM as judge).
#
# Sourced by verify.sh. Builds a prompt from judge/rubric.md plus the stated
# intent and the diff, pipes it into JUDGE_CMD, and extracts a JSON verdict.
#
# JUDGE_CMD is any command that reads a prompt on stdin and prints the model's
# reply on stdout: "claude -p", "llm -m <model>", "ollama run <model>", or your
# own wrapper script. No SDK, no lock-in.
#
# Expects: SCRIPT_DIR, TMP_DIR, REPORT_DIR, JUDGE_CMD.
# Provides: judge_one(intent_file, diff_file), which prints a JSON verdict
# object on success and returns 1 on failure. The raw model output is always
# kept at report/logs/judge-raw.log for debugging.

build_prompt() { # $1 intent file, $2 diff file
  cat "${SCRIPT_DIR}/judge/rubric.md"
  printf '\n\n## Stated intent\n\n'
  cat "$1"
  printf '\n\n## Diff\n\n```diff\n'
  cat "$2"
  printf '\n```\n'
}

# Pull a JSON object out of the model's reply, tolerating markdown fences and
# prose around it: try the whole reply first, then the span from the first "{"
# to the last "}".
extract_json() { # $1 raw output file
  local raw candidate
  raw="$(cat "$1")"
  if printf '%s' "$raw" | jq -e 'type == "object"' >/dev/null 2>&1; then
    printf '%s' "$raw"
    return 0
  fi
  candidate="${raw#*\{}"
  candidate="{${candidate}"
  candidate="${candidate%\}*}}"
  if printf '%s' "$candidate" | jq -e 'type == "object"' >/dev/null 2>&1; then
    printf '%s' "$candidate"
    return 0
  fi
  return 1
}

judge_one() { # $1 intent file, $2 diff file
  local prompt_file="${TMP_DIR}/prompt.txt"
  local raw_file="${REPORT_DIR}/logs/judge-raw.log"
  local err_file="${REPORT_DIR}/logs/judge-err.log"

  build_prompt "$1" "$2" >"$prompt_file"

  if ! bash -c "$JUDGE_CMD" <"$prompt_file" >"$raw_file" 2>"$err_file"; then
    return 1
  fi
  extract_json "$raw_file"
}
