# Design

## Context

See proposal.md. `context.apply_compaction` is the model: a durable `AgentEvent2` class with a zod schema in `contextEvents.ts`, a pure `applyContextCompactionRecord(state, record)` in `contextOps.ts`, and case branches in `replayBuilder/fold.ts`, `human/persist/v2/fold.ts`, the SDK's `resume-replay.ts`, `transcript/.../foldFacts.ts`, and the vis projector. The prune record follows the same path. Undo (`computeUndoCut`) anchors on user prompts and `fork.ts` treats only `compaction_summary` as a boundary, so a prune that never introduces a summary message is transparent to both.

## Goals / Non-Goals

**Goals:**

- One pure function, `applyPruneRecord`, shared by the live path and every replayer.
- Zero behaviour change for sessions without prune records.

**Non-Goals:**

- Making stock Kimi builds tolerate pruned sessions. Documented as an incompatibility.
- Micro-compaction or any automatic heuristic trimming; the record only stores what a hook decided.

## Decisions

### Decision 1 — A new record type, not a variant of `context.apply_compaction`

`context.apply_compaction` means "replace a prefix with a summary"; nine consumers read `compactedCount` and `summary` from it. Overloading it would force every consumer to branch on a mode flag anyway.

- *Alternative: encode the prune as `context.spliced`.* Rejected: `spliced` describes trailing removal, not interior edits.

### Decision 2 — Store the decision, not the resulting messages

The record holds ids and `headChars`; replay recomputes the edit. This keeps records small and makes the live and replayed contexts provably the same function of the same inputs.

- *Alternative: store the full pruned message list.* Rejected: duplicates megabytes into the log and invites drift.

### Decision 3 — Pure `applyPruneRecord(state, record)` in `contextOps.ts`

Same shape as `applyContextCompactionRecord`. The service method `applyPrune` wraps it: computes token counts, publishes the event, appends to the wire.

### Decision 4 — Assistant messages emptied by a drop are removed

Mirrors the library's rule ("a message that loses all its content is removed"). An assistant message with text keeps its text.

- *Alternative: keep an empty assistant turn.* Rejected: some providers reject assistant messages with no content.

### Decision 5 — Not an undo/fork boundary

Undo cuts at user-prompt anchors and replays records in order, so a prune earlier in the log is simply folded before the cut. Fork copies records up to a line; a prune record copies like any other. A dedicated test for each confirms the no-op.

- *Alternative: treat prune as a boundary like compaction.* Rejected: would make `/undo` refuse across every auto-prune, which is far more frequent than a compaction.

### Decision 6 — Vis and SDK get the minimal handling

SDK resume replay applies the same function (imported from the engine package as `apply_compaction` is today). Vis shows one timeline item; no new UI beyond that.

## Risks / Trade-offs

- [Older or stock Kimi builds cannot open pruned sessions] → documented; `kimi-jev` is a separate binary so the managed `kimi` is never pointed at those sessions by accident unless the user resumes them explicitly.
- [Provider rejects a tool message whose call vanished] → the validator (change 2) and the apply function both enforce call-and-result removal together; a test asserts no orphan tool message after any prune.
- [Token estimates diverge between live and replay] → both call the same estimator over the same pruned messages.

## Migration Plan

Part of the fork patch series. Sessions created before the patch have no prune records and replay as before. Rollback: revert; existing pruned sessions become unreadable by the reverted build (acceptable during the fork's pre-release phase, called out in the fork README).
