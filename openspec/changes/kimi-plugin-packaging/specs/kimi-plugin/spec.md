# Spec Delta

## Purpose
Describes how Kimi-JevCompact is installed and operated as a Kimi Code plugin: manifest contents, hooks it declares, commands it offers, and what a fresh install must contain to work without a build step.

## ADDED Requirements

### Requirement: Installable from the GitHub repository
Running `/plugins install https://github.com/kkaminsk/Kimi-JevCompact` in Kimi Code SHALL install a plugin with id `kimi-jevcompact` that shows `ok` in `/plugins info kimi-jevcompact`, with no diagnostics about missing files.

#### Scenario: Fresh install
- **WHEN** the repository is installed and `/reload` is run
- **THEN** `/plugins list` shows `kimi-jevcompact` enabled and `/hooks` lists its `PreCompact` and `PostCompact` hooks

#### Scenario: No build at install time
- **WHEN** the managed copy under `$KIMI_CODE_HOME/plugins/managed/kimi-jevcompact/` is inspected
- **THEN** it contains `dist/hook.mjs` and no `node_modules` directory is required for the hook to run

### Requirement: Declared hooks
The manifest SHALL declare a `PreCompact` hook running `node ./dist/hook.mjs` with a timeout of 120 seconds and a `PostCompact` hook running `node ./dist/hook.mjs --post` with a timeout of 10 seconds.

#### Scenario: Hook fires on compaction
- **WHEN** `/compact` runs with the plugin enabled on a `kimi-jev` build
- **THEN** the diagnostics log gains a line from the PreCompact run followed by a line from the PostCompact run with the reported `mode`

### Requirement: Status command
`/kimi-jevcompact:status` SHALL make the agent read the diagnostics log and report the last five compactions: time, trigger, outcome, reduction, dropped and truncated counts, or state that no compaction has run yet.

#### Scenario: No history
- **WHEN** the log file does not exist
- **THEN** the agent reports that Kimi-JevCompact has not run in any session yet and suggests `/kimi-jevcompact:doctor`

### Requirement: Doctor command
`/kimi-jevcompact:doctor` SHALL make the agent run `node ./dist/hook.mjs --doctor` from the plugin root and report each check as pass or fail: Node ≥ 20 on PATH, API key resolvable, config file parseable (or absent), log directory writable, Kimi build supports the prune contract.

#### Scenario: Stock Kimi
- **WHEN** doctor runs under the unpatched `kimi` binary
- **THEN** the prune-contract check fails with a message pointing to the `kimi-jev` build instructions, while the other checks still run

#### Scenario: Missing key
- **WHEN** no key is configured
- **THEN** the key check fails and names both the environment variable and the config file path

### Requirement: Setup command
`/kimi-jevcompact:setup` SHALL guide the user through: where to put the TypeSafe key, the recommended `[loop_control]` settings for earlier auto-compaction, and how to confirm with `/compact`, without ever writing the key into a file under version control or into the session transcript.

#### Scenario: Key handling
- **WHEN** the user pastes a key during setup
- **THEN** the agent writes it only to `$KIMI_CODE_HOME/kimi-jevcompact.json` with mode 600 and does not echo it back

### Requirement: Session-start skill
The plugin SHALL load a skill at session start that tells the model, in under 200 words, that older tool results may have been pruned verbatim rather than summarised, that pruned results end with an omission note, and that re-running the tool is the way to recover them.

#### Scenario: Skill present
- **WHEN** a new session starts with the plugin enabled
- **THEN** the system prompt contains the plugin's session-start block

### Requirement: Manifest and bundle are checked
`npm run verify` SHALL fail if the manifest references a file that does not exist, declares an event name Kimi does not know, or if `dist/hook.mjs` is older than any file under `plugin/src/`.

#### Scenario: Stale bundle
- **WHEN** a source file is edited and the bundle is not rebuilt
- **THEN** `npm run verify` fails naming the stale bundle
