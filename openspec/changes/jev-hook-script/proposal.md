# Proposal

## Why

The fork gives `PreCompact` a way to return a prune decision; something has to produce one. The hook script is the bridge between Kimi's history and the `fast-jev-compaction` library: it maps messages, asks Jev, applies the library's thresholds, and answers in the contract's shape, failing open whenever anything goes wrong.

## What Changes

- Implement `plugin/src/hook.ts`, bundled to `plugin/dist/hook.mjs`, invoked by Kimi as `node ./dist/hook.mjs` with the `PreCompact` payload on stdin.
- Message mapping: Kimi's `messages` projection (system/user/assistant/tool, `tool_calls` with raw argument strings, tool messages with `tool_call_id`) to the library's `Message` shape (user/assistant with `toolUses` and `toolResults`), preserving order and pairing calls with results by id, and back: library decisions become `dropCalls` and `truncateResults` keyed by Kimi tool call ids.
- Configuration resolution in order: environment (`TYPESAFE_API_KEY`, `KIMI_JEVCOMPACT_*`), then `$KIMI_CODE_HOME/kimi-jevcompact.json`, then defaults identical to the Claude Code plugin (keepThreshold 0.5, preserveRecentMessages 6, minReductionRatio 0.25, maxStateTokens 25000, maxRequestTokens 30000, truncateHeadChars 300, model `jev-latest`).
- Guards: when no key is configured, the reduction is below `minReductionRatio`, Jev fails, or the history cannot fit the state budget, print `compactionDecision: "proceed"` with a `message` explaining why, and exit 0.
- Diagnostics: append one JSON line per run to `$KIMI_CODE_HOME/logs/kimi-jevcompact.jsonl` with stats and per-call decisions; print a one-line `note` for the TUI.
- Forward the `/compact` instruction, when present, as the library's `goal`.

## Capabilities

### New Capabilities
- `jev-prune-hook`: A `PreCompact` hook executable that turns Kimi's history into a Jev-scored prune decision, with fail-open behaviour and local diagnostics.

### Modified Capabilities
<!-- None. -->

## Impact

- **Code:** `plugin/src/{hook,mapping,config,log}.ts`, tests under `plugin/test/` with a fake Jev transport (no network in tests).
- **Dependencies:** `fast-jev-compaction` (bundled). No other runtime dependency.
- **Network:** only `https://api.typesafe.ai` (configurable `baseUrl`), only during a compaction.
- **Downstream:** change 6 packages this script and declares the hook.
