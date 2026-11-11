---
name: using-kimi-jevcompact
description: How pruned tool results behave in this session
---

Kimi-JevCompact is enabled: during compaction, obsolete tool calls may be dropped and tool results truncated instead of summarised. User and assistant text is always kept verbatim.

What to know:

- A truncated tool result ends with an omission note (`[… N chars omitted by prune; re-run the tool if needed …]`) — the full result was removed, not summarised.
- When the note says the data matters, re-run the tool (for example Read or Grep the path again) to recover it; the wire log keeps everything for the visualiser.
- Diagnostics live at `$KIMI_CODE_HOME/logs/kimi-jevcompact.jsonl`; `/kimi-jevcompact:status` summarises recent compactions.
