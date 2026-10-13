# Tasks

## 1. Result type and events

- [ ] 1.1 Extend `CompactionResult` in `fullCompaction/types.ts` with `mode`, `droppedCalls`, `truncatedResults`, `pruneNote?`; update `fullCompactionCompleteSchema` in `compactionOps.ts`; verify typecheck passes and the schema test accepts the three modes.

## 2. Orchestration

- [ ] 2.1 Add `runPruneStep` to `AgentFullCompactionService`: abort check, `context.applyPrune`, recount via token counting, return counts or `undefined` after logging an error; verify unit tests for success, apply error, and abort.
- [ ] 2.2 In `run`, after `onWillCompact`: if `active.pruneDecision` is set call `runPruneStep`; if `!strategy.shouldBlock(tokensAfter)` build a prune-mode result and return; else continue the summary loop over the pruned history and mark `prune_then_summary`; verify three service tests: prune enough (zero LLM requests), prune not enough (one summary request over the pruned history), no decision (unchanged behaviour).
- [ ] 2.3 Ensure the wire log orders `context.apply_prune` before any `context.apply_compaction` in the fall-through case; verify with a resume test that replays both records.

## 3. Reporting

- [ ] 3.1 Update the TUI compaction-finished notice in `apps/kimi-code/src` to branch on `mode` and show counts and `pruneNote`; verify a snapshot test for each mode.
- [ ] 3.2 Extend the `PostCompact` payload in `agentExternalHooksService.notifyPostCompact` with `mode`, `dropped_calls`, `truncated_results`; verify the hook payload test.
- [ ] 3.3 Add the same fields to `compaction_finished` telemetry in `app/telemetry/events.ts` as optional; verify the telemetry schema test.

## 4. Documentation and patch

- [ ] 4.1 Update `docs/en/reference/slash-commands.md` (`/compact`) and `docs/en/customization/hooks.md` (`PostCompact` payload) plus `zh` mirrors; verify the docs build renders.
- [ ] 4.2 Export as `fork/patches/0003-compaction-prune-orchestration.patch`; verify `git apply --check` succeeds after patches 0001 and 0002, and `pnpm --filter @moonshot-ai/agent-core-v2 test` passes with all three applied.
