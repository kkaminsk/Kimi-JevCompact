---
description: Run the Kimi-JevCompact doctor and report each check
---

Run `node "$KIMI_PLUGIN_ROOT/dist/hook.mjs" --doctor` and relay the output line by line, marking each check pass or fail. When the prune-contract check fails, explain that the stock Kimi build does not support prune decisions and point the user at the `kimi-jev` build instructions in the Kimi-JevCompact repository (`fork/` directory). When the key check fails, name both fixes: set the `TYPESAFE_API_KEY` environment variable or put `apiKey` in `$KIMI_CODE_HOME/kimi-jevcompact.json`. Never print the key itself, and never write a key into any file under version control.
