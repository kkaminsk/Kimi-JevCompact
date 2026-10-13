# Tasks

## 1. Mapping

- [ ] 1.1 Implement `plugin/src/mapping.ts`: `toLibraryMessages(payloadMessages)` returning `{ messages, idByToolCall }` and `toPruneDecision(result, truncateHeadChars)`; verify vitest cases for pairing out of order, orphan result ignored, arguments non-JSON, thinking-free text, and the mixed decision scenario from the spec.

## 2. Configuration

- [ ] 2.1 Implement `plugin/src/config.ts` with env → file → defaults precedence and validation (numbers finite, ratios in [0,1]); verify tests for env override, missing file, malformed file (falls back with a logged warning).

## 3. Transport and decision

- [ ] 3.1 Implement `jevAsker(fetch, apiKey, model, baseUrl, signal)` using `buildJevRequest`/`parseJevResponse`; verify a test with a fake `fetch` returning a canned Jev response and one returning HTTP 500.
- [ ] 3.2 Implement `plugin/src/hook.ts` main: read stdin, detect unpatched payload, resolve config, run `compact`, enforce `minReductionRatio`, emit prune or proceed JSON, always exit 0; verify end-to-end tests piping fixture payloads through the function with the fake asker for: success, no key, small reduction, Jev failure, unpatched payload, deadline.
- [ ] 3.3 Implement the `note` and `message` formatting; verify the note scenario string exactly.

## 4. Diagnostics

- [ ] 4.1 Implement `plugin/src/log.ts` appending JSON lines under `$KIMI_CODE_HOME/logs/`, creating the directory, swallowing write errors; verify a test with a temp `KIMI_CODE_HOME` and one with an unwritable path.

## 5. Bundle and docs

- [ ] 5.1 Wire `hook.ts` as the bundle entry; verify `npm run build && npm run check:bundle` passes and `echo '{}' | node plugin/dist/hook.mjs` prints a proceed decision.
- [ ] 5.2 Write `plugin/README.md` sections "Configuration" (env and file keys with defaults) and "Diagnostics" (log path, how to read decisions); verify the defaults table matches `config.ts`.
