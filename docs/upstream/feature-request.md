# Feature request: let `PreCompact` hooks prune tool calls

**For:** MoonshotAI/kimi-code — proposing a small, backwards-compatible
extension to the shell hook mechanism. Written so it can be pasted into an
issue as-is, per the project's "discuss before code" policy.

## Motivation

Today `/compact` always asks the model to write a summary of the
conversation so far. Summaries are lossy: tool outputs the model still needs
get paraphrased away, and long verbatim results (file reads, command output)
are exactly what pushes contexts over their window.

External scoring services — TypeSafe's Jev model is one — can score, per
tool call, the probability that the call and its result still matter, in one
fast request and without rewriting any user or assistant text. But Kimi's
`PreCompact` hook currently cannot influence compaction: its return value is
ignored, so nothing outside the binary can act on such a score.

## Proposal

Let `PreCompact` carry the history out and a **prune decision** back, in
three additive pieces. Existing hooks are unaffected: every new field is
optional, malformed output and exit code 2 keep today's fail-open behaviour.

1. **Payload.** Add `agent_id`, `max_context_tokens`, `instruction` (the
   `/compact` free text, when present), and `messages` — the current context
   as a flat projection (`index`, `role`, `origin_kind`, `text` with
   thinking parts excluded and a per-entry 200 000-character cap,
   `tool_calls` with raw argument strings, `tool_call_id`, `is_error`,
   `chars`).
2. **Decision.** On exit 0 the hook may print
   `hookSpecificOutput.compactionDecision: "prune"` with a `prune` object:
   `dropCalls` (tool call ids whose call and result are both removed) and
   `truncateResults` (`{ toolCallId, headChars }`, keeping a head plus an
   omission note). `"proceed"`, missing fields, or empty stdout mean "no
   prune". When several `PreCompact` hooks match, the first valid decision
   in configuration order wins.
3. **Validation and orchestration.** Kimi validates the decision against the
   live history (unknown ids, open tool exchanges, duplicate ids, and
   non-integer or negative `headChars` reject the whole decision, logged,
   and compaction proceeds as today). A validated decision is applied after
   the pre-compaction hooks and persisted as a durable
   `context.apply_prune` record so resume, replay, and the visualiser
   reproduce it; if the pruned context still blocks the next turn, the
   built-in summary runs over the pruned history and the result is reported
   as `prune_then_summary`.

A prune never rewrites user or assistant text; it only removes tool calls
and truncates tool results, and a one-line note tells the user what
happened (`mode`, dropped/truncated counts) in the compaction notice, the
`PostCompact` payload, and telemetry.

## Compatibility

- Payload and output are purely additive; old hooks see the same fields as
  today plus new ones they can ignore.
- Sessions containing `context.apply_prune` records replay on older builds
  only if those builds know the record; the record is documented as an
  incompatibility in our fork, and we would gate or version it however the
  team prefers.
- No new config keys, no changes to `Stop`/`PreToolUse` semantics, no
  behavioural change when no hook answers.

## Reference implementation

A complete patch series against the pinned upstream commit, with tests and
docs (en + zh), lives at
[github.com/kkaminsk/Kimi-JevCompact](https://github.com/kkaminsk/Kimi-JevCompact)
under `fork/patches/`:

- `0001` — the `PreCompact` payload projection and the decision schema
- `0002` — the durable `context.apply_prune` record and every replayer
- `0003` — the compaction orchestration and mode reporting
- `0004` — a build marker used to detect prune support

We are happy to split, rename, or re-scope any part of this to fit the
project's roadmap, and to maintain it behind an experimental flag if that is
the preferred path.
