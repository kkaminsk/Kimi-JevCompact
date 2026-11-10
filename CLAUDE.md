@AGENTS.md

# Kimi-JevCompact

Verbatim, Jev-guided context compaction for Kimi Code CLI. A patched Kimi fork
applies structured prune decisions; a standard Kimi plugin produces those
decisions with the `fast-jev-compaction` npm library. User and assistant text
is never rewritten.

The repository is currently in the design phase. There is no product code or
`package.json`; the seven changes under `openspec/changes/` define the work.

## Before you start work

1. Run `git branch --show-current`. If you are on `main` or `develop`, stop.
   Create the OpenSpec change and the topic branch first
   (`AGENTS.md`, "Lifecycle for every branch", steps 1 to 3).
2. Confirm `openspec/changes/<id>/` exists, where `<id>` is the part of the
   branch name after the prefix. An archived `openspec/changes/archive/*-<id>/`
   folder is also valid for follow-up work on an archived change.
3. Read the change's `proposal.md`, `design.md`, `tasks.md`, and spec deltas
   before touching code. Read `openspec/config.yaml` for the architecture,
   upstream commit, casing rules, and key upstream files.
4. Before fork work, also read `docs/research/kimi-code-compaction-seams.md`
   and check that the patch still targets upstream `b510fa9` (app 2.1.1).

## Implementation order

Implement the active changes in this order; do not treat later proposals as
already implemented:

1. `scaffold-kimi-jevcompact`: npm/TypeScript toolchain, `plugin/` and `fork/`
   layout, single-file bundle.
2. `precompact-prune-hook-contract`: fork patch 1, the mutating `PreCompact`
   payload and validated prune response.
3. `prune-record-persistence`: fork patch 2, deterministic
   `context.apply_prune` persistence and every replay consumer.
4. `compaction-prune-orchestration`: fork patch 3, prune execution, summary
   fallback, result reporting, and telemetry.
5. `jev-hook-script`: message mapping, Jev transport, configuration,
   fail-open behavior, and diagnostics.
6. `kimi-plugin-packaging`: installable manifest, hooks, commands, skill, and
   committed current bundle.
7. `fork-build-and-distribution`: reproducible `kimi-jev` build, end-to-end
   verification, update procedure, and upstream proposal.

## Non-negotiable behavior

- Only tool calls and tool results may be dropped or truncated. Never rewrite,
  inject, or synthesize user or assistant text.
- No decision, an invalid decision, missing credentials, undersized reduction,
  or a Jev failure means normal compaction. The hook prints a decision and
  exits 0; it never makes compaction fail closed.
- Pruning must survive resume, fork, undo, transcript generation, and session
  visualization through the durable record and deterministic replay.
- Hook payload fields are snake_case; `hookSpecificOutput` keys are camelCase.
  Keep tool-call ids and raw argument strings intact when mapping messages.
- The plugin uses TypeScript strict, ESM, Node 20 or newer, and the published
  `fast-jev-compaction` 0.4.1 dependency. Its bundle needs no runtime
  `node_modules`; tests use a fake Jev transport and no live network.
- Fork builds use Node 24.15 or newer and pnpm 10.33. Install the patched
  executable as `kimi-jev`; never overwrite the managed `kimi` binary.

## Verification

For the current design-phase repository, run:

```text
bash scripts/test-ci-logic.sh
npx --yes markdownlint-cli2 "**/*.md"
npx --yes @fission-ai/openspec validate --all --strict
```

After `scaffold-kimi-jevcompact` adds `package.json`, run:

```text
npm ci
npm run verify
bash scripts/test-ci-logic.sh
npx --yes markdownlint-cli2 "**/*.md"
```

Also perform the change-specific verification in `tasks.md`. For fork changes,
run the pinned upstream tests; for the completed system, exercise a real
compaction, prune-record replay, and session resume as specified by change 7.

## Branch quick reference

| Prefix     | Base      | Target    | Conventional type                                | CI jobs                                             |
|------------|-----------|-----------|--------------------------------------------------|-----------------------------------------------------|
| `feature/` | `develop` | `develop` | `feat`, `fix`, `refactor`, `test`, `chore`, `ci` | `openspec-gate`, `conventional-title`, `build-test` |
| `docs/`    | `main`    | `main`    | `docs`                                           | `openspec-gate`, `conventional-title`, `docs-check` |
| `hotfix/`  | `main`    | `main`    | `fix`                                            | `openspec-gate`, `conventional-title`, `build-test` |

The id after the prefix must equal an `openspec/changes/<id>/` folder or an
archived change with the same id. OpenSpec commands installed here:
`/opsx:new <id>` then `/opsx:ff` to create a change, `/opsx:apply` to implement,
`/opsx:verify` to check, and `/opsx:archive <id>` to finish. If the CLI is not
installed globally, use `npx --yes @fission-ai/openspec` for terminal commands.

## Hard rules

- Never push to `main` or `develop`.
- Never force-push a branch that has an open PR.
- Never merge a PR you authored.
- Never edit OpenSpec managed blocks or edit `openspec/specs/` directly on a
  topic branch.
- Never edit `CHANGELOG.md`, `.release-please-manifest.json`, or version
  fields in manifests. release-please owns them.
- Never skip `/opsx:verify` before opening a PR for review.
- Never commit secrets. The TypeSafe key belongs only in the environment or
  `$KIMI_CODE_HOME/kimi-jevcompact.json`; use GitHub secrets for CI.

## Where to read more

- `AGENTS.md` for the canonical agent, branching, release, and OpenSpec rules.
- `README.md` for the proposal series and user-facing architecture.
- `docs/BRANCHING.md` for the full branching standard and runbooks.
- `CONTRIBUTING.md` for the human workflow.
- `docs/research/kimi-code-compaction-seams.md` for the upstream findings.
