# Spec Delta

## Purpose

Defines how the Kimi-JevCompact repository is laid out, built, tested, and validated so that the plugin, the fork patches, and the proposals coexist and the hook bundle is reproducible.

## ADDED Requirements

### Requirement: Fixed repository layout

The repository SHALL keep plugin sources under `plugin/`, fork patches and scripts under `fork/`, documentation under `docs/`, and OpenSpec artefacts under `openspec/`.

#### Scenario: A contributor looks for the hook source

- **WHEN** a contributor opens the repository
- **THEN** the hook's TypeScript source is under `plugin/src/` and the plugin manifest is `plugin/kimi.plugin.json`

#### Scenario: A contributor looks for the fork patch

- **WHEN** a contributor needs the Kimi Code patch
- **THEN** the patch files and the pinned upstream commit are under `fork/`

### Requirement: Single-file hook bundle

The build SHALL produce `plugin/dist/hook.mjs` as one ESM file that runs under Node 20 or newer with no `node_modules` directory present.

#### Scenario: Bundle runs in isolation

- **WHEN** `plugin/dist/hook.mjs` is copied alone into an empty directory and executed with `node` with an empty JSON object on stdin
- **THEN** it exits without a module-resolution error

#### Scenario: Library is bundled, not vendored

- **WHEN** the repository is inspected
- **THEN** `fast-jev-compaction` appears only as a `package.json` dependency and inside the built bundle, never as copied source

### Requirement: One command verifies the repository

The repository SHALL provide a single `npm run verify` that runs typecheck, unit tests, the bundle build, the bundle isolation check, and `openspec validate --all`, and SHALL fail if any step fails.

#### Scenario: Clean checkout verifies

- **WHEN** `npm ci && npm run verify` runs on a clean checkout
- **THEN** it exits 0

#### Scenario: Continuous integration runs the same command

- **WHEN** a pull request is opened
- **THEN** the CI workflow runs `npm run verify` on Node 20 and Node 22 and reports the result on the pull request

### Requirement: No secrets in version control

The repository SHALL ignore local configuration files that may hold a TypeSafe API key and SHALL document that keys are never committed.

#### Scenario: Local config is ignored

- **WHEN** a developer creates `kimi-jevcompact.json` or a `.env` file anywhere in the checkout
- **THEN** `git status` does not list it
