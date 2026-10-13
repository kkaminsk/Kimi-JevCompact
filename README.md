# Kimi-JevCompact

Verbatim, Jev-guided context compaction for [Kimi Code CLI](https://github.com/MoonshotAI/kimi-code).
The Kimi counterpart of [fast-jev-compaction](https://github.com/kkaminsk/fast-jev-compaction)
for Claude Code.

When Kimi compacts a session today it asks the model to write a summary, and a summary is lossy.
Kimi-JevCompact instead scores every tool call and tool result with TypeSafe's Jev model in one
fast request, drops or truncates the ones that are no longer needed, and keeps everything else
word for word. User and assistant text is never rewritten.

## Status

Design phase. This repository currently holds a series of [OpenSpec](https://github.com/Fission-AI/OpenSpec)
proposals under `openspec/changes/`. No product code yet.

## Architecture

Kimi Code's shell hooks can observe compaction (`PreCompact`, `PostCompact`) but cannot change it,
and plugins cannot load in-process code. So Kimi-JevCompact is two pieces:

1. **A fork of Kimi Code** (`kkaminsk/kimi-code`, branch `jev-compaction`) that turns `PreCompact`
   into a mutating hook: the hook receives the agent history and may answer with a prune decision.
   Kimi applies the prune, records it durably, and skips the model-written summary when the prune
   frees enough context. The patch is small and documented so it can be offered upstream.
2. **A Kimi plugin** (`kimi.plugin.json`) that declares the `PreCompact` hook. The hook command is a
   bundled Node script built on the `fast-jev-compaction` npm library.

The patched build ships as `kimi-jev` and never overwrites the managed `kimi` binary.

## Proposal series

Read them in order. Each change has a proposal, specs, design, and tasks.

| # | Change | What it covers |
| --- | --- | --- |
| 1 | `scaffold-kimi-jevcompact` | Repository layout, toolchain, dependency on `fast-jev-compaction`, CI |
| 2 | `precompact-prune-hook-contract` | Fork patch 1: the `PreCompact` payload and prune-decision protocol |
| 3 | `prune-record-persistence` | Fork patch 2: the `context.apply_prune` durable record and replay support |
| 4 | `compaction-prune-orchestration` | Fork patch 3: compaction service runs the prune, falls through to summary when needed |
| 5 | `jev-hook-script` | The hook executable: message mapping, Jev scoring, config, fail-open |
| 6 | `kimi-plugin-packaging` | The installable plugin: manifest, hooks, slash commands, skill |
| 7 | `fork-build-and-distribution` | Fork branch, patch series, `kimi-jev` build, verification, upstream issue |

```sh
openspec status --change precompact-prune-hook-contract
openspec show precompact-prune-hook-contract
```

Research notes on the Kimi Code source that shaped these proposals are in
[`docs/research/kimi-code-compaction-seams.md`](docs/research/kimi-code-compaction-seams.md).

## Contributing

This repository follows the [kkaminsk/GithubStandards](https://github.com/kkaminsk/GithubStandards)
kit: Git Flow lite with OpenSpec. `main` is production, `develop` is the default
branch, and every `feature/`, `docs/`, or `hotfix/` branch is named after an
OpenSpec change id. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the human
workflow, [`docs/BRANCHING.md`](docs/BRANCHING.md) for the full standard and
runbooks, and [`AGENTS.md`](AGENTS.md) for the rules agents follow.

Work is tracked in the Linear project "Kimi-JevCompact", one issue per proposal.

## License

MIT
