# Design

## Context

See proposal.md for motivation. Constraints that shape the layout: Kimi installs a plugin by copying the directory (no `npm install`, no build), so anything the hook needs at runtime must already be inside the plugin folder. The fork patch targets a pnpm monorepo with Node ≥ 24.15, but the hook itself must run with whatever `node` the user has on PATH, so the two toolchains are kept apart.

## Goals / Non-Goals

**Goals:**
- One repository, one `npm run verify`, no vendored library code.
- The plugin folder is self-contained after `npm run build`.
- The fork material is data (patches, a SHA, scripts), not a submodule, so the repo stays small and the pin is explicit.

**Non-Goals:**
- Publishing `kimi-jevcompact` to npm. The plugin is installed from the GitHub repo, not from npm.
- Building the Kimi fork in this repository's CI (that needs pnpm, Node 24, and a 10+ minute build; see change 7).

## Decisions

### Decision 1 — Depend on the published `fast-jev-compaction` package
Use `fast-jev-compaction@^0.4.1` from npm and bundle it into `hook.mjs`.
- *Alternative: vendor `src/` from the Claude Code repo.* Rejected: two copies drift, and the npm package already exports every building block the hook needs (`compact`, `JevAsker`, `buildJevRequest`, `parseJevResponse`).
- *Alternative: git dependency on the fork.* Rejected: npm has the newer release (0.4.1 vs the fork's 0.3.1).

### Decision 2 — Bundle with `tsdown` to a single ESM file
`tsdown` (the bundler Kimi Code itself uses) emits one file, handles TypeScript directly, and supports a `platform: node` target. `esbuild` is the fallback if `tsdown` proves awkward.
- *Alternative: ship `node_modules` inside `plugin/`.* Rejected: bloats the repo and the managed copy, and Kimi's GitHub install downloads the whole tree.

### Decision 3 — `fork/` holds patches, not a submodule
`fork/upstream.lock` records the upstream SHA (`b510fa9`) and version (2.1.1); `fork/patches/*.patch` are `git format-patch` output; `fork/apply.sh` clones upstream at the SHA and applies them.
- *Alternative: git submodule pointing at `kkaminsk/kimi-code`.* Rejected: submodules make the repo depend on a second remote being in sync, and reviewers cannot read the change in this repo.

### Decision 4 — Plain npm, not pnpm, for this repository
The repository is a single package; npm keeps the contributor surface small. pnpm is only needed inside the cloned fork, which `fork/apply.sh` handles.

### Decision 5 — Verification is one script
`verify` = `typecheck && test && build && check:bundle && openspec validate --all`. CI calls only `verify` so local and CI behaviour cannot diverge.

## Risks / Trade-offs

- [Bundled library freezes at build time] → `npm run verify` is part of every PR; a Dependabot rule bumps `fast-jev-compaction`.
- [`tsdown` version churn] → pin exact dev dependency versions; the bundle isolation check catches a broken output regardless of bundler.
- [Node version split (hook: ≥20; fork build: ≥24.15)] → document both in `CONTRIBUTING.md`; CI matrix covers the hook side only.

## Migration Plan

New repository; nothing to migrate. Rollback is deleting the scaffold.
