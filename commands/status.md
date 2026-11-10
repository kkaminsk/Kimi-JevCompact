---
description: Report the last five Kimi-JevCompact compactions from the diagnostics log
---

Read the Kimi-JevCompact diagnostics log at `$KIMI_CODE_HOME/logs/kimi-jevcompact.jsonl` and report the last five compaction runs: time, trigger, outcome (`prune` or `proceed` with its reason), estimated reduction, and the dropped/truncated counts when a prune ran. If the log file does not exist, say that Kimi-JevCompact has not run in any session yet and suggest `/kimi-jevcompact:doctor`. Never invent entries; quote only what the log contains.
