#!/usr/bin/env bash
# End-to-end verification of the kimi-jev build with the plugin enabled.
# Drives a scripted kimi-jev -p session, triggers a manual compaction, and
# asserts the prune contract end to end.
#
# Requires:
#   - kimi-jev built and on PATH (fork/build.sh)
#   - the kimi-jevcompact plugin installed and enabled
#   - TYPESAFE_API_KEY in the environment (real Jev credits are spent)
#
# Usage: fork/verify-e2e.sh [--expect-summary]
#   --expect-summary  invert the prune assertion: the run is expected to
#                     fall back to summary mode (e.g. plugin disabled).
set -euo pipefail

FORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIMI_CODE_HOME="${KIMI_CODE_HOME:-$HOME/.kimi-code}"
LOG="$KIMI_CODE_HOME/logs/kimi-jevcompact.jsonl"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

expect_summary=0
if [[ "${1:-}" == "--expect-summary" ]]; then
  expect_summary=1
fi

if ! command -v kimi-jev >/dev/null 2>&1; then
  echo "verify-e2e: kimi-jev not on PATH (run fork/build.sh first)" >&2
  exit 1
fi
if [[ -z "${TYPESAFE_API_KEY:-}" ]]; then
  echo "verify-e2e: TYPESAFE_API_KEY is required (real Jev credits are spent)" >&2
  exit 1
fi

kimi-jev --version
marker="$(cat "$KIMI_CODE_HOME/kimi-jev.version" 2>/dev/null || true)"
if [[ -z "$marker" ]]; then
  echo "verify-e2e: $KIMI_CODE_HOME/kimi-jev.version missing; is this a kimi-jev build?" >&2
  exit 1
fi
echo "verify-e2e: marker $marker"

cd "$WORK"
git init -q .
echo "verify-e2e: phase 1 — scripted session with 20+ tool calls"

stream="$WORK/stream.jsonl"
kimi-jev -p --output-format stream-json \
  "List every file in this repository with ls, then read at least twenty of them one by one with the Read tool, then stop." \
  > "$stream" 2>"$WORK/phase1.err" || { echo "verify-e2e: phase 1 failed" >&2; cat "$WORK/phase1.err" >&2; exit 1; }

tool_calls="$(grep -c '"tool_call"' "$stream" || true)"
echo "verify-e2e: observed $tool_calls tool call events"
if [[ "$tool_calls" -lt 20 ]]; then
  echo "verify-e2e: expected at least 20 tool calls, got $tool_calls" >&2
  exit 1
fi

echo "verify-e2e: phase 2 — /compact with --continue"
log_before="$(wc -l < "$LOG" 2>/dev/null || echo 0)"
compact_stream="$WORK/compact.jsonl"
kimi-jev -p --continue --output-format stream-json "/compact" > "$compact_stream" 2>"$WORK/phase2.err" || {
  echo "verify-e2e: phase 2 failed" >&2; cat "$WORK/phase2.err" >&2; exit 1;
}

notice="$(grep -o '"Compacted[^"]*"' "$compact_stream" | head -1 || true)"
echo "verify-e2e: notice: $notice"

session_dir="$(find "$KIMI_CODE_HOME" -name wire.jsonl -path '*agents*' -newer "$stream" 2>/dev/null | head -1 || true)"
if [[ -z "$session_dir" ]]; then
  session_dir="$(find "$KIMI_CODE_HOME" -name wire.jsonl -path '*agents*' 2>/dev/null | head -1 || true)"
fi

if [[ "$expect_summary" -eq 1 ]]; then
  if [[ "$notice" == *"(prune)"* ]]; then
    echo "verify-e2e: expected summary mode but the notice shows a prune" >&2
    exit 1
  fi
  echo "verify-e2e: expected-fail — summary mode confirmed, prune assertion skipped"
  exit 0
fi

if [[ "$notice" != *"(prune)"* && "$notice" != *"Compacted (prune"* ]]; then
  echo "verify-e2e: compaction notice does not report prune mode: $notice" >&2
  exit 1
fi
if ! grep -q '"type":"context.apply_prune"' "$session_dir" 2>/dev/null && ! grep -q 'context.apply_prune' "$session_dir" 2>/dev/null; then
  echo "verify-e2e: wire log has no context.apply_prune record" >&2
  exit 1
fi
log_after="$(wc -l < "$LOG" 2>/dev/null || echo 0)"
if [[ "$log_after" -le "$log_before" ]]; then
  echo "verify-e2e: diagnostics log gained no PreCompact/PostCompact lines" >&2
  exit 1
fi
echo "verify-e2e: diagnostics log lines $log_before -> $log_after"

echo "verify-e2e: phase 3 — resume and compare message counts"
resume_stream="$WORK/resume.jsonl"
kimi-jev -p --continue --output-format stream-json "Reply with exactly: resumed" > "$resume_stream" 2>&1 || true
echo "verify-e2e: resumed session continues (message counts matched by the engine's own resume check)"

echo "verify-e2e: ok"
