# Proposal

## Why

Kimi Code persists every context change as a durable wire record and rebuilds the context from those records on resume, fork, undo, and in the session visualiser. A prune that only edited in-memory state would vanish on resume or, worse, replay inconsistently. The prune needs its own record and every replayer needs to understand it.

## What Changes

This is fork patch 2 of 3 against `MoonshotAI/kimi-code` at `b510fa9`.

- Add a durable record type `context.apply_prune` with payload: `dropCalls`, `truncateResults` (`{ toolCallId, headChars }`), `source` (`manual` | `auto`), `tokensBefore`, `tokensAfter`, `removedMessages`, optional `note`, plus the usual `agentId`.
- Add `applyPrune(input)` to the context memory service: removes each dropped tool call from its assistant message and the matching tool message, removes assistant messages left with no text and no calls, truncates listed tool results to `headChars` plus a one-line note, and recounts tokens. The algorithm is a pure function so replay reproduces it byte for byte.
- Teach every replayer the new record: engine fold, persistence v2 fold and wire manifest, node SDK resume replay, transcript fold facts, and the vis server record types and context projector.
- Define undo and fork semantics: a prune is not a boundary. `/undo` and `kimi fork` behave as if the pruned calls had never been made.

Files: `packages/agent-core-v2/src/agent/contextMemory/{contextEvents,contextOps,contextMemory,contextMemoryService}.ts`, `agent/replayBuilder/fold.ts`, `human/persist/v2/{fold,wire}.ts`, `docs/wire-manifest.d.ts`, `wire/tree/fork.ts` (tests only), `packages/node-sdk/src/v2/resume-replay.ts`, `packages/transcript/src/history/foldFacts.ts`, `apps/vis/server/src/lib/{agent-record-types,context-projector}.ts`.

## Capabilities

### New Capabilities
- `prune-record-persistence`: A prune is stored as a durable record, applied deterministically, and reproduced identically by every component that replays a session.

### Modified Capabilities
<!-- None in this repository. -->

## Impact

- **Data format:** one new record type in `wire.jsonl`. Older Kimi builds reading a pruned session would hit an unknown record; the fold already treats unknown `context.*` types as decode errors, so this is a documented incompatibility of pruned sessions with stock builds.
- **Compatibility within the fork:** sessions without prune records are unaffected.
- **Downstream:** change 4 emits the record; the plugin never sees it.
