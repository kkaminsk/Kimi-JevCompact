# Proposal

## Why

Kimi-JevCompact needs a repository that can hold three different kinds of artefact side by side: a Kimi plugin that ships a bundled hook script, a patch series against a pinned Kimi Code commit, and the OpenSpec proposals that govern both. Without an agreed layout and toolchain, the later changes would each invent their own.

## What Changes

- Create the repository layout: `plugin/` (the installable Kimi plugin and its hook source), `fork/` (patch series, pinned upstream SHA, apply and build scripts), `docs/`, `openspec/`.
- Set up a single npm package (`kimi-jevcompact`, ESM, TypeScript strict, Node ≥ 20) that depends on the published `fast-jev-compaction` library (0.4.1) instead of vendoring it.
- Add a bundler step that produces one self-contained `plugin/dist/hook.mjs` with no runtime `node_modules`, because Kimi copies a plugin directory as-is and never runs an install.
- Add vitest, typecheck, lint, and a GitHub Actions workflow that runs them plus `openspec validate`.
- Add contributor docs: `CONTRIBUTING.md` (conventional commits, where each artefact lives) and the research notes already in `docs/research/`.

## Capabilities

### New Capabilities

- `repo-toolchain`: The repository builds, tests, and validates reproducibly, and produces the single-file hook bundle the plugin needs.

### Modified Capabilities

<!-- None: first change in the repository. -->

## Impact

- **Code:** new `package.json`, `tsconfig.json`, `vitest.config.ts`, bundler config, `.github/workflows/ci.yml`, `plugin/` and `fork/` skeletons.
- **Dependencies:** `fast-jev-compaction@^0.4.1` (runtime, bundled), `typescript`, `vitest`, `tsdown` or `esbuild` (dev).
- **Downstream:** every later change assumes this layout. The `fork/` directory is only a skeleton here; the patch content arrives with changes 2–4 and the build procedure with change 7.
