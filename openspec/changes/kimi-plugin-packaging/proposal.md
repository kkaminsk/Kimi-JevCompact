# Proposal

## Why

Users should install Kimi-JevCompact the way they install any Kimi plugin: `/plugins install https://github.com/kkaminsk/Kimi-JevCompact`, enable it, `/reload`. That requires a manifest that declares the hook, ships the bundle, and gives the user commands to check that everything is wired up.

## What Changes

- Author `plugin/kimi.plugin.json` (id `kimi-jevcompact`) declaring: a `PreCompact` hook (`node ./dist/hook.mjs`, timeout 120), a `PostCompact` hook that writes the outcome to the diagnostics log, `commands`, a `skills` root, and `interface` metadata.
- Add plugin slash commands: `/kimi-jevcompact:status` (asks the agent to read the diagnostics log and report the last compactions), `/kimi-jevcompact:doctor` (asks the agent to run the bundled `doctor` mode of the hook and report), `/kimi-jevcompact:setup` (walks the user through key placement and `config.toml` thresholds).
- Add a `doctor` mode to the hook (`node ./dist/hook.mjs --doctor`) that checks Node version, key presence, config file validity, log writability, and whether the running Kimi build supports the prune contract (by reading `KIMI_CODE_HOME/bin` version or a marker file written by `kimi-jev`).
- Add a skill `using-kimi-jevcompact` loaded at session start that tells the model what the plugin does and that it may re-run tools whose results were pruned.
- Make the GitHub repository installable as-is: the built `plugin/dist/hook.mjs` is committed, and the manifest lives at the plugin root the installer expects. Decide the install source form (repo root vs `plugin/` subdirectory) and document it.
- Add `scripts/check-plugin.mjs` to the `verify` pipeline: validates the manifest against Kimi's schema fields, confirms the bundle exists and is current.

## Capabilities

### New Capabilities

- `kimi-plugin`: Kimi-JevCompact installs, enables, and operates as a standard Kimi plugin with user-facing commands for status, diagnosis, and setup.

### Modified Capabilities

<!-- None. -->

## Impact

- **Repository shape:** the manifest must be at the install root. Since Kimi's GitHub installer takes the repository root, the manifest and `dist/` move to the repository root (or the installer must be pointed at a release zip of `plugin/`). This change settles that.
- **Committed build output:** `dist/hook.mjs` is tracked, like `dist/` in fast-jev-compaction; a staleness check guards it.
- **Downstream:** change 7's verification uses `/kimi-jevcompact:doctor`.
