# Design

## Context

See proposal.md. Upstream builds a single executable with `build:native:sea --profile=local` (Node ≥ 24.15, pnpm 10.33). The installed stock binary lives at `~/.kimi-code/bin/kimi` and `kimi upgrade` overwrites it, so a patched build must live under a different name. Upstream accepts external PRs only for approved bug fixes; features are discussed in issues first.

## Goals / Non-Goals

**Goals:**
- Anyone with the toolchain can rebuild `kimi-jev` from this repository alone.
- Updating to a newer upstream is a documented, bounded task.
- Verification exercises the real binary, the real plugin, and the real Jev endpoint once.

**Non-Goals:**
- Prebuilt binary releases (possible later via GitHub Releases).
- Windows builds (Linux and macOS first; the SEA build script is cross-platform in principle).

## Decisions

### Decision 1 — Patches in this repo, branch in the fork, lock file as the pin
The fork branch is for review and for the upstream issue link; the patches are the source of truth. `fork/upstream.lock` holds `sha`, `version`, `date`, `series`.
- *Alternative: only the fork branch.* Rejected: the proposals and the patches would live in different repositories.

### Decision 2 — Separate binary name, version suffix, startup marker
`kimi-jev --version` prints `2.1.1+jev.1`; startup writes `kimi-jev.version`. The marker is the cheapest cross-process signal to the plugin.
- *Alternative: replace `kimi` and block `kimi upgrade`.* Rejected: interferes with the user's stock installation.

### Decision 3 — `verify-e2e.sh` drives `kimi-jev -p` with stream-json output
Non-interactive mode plus `--output-format stream-json` gives machine-readable events, including `compaction.*`. The script seeds tool calls by prompting for a repository walk (reads of many files) to reach 20+ calls, then issues `/compact` through a second `-p` invocation with `--continue`.
- *Alternative: drive the TUI with expect.* Rejected: brittle.

### Decision 4 — Upstream request is a document, filed by the maintainer
The document is written so it can be pasted into an issue. Filing it is a manual, deliberate step after the e2e run is green, because the project's policy asks for discussion before code.

### Decision 5 — Build script never runs as root and never touches PATH
It prints the `export PATH` line or alias suggestion instead.

## Risks / Trade-offs

- [Upstream moves fast; patches rot] → the lock pins a known-good base; `rebase.md` and CI's `fork/apply.sh --check` job (run weekly against the lock, not against HEAD) warn early.
- [SEA build is slow (10+ min)] → not part of `npm run verify`; a separate manual script.
- [e2e needs a real key and spends Jev credits] → opt-in via environment; skipped in CI.

## Migration Plan

Install: run `fork/apply.sh && fork/build.sh`. Update: follow `fork/rebase.md`, rebuild. Rollback: delete `kimi-jev` and the marker; the stock `kimi` was never modified. Sessions pruned by `kimi-jev` stay readable only by `kimi-jev` (see change 3).

## Open Questions

1. Whether to publish prebuilt `kimi-jev` binaries via GitHub Releases once the patch series stabilises. Deferrable; does not change the scripts.
