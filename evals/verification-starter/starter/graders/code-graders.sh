# code-graders.sh : tier 1, the deterministic gates.
#
# Sourced by verify.sh. Runs each configured gate command from the repo root,
# logs its output, and records pass/fail/skipped plus timing.
#
# Expects: REPO_ROOT, REPORT_DIR, and the GATE_* config variables.
# Provides: run_gates(), which sets GATES_JSON (a JSON array) and GATES_FAILED (a count).

run_gates() {
  GATES_JSON="[]"
  GATES_FAILED=0

  local name var cmd log status started ended secs
  for name in typecheck test lint build; do
    var="GATE_$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')"
    cmd="${!var:-}"

    if [ -z "$cmd" ]; then
      GATES_JSON="$(jq --arg n "$name" '. + [{name: $n, status: "skipped"}]' <<<"$GATES_JSON")"
      printf '\033[2mgate %-10s skipped (not configured)\033[0m\n' "$name"
      continue
    fi

    log="${REPORT_DIR}/logs/gate-${name}.log"
    started="$(date +%s)"
    if ( cd "$REPO_ROOT" && bash -c "$cmd" ) >"$log" 2>&1 </dev/null; then
      status="pass"
    else
      status="fail"
      GATES_FAILED=$((GATES_FAILED + 1))
    fi
    ended="$(date +%s)"
    secs=$((ended - started))

    if [ "$status" = "pass" ]; then
      printf 'gate %-10s \033[32mpass\033[0m  (%ss)  %s\n' "$name" "$secs" "$cmd"
    else
      printf 'gate %-10s \033[31mfail\033[0m  (%ss)  %s\n' "$name" "$secs" "$cmd"
      printf '     %-10s see %s\n' "" "$log"
    fi

    GATES_JSON="$(jq --arg n "$name" --arg s "$status" --arg secs "$secs" --arg c "$cmd" --arg l "$log" \
      '. + [{name: $n, status: $s, seconds: ($secs | tonumber), command: $c, log: $l}]' <<<"$GATES_JSON")"
  done
}
