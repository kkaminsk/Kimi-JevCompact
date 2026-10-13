# Kimi Code compaction seams (research notes)

Source: MoonshotAI/kimi-code at commit `b510fa9` (2026-10-13), app `@moonshot-ai/kimi-code` 2.1.1.
Read on 2026-10-13 while designing Kimi-JevCompact. Paths are relative to the kimi-code repo.

## What exists today

- **Shell hooks** (`docs/en/customization/hooks.md`): `[[hooks]]` in `config.toml` or a plugin
  manifest, with `event`, `matcher`, `command`, `timeout` (1–600 s, default 30). Payload is JSON on
  stdin with snake_case fields. Exit 0 allows, exit 2 blocks, anything else is fail-open. Only
  `PreToolUse`, `Stop`, `UserPromptSubmit` honour return values. `PreCompact` (matcher `manual` |
  `auto`) has "return values completely ignored"; `PostCompact` is observation-only.
- **Hook stdout parsing** (`features/externalHooks/internal/runHook.ts`): on exit 0 the stdout is
  parsed as JSON `{ message?, hookSpecificOutput?: { permissionDecision?, permissionDecisionReason? } }`.
- **PreCompact dispatch** (`features/externalHooks/agent/agentExternalHooksService.ts`):
  registered on `fullCompaction.hooks.onWillCompact` (an in-process `OrderedHookSlot`). Payload
  today: session facts + `trigger`, `tokenCount`. `PostCompact` payload: `trigger`,
  `estimatedTokenCount`.
- **Plugin hooks** (`docs/en/customization/plugins.md`): same fields; run with cwd = plugin root;
  env gets `KIMI_CODE_HOME` and `KIMI_PLUGIN_ROOT`. Plugins are copied to
  `$KIMI_CODE_HOME/plugins/managed/<id>/`; nothing is built or installed at install time.
  Manifest runtime fields (`tools`, `inject`, `apps`, `configFile`) are ignored.
- **Compaction** (`agent/fullCompaction/fullCompactionService.ts`): `run()` awaits
  `hooks.onWillCompact`, then sends `[...history, userMessage(instruction)]` to the model
  (`requestKind: 'full_compaction'`), collects the reply as `summary`, and calls
  `context.applyCompaction({ summary, contextSummary, compactedCount: history.length, ... })`.
  Shape (`contextMemory/compactionHandoff.ts`): kept user messages (head/tail, 20k-token cap)
  + one `compaction_summary` user message + a continuation message. Trigger thresholds in
  `fullCompaction/strategy.ts`: `triggerRatio` 0.85, `reservedContextSize` 50k, with
  `shouldCompact` / `shouldBlock`.
- **Durable records** (`contextMemory/contextEvents.ts`): `context.append_message`,
  `context.append_loop_event`, `context.clear`, `context.apply_compaction`, `context.undo`,
  `context.spliced`. Replayed by `agent/replayBuilder/fold.ts`, `human/persist/v2/{fold,wire}.ts`,
  `packages/node-sdk/src/v2/resume-replay.ts`, `packages/transcript/src/history/foldFacts.ts`,
  `apps/vis/server/src/lib/{agent-record-types,context-projector}.ts`, and
  `wire/tree/fork.ts` (fork/undo boundaries; `compaction_summary` origin is a boundary).
- **Message model** (`human/llm/message.ts`, `contextMemory/types.ts`): `role` is
  `system | user | assistant | tool`; `content: ContentPart[]` (text | think | image | audio |
  video); assistant `toolCalls: ToolCall[]` with `{ id, name, arguments: string | null }`;
  tool messages carry `toolCallId`. `ContextMessage` adds `origin` (user, injection,
  compaction_summary, skill_activation, hook_result, …), `isError`, `note`.
- **Build**: `apps/kimi-code` scripts `build`, `build:native:sea --profile=local`
  (single executable), `dev:cli-only`. Node ≥ 24.15, pnpm 10.33. Installed binary is an ELF at
  `~/.kimi-code/bin/kimi`; `kimi upgrade` replaces it.
- **Contribution policy** (`CONTRIBUTING.md`): external PRs only for approved bug fixes;
  features are decided in issues and implemented by the team.

## Why not the alternatives

- **Hooks as they are**: PreCompact cannot return anything that Kimi honours.
- **Plugins alone**: no in-process code; no way to touch history.
- **LLM proxy on `base_url`**: could answer the compaction request with a verbatim transcript as
  the "summary", but the result is text, not structured tool calls, and the detection relies on
  the instruction template. Rejected by the maintainer on 2026-10-13 in favour of a fork.
- **SDK harness**: only serves programmatic users, not the TUI.

## Library facts

`fast-jev-compaction` 0.4.1 on npm. `Message` = `{ role: 'user'|'assistant', text, toolUses:
[{ tool_use_id, tool, input }], toolResults?: [{ tool_use_id, text, isError? }] }`. Entry points:
`compact(messages, asker, options)`, `compactMessages`, `reductionRatio`, `JevAsker` for custom
transport, `buildJevRequest` / `parseJevResponse`. Decisions per call: keep | drop_result |
drop_call. First message and the newest `preserveRecentMessages` are pinned.
