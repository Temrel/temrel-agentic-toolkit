#!/usr/bin/env bash
# Git pre-push hook: refuse to push while a tier 1 gate is failing.
#
# Install (from your repo root):
#   cp verification/triggers/pre-push.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# STARTER_DIR assumes the starter lives at <repo root>/verification. Adjust it
# if you copied the starter somewhere else.

set -u

STARTER_DIR="$(git rev-parse --show-toplevel)/verification"

if [ ! -x "${STARTER_DIR}/verify.sh" ]; then
  echo "pre-push: ${STARTER_DIR}/verify.sh not found or not executable, skipping verification." >&2
  exit 0
fi

exec "${STARTER_DIR}/verify.sh" gates
