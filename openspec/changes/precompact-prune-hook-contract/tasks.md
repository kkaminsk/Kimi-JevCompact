# Tasks

## 1. Payload projection

- [ ] 1.1 Add `toHookMessages(history: readonly ContextMessage[]): HookMessage[]` in `features/externalHooks/internal/hookMessages.ts` producing the snake_case projection with the 200 000-char cap; verify with a vitest covering user/assistant/tool/system messages, thinking exclusion, and the cap note.
- [ ] 1.2 In `agentExternalHooksService.runPreCompact`, extend `inputData` with `agent_id`, `max_context_tokens`, `instruction`, and `messages`; verify an existing PreCompact hook test still passes and a new test asserts the added fields.

## 2. Decision parsing

- [ ] 2.1 Extend `HookSpecificOutputSchema` in `runHook.ts` with `compactionDecision` and `prune` (`dropCalls: string[]`, `truncateResults: { toolCallId: string; headChars: number }[]`, `note?: string`); verify a test parses a valid decision and rejects `headChars: -1`.
- [ ] 2.2 Expose the parsed decision on `HookResult` as `pruneDecision?: RawPruneDecision`; verify exit code 2 and non-JSON stdout yield `undefined`.

## 3. Validation and hand-off

- [ ] 3.1 Add `validatePruneDecision(raw, history)` returning either a `ValidatedPruneDecision` or a rejection reason (unknown id, open exchange, duplicate id, bad headChars); verify each reason with its own test.
- [ ] 3.2 Add `pruneDecision?: ValidatedPruneDecision` to `FullCompactionTask`; in `registerFullCompactionHooks`, pick the first valid decision from the trigger results, log rejections with reason, and set it before `next()`; verify with a test that two valid decisions yield the first and that a rejected one leaves the field unset.

## 4. Documentation

- [ ] 4.1 Update `docs/en/customization/hooks.md` (and `docs/zh/` mirror) for `PreCompact`: new payload fields, decision shape, validation rules, "first valid decision wins"; verify the docs build (`pnpm dev:docs`) renders the table.
- [ ] 4.2 Export the patch as `fork/patches/0001-precompact-prune-contract.patch` in this repository; verify `git apply --check` succeeds on a clean clone at `b510fa9`.
