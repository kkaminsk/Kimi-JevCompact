# Proposal

## Why

Kimi Code's `PreCompact` shell hook fires before every compaction but its return value is ignored, so nothing outside the binary can influence what compaction keeps. Kimi-JevCompact needs exactly that influence, and the smallest change that provides it is to let `PreCompact` carry the history out and a prune decision back, reusing the hook mechanism plugins can already declare.

## What Changes

This is fork patch 1 of 3 against `MoonshotAI/kimi-code` at `b510fa9`.

- Extend the `PreCompact` stdin payload with the agent history in a hook-safe form (`messages`), plus `agent_id`, `max_context_tokens`, and the optional `/compact` `instruction`.
- Accept a structured stdout answer on exit 0: `hookSpecificOutput.compactionDecision` of `"prune"` with a `prune` object listing tool call ids to drop and tool results to truncate, or `"proceed"`. No answer means proceed.
- Validate the decision against the history: unknown ids, ids inside an open tool exchange, or a malformed object make Kimi ignore the decision and proceed (fail-open, logged).
- Carry the validated decision on the compaction task so the compaction service (change 4) can act on it. Only the first valid prune decision among parallel hooks is used.
- Update `docs/en/customization/hooks.md` in the fork: `PreCompact` row now says "supports prune decision".

Files: `packages/agent-core-v2/src/features/externalHooks/agent/agentExternalHooksService.ts`, `features/externalHooks/internal/runHook.ts`, `features/externalHooks/internal/types.ts`, `agent/fullCompaction/fullCompactionService.ts` (task type only), `packages/klient/src/contract/global/plugins.ts` (no change expected; the event name already exists), `docs/en/customization/hooks.md`.

## Capabilities

### New Capabilities
- `precompact-prune-contract`: The `PreCompact` hook payload exposes the history and the hook may return a validated prune decision that Kimi will honour.

### Modified Capabilities
<!-- None in this repository. -->

## Impact

- **Compatibility:** existing `PreCompact` hooks keep working; the payload only gains fields and the output is optional. Hooks that print non-JSON on stdout are unaffected (already the case).
- **Size:** the payload can be large (full history, tool results included). Hooks are already fed via stdin, so no new transport is needed.
- **Security:** the hook can only remove tool calls and truncate tool results; it cannot inject or rewrite text. Validation lives in Kimi, not the hook.
- **Downstream:** change 3 persists the decision; change 4 executes it. The plugin's hook (change 5) is the first consumer.
