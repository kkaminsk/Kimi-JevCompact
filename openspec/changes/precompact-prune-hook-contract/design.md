# Design

## Context

See proposal.md. Today `agentExternalHooksService.ts` registers on `fullCompaction.hooks.onWillCompact`, calls `runner.trigger('PreCompact', { inputData: { trigger, tokenCount } })`, and discards the result. `runHook.ts` already parses stdout JSON into `HookResult` with `structuredOutput` and a zod `HookSpecificOutputSchema` that only knows `permissionDecision`. The compaction task object (`FullCompactionTask`) is what both the hook service and the compaction service hold during a run, so it is the natural place to carry the decision.

## Goals / Non-Goals

**Goals:**
- Reuse the existing hook runner, matcher, timeout, and fail-open semantics unchanged.
- Keep the decision narrow: remove calls, truncate results, nothing else.
- Make the contract stable enough to propose upstream verbatim.

**Non-Goals:**
- Applying the prune (change 3 and 4).
- A generic "rewrite history" hook. Deliberately excluded: the Jev guarantee is that text is never rewritten, and a narrower contract is easier to validate.

## Decisions

### Decision 1 — Export a hook-safe message projection, not `ContextMessage`
The payload uses a flat, snake_case projection (`index`, `role`, `origin_kind`, `text`, `tool_calls`, `tool_call_id`, `is_error`, `chars`). Media parts become nothing; thinking parts are excluded.
- *Alternative: dump `ContextMessage` as-is.* Rejected: it carries internal fields (`usage`, `toolCallDisplays`, blob references) that would become accidental API, and camelCase would break the documented snake_case convention for payloads.

### Decision 2 — Inline the history on stdin
Hooks already receive JSON on stdin and Kimi tool results are bounded (~50k chars each), so a full history is at most a few MB. A 200 000-character per-entry cap guards the tail.
- *Alternative: write the history to a temp file and pass `history_path`.* Rejected for now: adds cleanup and a second format. Can be added later behind a payload field without breaking the contract.

### Decision 3 — Decision keys are camelCase under `hookSpecificOutput`
Matches `permissionDecision` / `permissionDecisionReason`, which are the only structured outputs Kimi reads today.
- *Alternative: snake_case for symmetry with the payload.* Rejected: would make `hookSpecificOutput` mixed-case.

### Decision 4 — Validate in `agentExternalHooksService`, store on the task
Validation needs the live context (ids, open exchanges), which the hook service can read through `IAgentContextMemoryService`. The validated decision is attached to the `FullCompactionTask` as `pruneDecision?: ValidatedPruneDecision` before `next()` is called, so the compaction service sees it right after `onWillCompact` resolves.
- *Alternative: validate inside the compaction service.* Rejected: the hook service already owns the mapping between hook results and engine actions (see `runStop`).

### Decision 5 — Extend `HookSpecificOutputSchema` with optional fields
`compactionDecision: z.enum(['prune','proceed']).optional()` and `prune: pruneSchema.optional()`. Unknown keys stay allowed, as today.

### Decision 6 — First valid decision wins
Hooks run in parallel; the runner returns results in configuration order. Taking the first valid one is deterministic and cheap to explain.
- *Alternative: merge decisions (union of drops).* Rejected: two scorers disagreeing is a configuration error, not something to paper over.

## Risks / Trade-offs

- [Large stdin stalls a slow hook] → per-entry cap; the hook timeout (max 600 s) still bounds the run; fail-open on timeout.
- [Upstream may rename hook internals] → the patch is confined to two files plus a type; `fork/upstream.lock` pins the base.
- [A buggy hook drops a call the model still needs] → the model can re-run the tool; the Context Recovery footer already tells it the wire log keeps everything.

## Migration Plan

Part of the fork patch series; applied by `fork/apply.sh` (change 7). No data migration. Rollback: revert the patch; hooks fall back to observation-only.

## Open Questions

1. Should `instruction` (the `/compact` free text) be forwarded to the hook as a Jev `goal` hint? Defaults to forwarded; the hook decides what to do with it.
