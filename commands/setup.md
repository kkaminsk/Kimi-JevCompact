---
description: Set up Kimi-JevCompact: key, thresholds, and a verification compact
---

Walk the user through Kimi-JevCompact setup, one step at a time:

1. Key: tell the user to put their TypeSafe API key into `$KIMI_CODE_HOME/kimi-jevcompact.json` as `"apiKey"`. If the user pastes a key during this conversation, write it only to that file with mode 600 (owner read/write only), confirm it was written, and never echo it back into the transcript, the shell history, or any file under version control.
2. Thresholds: mention the recommended `[loop_control]` settings for earlier auto-compaction and the hook knobs (`keepThreshold`, `minReductionRatio`) documented in the plugin README.
3. Verify: ask the user to run `/compact`, then run `/kimi-jevcompact:status` to confirm a `prune` outcome, and `/kimi-jevcompact:doctor` if anything looks off.
