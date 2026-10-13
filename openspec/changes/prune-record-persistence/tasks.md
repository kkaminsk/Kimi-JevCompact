# Tasks

## 1. Record type

- [ ] 1.1 Add `ContextApplyPrune` (`type: 'context.apply_prune'`, `durable: true`) with a zod payload schema in `contextEvents.ts` and register it in the durable record list; verify `pnpm --filter @moonshot-ai/agent-core-v2 typecheck` passes and the wire manifest test lists the new type.
- [ ] 1.2 Update `docs/wire-manifest.d.ts` with the payload; verify the manifest snapshot test is updated deliberately.

## 2. Apply function

- [ ] 2.1 Implement `applyPruneRecord(state, record)` in `contextOps.ts` (drop calls and their tool messages, remove emptied assistant messages, truncate with the fixed note); verify with vitest cases: drop one of two calls, drop the only call of a text-less assistant message, truncate, no-op on unknown id (throws), and an orphan-check that no `role: 'tool'` message remains without its call.
- [ ] 2.2 Add `applyPrune(input)` to `IAgentContextMemoryService` and implement it in `contextMemoryService.ts`: compute `tokensBefore`/`tokensAfter`, append the record, bump the prefix revision; verify a service test sees the record on the wire and the recount in `tokenCount`.

## 3. Replayers

- [ ] 3.1 Handle `context.apply_prune` in `agent/replayBuilder/fold.ts` and `human/persist/v2/{fold,wire}.ts`; verify a resume test replays a log with a prune to the same messages as the live service produced.
- [ ] 3.2 Handle it in `packages/node-sdk/src/v2/resume-replay.ts` (apply branch and carry-over list); verify the SDK resume test asserts equal message counts.
- [ ] 3.3 Handle it in `packages/transcript/src/history/foldFacts.ts`; verify the transcript fold test counts pruned calls as removed.
- [ ] 3.4 Add the record type to `apps/vis/server/src/lib/agent-record-types.ts` and render it in `context-projector.ts` and the web timeline; verify `kimi vis` opens a pruned session fixture without a decode error.

## 4. Undo and fork semantics

- [ ] 4.1 Add tests in `wire/tree/fork.test.ts` and the undo tests proving a prune is neither an undo nor a fork boundary; verify `/undo 2` across a prune and `computeForkLine` before a prune both succeed.

## 5. Patch export

- [ ] 5.1 Export as `fork/patches/0002-prune-record-persistence.patch`; verify `git apply --check` succeeds after patch 0001 on a clean clone at `b510fa9`.
