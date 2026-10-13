# Spec Delta

## Purpose
Defines the behaviour of the hook executable that answers Kimi's `PreCompact` event with a Jev-guided prune decision: what it reads, what it sends to Jev, how it decides, and how it fails.

## ADDED Requirements

### Requirement: Faithful message mapping
The hook SHALL convert the `messages` payload into the library's transcript such that every assistant tool call is paired with the tool message bearing the same id, order is preserved, user and assistant text is carried verbatim, and system messages and messages without text or calls are kept as context but never become candidates.

#### Scenario: Pairing by id
- **WHEN** the payload has an assistant entry with calls `c1`, `c2` and tool entries `c2`, `c1` (results arrived out of order)
- **THEN** the library sees two calls each paired with its own result

#### Scenario: Result without a call is ignored
- **WHEN** a tool entry's `tool_call_id` matches no assistant call
- **THEN** the hook neither drops nor truncates it and logs the id

### Requirement: Decisions map back to Kimi ids
Each library decision SHALL be translated: `drop_call` to an entry in `dropCalls`; `drop_result` to an entry in `truncateResults` with `headChars` equal to the configured `truncateHeadChars`; `keep` and pinned calls to nothing.

#### Scenario: Mixed decisions
- **WHEN** Jev returns keepCall ≥ 0.5 but keepResult < 0.5 for `c7`, and both below 0.5 for `c9`
- **THEN** the output has `truncateResults: [{ toolCallId: "c7", headChars: 300 }]` and `dropCalls: ["c9"]`

### Requirement: Configuration precedence
The hook SHALL read settings from environment variables first (`TYPESAFE_API_KEY`, `KIMI_JEVCOMPACT_KEEP_THRESHOLD`, `KIMI_JEVCOMPACT_PRESERVE_RECENT`, `KIMI_JEVCOMPACT_MIN_REDUCTION`, `KIMI_JEVCOMPACT_MODEL`, `KIMI_JEVCOMPACT_BASE_URL`), then from `$KIMI_CODE_HOME/kimi-jevcompact.json` (keys `apiKey`, `keepThreshold`, `preserveRecentMessages`, `minReductionRatio`, `maxStateTokens`, `maxRequestTokens`, `truncateHeadChars`, `model`, `baseUrl`), then defaults.

#### Scenario: Env overrides file
- **WHEN** the file sets `keepThreshold: 0.7` and the environment sets `KIMI_JEVCOMPACT_KEEP_THRESHOLD=0.4`
- **THEN** the hook uses 0.4

#### Scenario: Missing file is fine
- **WHEN** no config file exists but `TYPESAFE_API_KEY` is set
- **THEN** the hook runs with defaults

### Requirement: Fail open with an explanation
Whenever the hook cannot or should not prune, it SHALL print a JSON object with `hookSpecificOutput.compactionDecision: "proceed"` and a `message` naming the reason, and exit 0. Reasons include: no API key, Jev request failure or malformed answer, history does not fit the state budget, estimated reduction below `minReductionRatio`, payload lacks `messages` (unpatched Kimi), or any unexpected error.

#### Scenario: No key
- **WHEN** neither the environment nor the file provides a key
- **THEN** stdout is a proceed decision with message `kimi-jevcompact: no TypeSafe API key (set TYPESAFE_API_KEY or apiKey in kimi-jevcompact.json)` and the exit code is 0

#### Scenario: Reduction too small
- **WHEN** the library's estimated reduction is 10 % and `minReductionRatio` is 0.25
- **THEN** the decision is proceed and the message states the measured and required ratios

#### Scenario: Unpatched Kimi
- **WHEN** the payload has no `messages` field
- **THEN** the hook proceeds with a message saying the Kimi build lacks the prune contract, and never contacts Jev

### Requirement: Successful prune output
On success the hook SHALL print `hookSpecificOutput.compactionDecision: "prune"`, the `prune` object, and a `note` of the form `kept K/M messages, no summary (R% reduction; a kept, b results truncated, c calls dropped; state ~S tokens in n request(s))`.

#### Scenario: Note content
- **WHEN** a prune keeps 41 of 58 messages with 44 % reduction
- **THEN** `note` begins with `kept 41/58 messages, no summary (44% reduction`

### Requirement: Local diagnostics
Each run SHALL append one JSON line to `$KIMI_CODE_HOME/logs/kimi-jevcompact.jsonl` containing timestamp, session id, trigger, outcome (`prune` or `proceed` with reason), the library stats, and the per-call decisions with both probabilities. Logging failures SHALL never change the decision.

#### Scenario: Log line after prune
- **WHEN** a prune succeeds
- **THEN** the last log line has `outcome: "prune"` and one decision entry per non-pinned call

### Requirement: Time bound
The hook SHALL finish within the plugin's declared timeout under normal conditions by running Jev requests concurrently, and SHALL abort outstanding requests and proceed if its own internal deadline (timeout minus 5 seconds) passes.

#### Scenario: Slow Jev
- **WHEN** Jev takes longer than the internal deadline
- **THEN** the hook prints a proceed decision mentioning the timeout before Kimi's timeout fires
