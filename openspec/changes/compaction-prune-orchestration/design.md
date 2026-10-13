# Design

## Context

See proposal.md. `AgentFullCompactionService.run` is one long method: validate start, `onWillCompact`, build instruction, loop over model attempts with overflow shrinking, then `context.applyCompaction`. The decision point we need sits right after `onWillCompact`. `strategy.shouldBlock(usedSize)` already encodes "the next turn cannot start", which is the right test for "was the prune enough". `CompactionResult` is consumed by the TUI notice, `PostCompact`, and telemetry.

## Goals / Non-Goals

**Goals:**
- Insert the prune step with minimal reshaping of `run`; keep the summary loop untouched.
- Use existing thresholds; add no new config keys.
- Report mode everywhere a result is already reported.

**Non-Goals:**
- Tuning thresholds for prune-first behaviour (left to real usage).
- Pruning outside compaction (e.g. per turn).

## Decisions

### Decision 1 — Prune, then re-check `shouldBlock`
After `applyPrune`, recount with the token counting service and call `strategy.shouldBlock(tokensAfter)`. Only `true` continues to the summary path.
- *Alternative: re-check `shouldCompact` (the trigger ratio).* Rejected: trigger and block ratios are usually equal, but when they differ, continuing to a summary just because we are above the trigger would summarise more often than necessary.
- *Alternative: compare against a fixed reduction ratio.* Rejected: the hook already enforces its own minimum reduction before answering; Kimi should judge by whether the next turn can run.

### Decision 2 — Summary path runs over the pruned history
When falling through, `originalHistory` for the summary loop is the pruned context. The summary then compacts a smaller prefix and `compactedCount` refers to the pruned list. The prune record precedes the compaction record in the wire log.
- *Alternative: summarise the original history and discard the prune.* Rejected: wastes the Jev work and makes the two records inconsistent.

### Decision 3 — `mode` on `CompactionResult`
`mode: 'summary' | 'prune' | 'prune_then_summary'`, `droppedCalls`, `truncatedResults`, `pruneNote?`. `summary` is `''` and `compactedCount` is `0` in pure prune mode. Consumers that read `summary` for display must handle the empty string (TUI notice branch).

### Decision 4 — Extract the prune step into `runPruneStep(active, decision)`
A private method returning `{ tokensAfter, droppedCalls, truncatedResults } | undefined` (undefined on error after logging). Keeps `run` readable and makes the error fallback a single branch.

### Decision 5 — Cancellation check before and after apply
`signal.throwIfAborted()` before calling `applyPrune`; the apply itself is synchronous, so a cancel cannot land in the middle of it.

## Risks / Trade-offs

- [Prune-then-summary doubles the work in edge cases] → rare (prune insufficient only near the block ratio); counted in telemetry so it can be tuned.
- [TUI notice assumes a summary string] → explicit `mode` branch with a test for the empty-summary case.
- [Telemetry schema change] → additive optional fields only.

## Migration Plan

Part of the fork patch series. No data migration. Rollback: revert; compaction returns to summary-only and existing prune records remain readable thanks to change 3.
