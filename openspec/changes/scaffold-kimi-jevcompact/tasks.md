# Tasks

## 1. Package and toolchain

- [ ] 1.1 Create `package.json` (`name: kimi-jevcompact`, `type: module`, `engines.node >=20`, `private: true`) with scripts `typecheck`, `test`, `build`, `check:bundle`, `verify`; verify `npm run verify` is listed by `npm run`.
- [ ] 1.2 Add `tsconfig.json` (strict, ESM, `moduleResolution: bundler`, `rootDir: plugin/src`) and a `plugin/src/index.ts` placeholder; verify `npm run typecheck` exits 0.
- [ ] 1.3 Add `fast-jev-compaction@^0.4.1` as a dependency and `typescript`, `vitest`, `tsdown` as exact dev dependencies; verify `npm ls fast-jev-compaction` resolves 0.4.x.
- [ ] 1.4 Add `vitest.config.ts` and one passing smoke test under `plugin/test/`; verify `npm test` exits 0.

## 2. Bundle

- [ ] 2.1 Add the `tsdown` config that bundles `plugin/src/hook.ts` to `plugin/dist/hook.mjs` (platform node, ESM, single file, no externals); verify `npm run build` writes the file and `grep -c "api.typesafe.ai" plugin/dist/hook.mjs` is ≥ 1.
- [ ] 2.2 Add `scripts/check-bundle.mjs` that copies `hook.mjs` into a temp dir and runs it with `{}` on stdin; verify it exits 0 and fails when `node_modules` imports leak (test by temporarily marking a dependency external).

## 3. Repository layout and docs

- [ ] 3.1 Create `plugin/kimi.plugin.json` placeholder (name `kimi-jevcompact`, version `0.0.0`), `plugin/README.md`, `fork/README.md`, `fork/upstream.lock` (`sha: b510fa9`, `version: 2.1.1`, `date: 2026-10-13`), `fork/patches/.gitkeep`; verify the tree matches the layout in the spec.
- [ ] 3.2 Extend the existing `CONTRIBUTING.md` (from `adopt-github-standards`) with the `npm ci` setup step, where each artefact lives, and the fork toolchain details; verify it still passes markdownlint and links to `docs/research/kimi-code-compaction-seams.md`.
- [ ] 3.3 Extend `.gitignore` to cover `kimi-jevcompact.json`, `.env`, `plugin/dist/`, and `fork/build/`; verify `git check-ignore kimi-jevcompact.json` prints the path.

## 4. Continuous integration

- [ ] 4.1 Make the `build-test` job in the existing `.github/workflows/ci.yml` run `npm run verify` on a Node 20 and 22 matrix; verify the workflow passes on the PR that adds it.
- [ ] 4.2 Add `@fission-ai/openspec` as a devDependency and `openspec validate --all` to `verify`; verify it passes with the existing changes.
- [ ] 4.3 Remove the `package.json` guards from `build-test`, `deploy-dev.yml`, and `deploy-prod.yml` (added by `adopt-github-standards`) and switch `release-please-config.json` to `release-type: node`; verify CI runs the real `npm` steps on this change's pull request.
