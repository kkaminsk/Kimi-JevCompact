#!/usr/bin/env bash
# Clone the pinned upstream kimi-code, apply every patch in fork/patches in
# order, and (unless --check) install dependencies and run the upstream
# agent-core-v2 test suite.
#
# Usage: fork/apply.sh [--check]
#   --check   stop after applying the patches (for CI drift detection; no
#             pnpm install, no tests)
#
# Exits non-zero naming the failing patch when a patch does not apply.
set -euo pipefail

FORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$FORK_DIR/.." && pwd)"
LOCK="$FORK_DIR/upstream.lock"
BUILD_DIR="$FORK_DIR/build"
UPSTREAM_DIR="$BUILD_DIR/kimi-code"

sha="$(grep -E '^sha:' "$LOCK" | awk '{print $2}')"
if [[ -z "$sha" ]]; then
  echo "apply.sh: no sha found in $LOCK" >&2
  exit 1
fi

mode="${1:-apply}"
if [[ "$mode" != "apply" && "$mode" != "--check" ]]; then
  echo "apply.sh: unknown argument '$mode' (expected --check)" >&2
  exit 2
fi

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "apply.sh: cloning MoonshotAI/kimi-code at $sha"
git clone --quiet https://github.com/MoonshotAI/kimi-code "$UPSTREAM_DIR"
git -C "$UPSTREAM_DIR" checkout --quiet -b jev-compaction "$sha"

for patch in "$FORK_DIR"/patches/*.patch; do
  name="$(basename "$patch")"
  echo "apply.sh: applying $name"
  if ! git -C "$UPSTREAM_DIR" am --3way "$patch" >"$BUILD_DIR/apply.log" 2>&1; then
    echo "apply.sh: FAILED applying $name" >&2
    tail -n 20 "$BUILD_DIR/apply.log" >&2 || true
    exit 1
  fi
done

echo "apply.sh: applied $(ls "$FORK_DIR"/patches/*.patch | wc -l | tr -d ' ') patch(es) on $sha"

if [[ "$mode" == "--check" ]]; then
  echo "apply.sh: --check mode, skipping install and tests"
  exit 0
fi

echo "apply.sh: installing dependencies"
corepack pnpm --dir "$UPSTREAM_DIR" install --frozen-lockfile

echo "apply.sh: running agent-core-v2 tests"
corepack pnpm --dir "$UPSTREAM_DIR" --filter @moonshot-ai/agent-core-v2 test

echo "apply.sh: ok"
