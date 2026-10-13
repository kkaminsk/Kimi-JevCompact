# Spec Delta

## Purpose

Defines the data a `PreCompact` hook receives and the prune decision it may return, so an external program can tell Kimi Code which tool calls and tool results are no longer needed before a compaction.

## ADDED Requirements

### Requirement: PreCompact payload carries the history

When a `PreCompact` hook runs, the JSON on its stdin SHALL include, in addition to the existing fields (`hook_event_name`, `session_id`, `session_title`, `client_type`, `cwd`, `trigger`, `token_count`): `agent_id`, `max_context_tokens`, `instruction` (absent when none was given), and `messages`.

`messages` SHALL be an array, oldest first, with one entry per message in the agent's current context. Each entry SHALL have `index` (position in the context), `role` (`system`, `user`, `assistant`, or `tool`), `origin_kind` (the message origin when present, e.g. `user`, `injection`, `compaction_summary`), `text` (the concatenated text parts; thinking parts excluded), `tool_calls` (array of `{ id, name, arguments }` for assistant messages, `arguments` as the raw string), `tool_call_id` (for tool messages), `is_error` (boolean), and `chars` (length of `text`).

#### Scenario: Hook sees every tool exchange

- **WHEN** the context holds an assistant message with two tool calls followed by two tool messages
- **THEN** the payload has one assistant entry whose `tool_calls` lists both ids and two tool entries whose `tool_call_id` values match them, in order

#### Scenario: Existing hooks keep working

- **WHEN** a `PreCompact` hook written before this change reads only `trigger`
- **THEN** it still receives `trigger` with the same values (`manual` or `auto`) and runs unchanged

#### Scenario: Thinking is not exported

- **WHEN** an assistant message contains thinking parts and text parts
- **THEN** the entry's `text` contains only the text parts

### Requirement: Hook may return a prune decision

On exit code 0, if the hook's stdout is a JSON object whose `hookSpecificOutput.compactionDecision` equals `"prune"`, Kimi SHALL read `hookSpecificOutput.prune` with: `dropCalls` (array of tool call ids whose call and result are both removed), `truncateResults` (array of `{ toolCallId, headChars }`, the result is cut to its first `headChars` characters plus a one-line omission note), and optional `note` (string shown to the user). `compactionDecision: "proceed"`, a missing field, or any other stdout means no prune.

#### Scenario: Valid prune is accepted

- **WHEN** the hook prints a decision whose ids all exist in `messages` and exits 0
- **THEN** Kimi records the decision for this compaction and the compaction proceeds in prune mode (see `compaction-prune-orchestration`)

#### Scenario: No output means built-in compaction

- **WHEN** the hook exits 0 with empty stdout
- **THEN** Kimi runs its built-in compaction exactly as before this change

#### Scenario: Exit code 2 does not block compaction

- **WHEN** the hook exits 2
- **THEN** compaction still runs with the built-in behaviour (PreCompact remains non-blocking) and the stderr text is logged

### Requirement: Decisions are validated in Kimi

Kimi SHALL reject the whole decision, log a warning naming the reason, and proceed with built-in compaction when: an id in `dropCalls` or `truncateResults` does not exist in the context; an id refers to a tool call whose result has not yet arrived; `headChars` is negative or not an integer; the same id appears in both lists; or the object fails schema validation.

#### Scenario: Unknown id rejects the decision

- **WHEN** `dropCalls` contains an id not present in any assistant message
- **THEN** no prune is applied and the built-in summary compaction runs

#### Scenario: Open exchange is protected

- **WHEN** `dropCalls` names a tool call whose tool message is absent because the tool is still running
- **THEN** the decision is rejected

### Requirement: One decision per compaction

When several `PreCompact` hooks match, Kimi SHALL use the first valid prune decision in hook configuration order and ignore the rest.

#### Scenario: Two hooks answer

- **WHEN** two matching hooks both return valid prune decisions
- **THEN** only the earlier-configured hook's decision is applied and the other is logged as ignored

### Requirement: Payload size has a ceiling

Kimi SHALL cap each entry's `text` at 200 000 characters, appending `[… N chars omitted …]` when cut, so a pathological context cannot stall the hook process on stdin.

#### Scenario: Oversized result is cut in the payload only

- **WHEN** a tool result holds 500 000 characters
- **THEN** the payload entry's `text` is 200 000 characters plus the note, while the message in Kimi's context is untouched
