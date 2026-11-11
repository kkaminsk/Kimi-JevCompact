#!/usr/bin/env bash
# Build kimi-jev from the applied upstream clone and install it beside the
# stock kimi binary. Never touches the managed `kimi` executable and never
# runs as root; prints a PATH hint instead of modifying the shell.
#
# Prerequisite: fork/apply.sh has populated fork/build/kimi-code.
#
# Usage: fork/build.sh
set -euo pipefail

FORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK="$FORK_DIR/upstream.lock"
UPSTREAM_DIR="$FORK_DIR/build/kimi-code"

version="$(grep -E '^version:' "$LOCK" | awk '{print $2}')"
series="$(grep -E '^series:' "$LOCK" | awk '{print $2}')"
if [[ -z "$version" || -z "$series" ]]; then
  echo "build.sh: version and series are required in $LOCK" >&2
  exit 1
fi

if [[ ! -d "$UPSTREAM_DIR/apps/kimi-code" ]]; then
  echo "build.sh: $UPSTREAM_DIR is missing; run fork/apply.sh first" >&2
  exit 1
fi

KIMI_CODE_HOME="${KIMI_CODE_HOME:-$HOME/.kimi-code}"
export KIMI_CODE_JEV_SUFFIX="+jev.${series}"

# corepack resolves the packageManager field from the caller's working
# directory, not from -C, so pass the upstream clone's pinned pnpm
# explicitly (e.g. pnpm@10.33.0) instead of whatever pnpm is on PATH.
pm_pin="$(node -p "require(process.argv[1]).packageManager" "$UPSTREAM_DIR/package.json" 2>/dev/null || true)"
pnpm_cmd=(corepack pnpm)
if [[ "$pm_pin" == pnpm@* ]]; then
  pnpm_cmd=(corepack "$pm_pin")
fi

echo "build.sh: building kimi-jev ${version}${KIMI_CODE_JEV_SUFFIX}"
"${pnpm_cmd[@]}" -C "$UPSTREAM_DIR/apps/kimi-code" build:native:sea --profile=local

triple="$(node -e "console.log(process.platform + '-' + process.arch)")"
binary="$UPSTREAM_DIR/apps/kimi-code/dist-native/bin/${triple}/kimi"
if [[ "$(uname -s)" == "MINGW"* || "$(uname -s)" == "Windows"* ]]; then
  binary="$UPSTREAM_DIR/apps/kimi-code/dist-native/bin/${triple}/kimi.exe"
fi
if [[ ! -f "$binary" ]]; then
  echo "build.sh: expected build output at $binary" >&2
  exit 1
fi

mkdir -p "$KIMI_CODE_HOME/bin"
cp "$binary" "$KIMI_CODE_HOME/bin/kimi-jev"
if [[ -f "$binary.exe" && ! -f "$KIMI_CODE_HOME/bin/kimi-jev.exe" ]]; then
  cp "$binary.exe" "$KIMI_CODE_HOME/bin/kimi-jev.exe"
fi
chmod +x "$KIMI_CODE_HOME/bin/kimi-jev" 2>/dev/null || true

echo "build.sh: installed $("$KIMI_CODE_HOME/bin/kimi-jev" --version 2>/dev/null || echo 'kimi-jev (version check failed)') to $KIMI_CODE_HOME/bin/kimi-jev"
echo "build.sh: the stock kimi binary was not modified"
echo "build.sh: add it to your PATH with: export PATH=\"$KIMI_CODE_HOME/bin:\$PATH\""
