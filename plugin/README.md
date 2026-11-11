# plugin/

The installable Kimi plugin for Kimi-JevCompact. Kimi's installer copies this
tree as-is and never runs a build, so everything the hook needs at runtime
must already be here.

- `src/` — TypeScript source of the hook.
- `dist/hook.mjs` — the self-contained bundle produced by `npm run build`
  (ignored by git until the packaging change starts committing it).
- `kimi.plugin.json` — placeholder manifest; the real one lands with the
  `kimi-plugin-packaging` change.

## Configuration

The hook reads its configuration from the environment first, then from
`$KIMI_CODE_HOME/kimi-jevcompact.json`, then from the defaults below.

| Setting | Environment variable | File key | Default |
| --- | --- | --- | --- |
| TypeSafe API key | `TYPESAFE_API_KEY` | `apiKey` | — (required) |
| Keep threshold | `KIMI_JEVCOMPACT_KEEP_THRESHOLD` | `keepThreshold` | `0.5` |
| Preserve recent messages | `KIMI_JEVCOMPACT_PRESERVE_RECENT` | `preserveRecentMessages` | `6` |
| Minimum reduction ratio | `KIMI_JEVCOMPACT_MIN_REDUCTION` | `minReductionRatio` | `0.25` |
| Jev model | `KIMI_JEVCOMPACT_MODEL` | `model` | `jev-latest` |
| Jev endpoint | `KIMI_JEVCOMPACT_BASE_URL` | `baseUrl` | `https://api.typesafe.ai/v1/systemone` |
| State budget (tokens) | `KIMI_JEVCOMPACT_MAX_STATE_TOKENS` | `maxStateTokens` | `25000` |
| Request budget (tokens) | `KIMI_JEVCOMPACT_MAX_REQUEST_TOKENS` | `maxRequestTokens` | `30000` |
| Truncation head (chars) | `KIMI_JEVCOMPACT_TRUNCATE_HEAD_CHARS` | `truncateHeadChars` | `300` |

Ratios must be within `[0, 1]`; anything invalid produces a warning in the
diagnostics log and falls back to the default. The internal deadline is the
declared hook timeout (`KIMI_JEVCOMPACT_TIMEOUT_S`, default `120`) minus five
seconds; when it passes the hook prints a `proceed` decision.

## Diagnostics

Every run appends one JSON line to
`$KIMI_CODE_HOME/logs/kimi-jevcompact.jsonl` with the timestamp, session id,
trigger, outcome (`prune`, or `proceed` with the reason), the library stats,
and — for a prune — one decision entry per scored call with both keep
probabilities. Log write failures never change the decision.

Read the log to see what the hook proposed and why:

```sh
tail -n 5 "$KIMI_CODE_HOME/logs/kimi-jevcompact.jsonl"
```
