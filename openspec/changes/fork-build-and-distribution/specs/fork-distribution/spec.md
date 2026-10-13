# Spec Delta

## Purpose
Covers how the patched Kimi Code build is produced, installed beside the stock binary, kept up to date with upstream, and verified end to end together with the plugin.

## ADDED Requirements

### Requirement: Reproducible patch application
`fork/apply.sh` SHALL clone `MoonshotAI/kimi-code` at the commit recorded in `fork/upstream.lock`, apply every patch in `fork/patches/` in order, and fail with the patch name if any does not apply cleanly.

#### Scenario: Clean apply
- **WHEN** `fork/apply.sh` runs with the pinned commit reachable
- **THEN** it exits 0 and the working tree contains the three patches' changes

#### Scenario: Drifted upstream
- **WHEN** `fork/upstream.lock` is edited to a commit where a patch conflicts
- **THEN** the script exits non-zero naming the failing patch

### Requirement: Side-by-side binary
`fork/build.sh` SHALL produce an executable named `kimi-jev` installed under `$KIMI_CODE_HOME/bin/`, and SHALL NOT modify or replace the managed `kimi` executable.

#### Scenario: Both binaries coexist
- **WHEN** the build completes
- **THEN** `kimi --version` still prints the stock version and `kimi-jev --version` prints the stock version followed by `+jev.<patch-series-version>`

### Requirement: Build is identifiable at runtime
A `kimi-jev` build SHALL write `$KIMI_CODE_HOME/kimi-jev.version` on startup containing its version string, so the plugin's doctor can detect prune support.

#### Scenario: Marker written
- **WHEN** `kimi-jev` starts a session
- **THEN** the marker file exists and matches `kimi-jev --version`

### Requirement: Upstream tracking procedure
`fork/rebase.md` SHALL document how to move the patch series to a newer upstream commit, including updating `fork/upstream.lock`, re-running the upstream tests, re-exporting patches, and bumping the patch-series version.

#### Scenario: Procedure is complete
- **WHEN** a maintainer follows the procedure on a newer upstream commit
- **THEN** `fork/apply.sh` succeeds against the new lock and `npm run verify` passes

### Requirement: End-to-end verification
The repository SHALL provide `fork/verify-e2e.sh` that, given a TypeSafe key in the environment, runs a scripted `kimi-jev -p` session with at least 20 tool calls, triggers a manual compaction, and asserts: the compaction notice reports prune mode, the agent's `wire.jsonl` contains a `context.apply_prune` record, the diagnostics log has matching PreCompact and PostCompact lines, and resuming the session yields the same message count.

#### Scenario: Green run
- **WHEN** the script runs against a working build and plugin
- **THEN** every assertion passes and the script exits 0

#### Scenario: Plugin disabled
- **WHEN** the plugin is disabled and the script runs
- **THEN** the compaction notice reports summary mode and the script reports the prune assertion as expected-fail rather than crashing

### Requirement: Upstream proposal material
The repository SHALL contain a feature-request document for MoonshotAI/kimi-code describing the prune contract, its validation rules, the durable record, and the orchestration, linking to the patches, and following that project's "open an issue first" policy.

#### Scenario: Document is self-contained
- **WHEN** a Kimi maintainer reads the document without this repository
- **THEN** they can understand the proposed hook payload, output shape, and record without opening the patches
