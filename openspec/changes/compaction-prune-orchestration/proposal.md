# Proposal

## Why

With the contract (change 2) and the record (change 3) in place, the compaction service still always asks the model for a summary. This change makes it act on a prune decision: apply it, measure what it freed, and only fall back to the model-written summary when the prune was not enough. It also tells the user what happened.

## What Changes

This is fork patch 3 of 3 against `MoonshotAI/kimi-code` at `b510fa9`.

- In the compaction run, after the pre-compaction hooks resolve: if the task carries a validated prune decision, apply it through the context memory service, recount tokens, and decide: if the context is now below the block threshold, finish in prune mode without any model request; otherwise continue into the existing summary path over the pruned history.
- Extend the compaction result with `mode` (`summary`, `prune`, or `prune_then_summary`) and prune counts, and surface it: the TUI's compaction-finished notice shows the mode and counts; the `PostCompact` hook payload gains `mode`, `dropped_calls`, `truncated_results`; telemetry gets the same fields.
- Manual `/compact` and auto-compaction both take the prune path. The in-flight guards, cancellation, and overflow retry logic stay as they are.
- Update `docs/en/reference/slash-commands.md` (`/compact` row) and `docs/en/customization/hooks.md` (`PostCompact` payload).

Files: `packages/agent-core-v2/src/agent/fullCompaction/{fullCompactionService,types,compactionOps}.ts`, `features/externalHooks/agent/agentExternalHooksService.ts` (PostCompact payload), `app/telemetry/events.ts`, the TUI compaction notice in `apps/kimi-code/src`, docs.

## Capabilities

### New Capabilities
- `compaction-prune-orchestration`: Compaction honours a prune decision, falls back to summary only when needed, and reports which mode ran.

### Modified Capabilities
<!-- None in this repository. -->

## Impact

- **Behaviour:** sessions with the plugin installed compact without a model call most of the time; nothing changes when no hook returns a decision.
- **Cost:** a prune-mode compaction makes zero LLM requests in Kimi; the Jev requests happen in the hook process.
- **Downstream:** completes the fork patch series. The plugin's `PostCompact` notification (change 6) reads the new payload fields.
