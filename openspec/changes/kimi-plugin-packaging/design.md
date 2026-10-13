# Design

## Context

See proposal.md. Kimi's installer accepts a local directory, a zip URL, or a GitHub repository URL, and expects the manifest at `<root>/kimi.plugin.json` or `<root>/.kimi-plugin/plugin.json`. Plugin hooks run with cwd = plugin root and receive `KIMI_PLUGIN_ROOT` and `KIMI_CODE_HOME`. Plugin commands are Markdown prompts (`$ARGUMENTS`), not scripts, so anything that must execute runs through the agent's own shell tool. Kimi copies the plugin and never installs or builds.

## Goals / Non-Goals

**Goals:**
- One-line install from GitHub.
- Everything a user needs to diagnose a non-working setup from inside Kimi.
- The key never lands in a transcript or in git.

**Non-Goals:**
- Marketplace listing (a custom marketplace JSON can come later).
- Auto-installing the `kimi-jev` binary from the plugin.

## Decisions

### Decision 1 — Manifest at the repository root
Move `kimi.plugin.json` and the committed `dist/hook.mjs` to the repository root; keep sources in `plugin/src/`. This lets `/plugins install <repo url>` work directly.
- *Alternative: keep the plugin under `plugin/` and publish release zips.* Rejected: adds a release step and breaks "install from the repo URL". (This supersedes the `plugin/kimi.plugin.json` placeholder location from change 1; change 1's tasks note the final location.)

### Decision 2 — Commit the bundle, guard its freshness
Same approach that fixed the Claude Code plugin: committed build output plus a staleness check in `verify`.
- *Alternative: GitHub Action that commits the bundle.* Rejected: bot commits on every PR are noisy; a check that fails locally is enough.

### Decision 3 — Commands are prompts that drive the hook's CLI modes
`--doctor` and `--post` modes live in the same bundle so the plugin ships one executable. `/kimi-jevcompact:doctor` tells the agent to run it from `$KIMI_PLUGIN_ROOT` and relay the output.
- *Alternative: separate scripts per command.* Rejected: more files to keep in sync.

### Decision 4 — Prune-contract detection via a version marker
`kimi-jev` builds (change 7) write `$KIMI_CODE_HOME/kimi-jev.version` on startup. Doctor reads it; absence means stock Kimi.
- *Alternative: probe by sending a fake PreCompact.* Not possible from outside a session.

### Decision 5 — `PostCompact` hook only logs
It appends `{ mode, dropped_calls, truncated_results, estimated_token_count }` to the diagnostics log so `/kimi-jevcompact:status` can correlate what the hook proposed with what Kimi did.

### Decision 6 — Skill at session start, short
Uses `sessionStart.skill` so the model knows about omission notes. Kept under 200 words to respect the prompt budget.

## Risks / Trade-offs

- [Root-level manifest clutters the repo] → small cost; README explains the layout.
- [`node` resolution differs between shells and GUIs] → doctor reports the resolved `node` path and version.
- [Kimi may change plugin hook env or cwd] → `fork/upstream.lock` pins the version; the doctor check for `KIMI_PLUGIN_ROOT` catches it.

## Migration Plan

New plugin. Users uninstall with `/plugins remove kimi-jevcompact`.
