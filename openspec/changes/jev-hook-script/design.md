# Design

## Context

See proposal.md. The library exports `compact(messages, asker, options)` with a `JevAsker` interface (`ask(state, questions)`), plus `buildJevRequest` and `parseJevResponse`, so the hook only needs a transport over Node's global `fetch`, a mapping layer, and a thin CLI shell. The Claude Code hook (`hooks/fast-jev.ts` in fast-jev-compaction) is the reference for config defaults, `summarize`, and `decisionLog`; those helpers are reimplemented here against the same stats shape rather than imported, since they live in the Claude Code plugin, not the npm package.

## Goals / Non-Goals

**Goals:**

- Zero-dependency bundle; no network except TypeSafe.
- Pure, unit-testable mapping and decision translation.
- Identical defaults and thresholds to the Claude Code plugin so behaviour is comparable.

**Non-Goals:**

- Triggering compaction (Kimi's own thresholds do that; see change 7 for recommended `config.toml` settings).
- Caching Jev answers across runs.

## Decisions

### Decision 1 — Map tool messages onto user-role messages with `toolResults`

The library models results as `toolResults` on user messages. Each Kimi tool message becomes a library user message with empty `text` and one `toolResults` entry. Consecutive tool messages stay separate so message indices round-trip one to one with Kimi's `index`.

- *Alternative: merge consecutive tool messages into one library message.* Rejected: breaks the one-to-one index mapping used for pinning and diagnostics.

### Decision 2 — Pinning counts Kimi messages

`preserveRecentMessages` is applied to the mapped list, which has the same length as Kimi's. Tool messages count as messages, matching how Claude Code's transcript counts tool-result user messages.

### Decision 3 — `goal` from `/compact` instruction, else last user prompts

If `instruction` is present it becomes `options.goal`; otherwise the library's default (last three user prompts) applies. Messages with `origin_kind` other than `user` are excluded from the prompt scan so injected reminders do not masquerade as goals.

### Decision 4 — Config file at `$KIMI_CODE_HOME/kimi-jevcompact.json`

Kimi exports `KIMI_CODE_HOME` to plugin hooks; the file sits next to `config.toml` where users already look. JSON rather than TOML keeps the bundle dependency-free.

- *Alternative: read `config.toml`.* Rejected: needs a TOML parser and Kimi rejects unknown keys in `[[hooks]]`.

### Decision 5 — Transport over global `fetch` with an `AbortController` deadline

Deadline = declared timeout (from `KIMI_JEVCOMPACT_TIMEOUT_S`, default 120) minus 5 s. On abort, proceed.

### Decision 6 — Always exit 0

Every path prints a decision and exits 0, because exit 2 and non-zero codes carry no useful meaning for `PreCompact` and could confuse log readers.

## Risks / Trade-offs

- [Argument strings may not be JSON] → mapping passes `arguments` through as `{ raw: string }` when `JSON.parse` fails, so Jev still sees the input.
- [Very large histories exceed the state budget] → the library's fitting stages handle it; if it still throws, proceed with the reason.
- [Node missing on PATH] → Kimi runs `node ./dist/hook.mjs`; the `doctor` command (change 6) checks for Node ≥ 20 and the README states the requirement.

## Migration Plan

New code. Rollback is removing the plugin.

## Open Questions

1. Whether the Claude Code plugin's `summarize`/`decisionLog` helpers should move into the npm package so both hooks share them. Deferrable; the hook reimplements them for now.
