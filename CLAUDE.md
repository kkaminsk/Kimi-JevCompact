@AGENTS.md

# Kimi-JevCompact

Verbatim, Jev-guided context compaction for Kimi Code CLI: a fork of Kimi Code
with a native `PreCompact` prune hook, plus a Kimi plugin built on the
`fast-jev-compaction` npm library. Run these before opening a PR (the npm
scripts exist once the `scaffold-kimi-jevcompact` change lands):

```text
npm ci
npm run build
npm test
npm run typecheck
bash scripts/test-ci-logic.sh
npx --yes markdownlint-cli2 "**/*.md"
```

## Before you start work

1. Run `git branch --show-current`. If you are on `main` or `develop`, stop.
   Create the OpenSpec change and the topic branch first
   (AGENTS.md, "Lifecycle for every branch", steps 1 to 3).
2. Confirm `openspec/changes/<id>/` exists, where `<id>` is the part of the
   branch name after the prefix.
3. Read `proposal.md` and `tasks.md` in that folder before touching code.
   Read `openspec/config.yaml` for the architecture decision and the pinned
   upstream commit.

## Branch quick reference

| Prefix     | Base      | Target    | Conventional type                                | CI jobs                                             |
|------------|-----------|-----------|--------------------------------------------------|-----------------------------------------------------|
| `feature/` | `develop` | `develop` | `feat`, `fix`, `refactor`, `test`, `chore`, `ci` | `openspec-gate`, `conventional-title`, `build-test` |
| `docs/`    | `main`    | `main`    | `docs`                                           | `openspec-gate`, `conventional-title`, `docs-check` |
| `hotfix/`  | `main`    | `main`    | `fix`                                            | `openspec-gate`, `conventional-title`, `build-test` |

The id after the prefix must equal an `openspec/changes/<id>/` folder.

OpenSpec commands installed here: `/opsx:new <id>` then `/opsx:ff` to create a
change, `/opsx:apply` to implement, `/opsx:verify` to check, `/opsx:archive <id>`
to finish.

## Hard rules

- Never push to `main` or `develop`.
- Never force-push a branch that has an open PR.
- Never merge a PR you authored.
- Never edit OpenSpec managed blocks.
- Never edit `CHANGELOG.md`, `.release-please-manifest.json`, or version
  fields in manifests. release-please owns them.
- Never skip `/opsx:verify` before opening a PR for review.
- Never commit secrets. Use GitHub environments and secrets.

## Where to read more

- `docs/BRANCHING.md` for the full standard, diagram, and runbooks.
- `CONTRIBUTING.md` for the human workflow.
- `AGENTS.md` for the canonical agent rules.
- `docs/research/kimi-code-compaction-seams.md` for the Kimi Code findings.
