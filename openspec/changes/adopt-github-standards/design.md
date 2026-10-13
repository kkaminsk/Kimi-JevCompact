# Design

## Context

See proposal.md. The kit comes from kkaminsk/GithubStandards (`prompt.txt`, commit `39df604`, 2026-10-12). Discovery against this repository found: no `package.json` yet (planned by `scaffold-kimi-jevcompact`), no deployment target (the plugin installs from the repository; the patched binary is built locally), owner `@kkaminsk`, OpenSpec 1.13.2 installed with only the core profile, `openspec/` already initialised, no `AGENTS.md` or `CLAUDE.md`.

## Goals / Non-Goals

**Goals:**

- Every generated file matches the standard verbatim where the standard is prescriptive.
- The adoption PR and the first feature PRs can pass all four checks before any product code exists.

**Non-Goals:**

- Publishing release assets. Deploy steps stay no-ops until a later change defines them.
- Changing the seven existing proposals beyond one task wording.

## Decisions

### Decision 1 — Guard npm steps on `package.json` instead of leaving placeholders

`build-test`, `deploy-dev`, and `deploy-prod` run `npm ci`, `npm run typecheck`, `npm run build`, and `npm test` only when `package.json` exists, and otherwise print a notice naming the scaffold change. These are the commands the scaffold proposal defines, not guesses.

- *Alternative: leave `{{SETUP_CMD}}` and friends literal.* Rejected: a literal token in a `run:` block fails the step, which would block the adoption PR itself.
- *Alternative: skip the jobs until the manifest exists.* Rejected: a required check that does not report blocks the merge.

### Decision 2 — Deploy steps are explicit no-ops with a reason

`{{DEPLOY_DEV_CMD}}` and `{{DEPLOY_PROD_CMD}}` print what would be deployed and where to look. The environments, gates, and workflows stay in place for the day a release asset exists.

- *Alternative: delete the deploy workflows.* Rejected: the release flow and `production` environment gate are part of the standard and cost nothing idle.

### Decision 3 — release-please type `simple`, version 0.1.0

There is no package manifest to bump, so `simple` maintains only the manifest and changelog. Switch to `node` when `scaffold-kimi-jevcompact` lands (tracked in its tasks).

### Decision 4 — Custom OpenSpec profile with every workflow

OpenSpec 1.13.2 ships only the `core` preset (`propose`, `explore`, `apply`, `update`, `sync`, `archive`). The standard needs `new`, `ff`, `verify`, and `continue`, so the global profile is set to `custom` with the full list and `openspec update --force` regenerates `.claude/` and `.kimi-code/`. The profile is a per-machine setting; `CONTRIBUTING.md` tells contributors to run the same commands.

- *Alternative: copy the missing command files from the reference repo.* Rejected: `openspec update` would not own them.

### Decision 5 — Keep the CI logic fixture test

`scripts/test-ci-logic.sh` from the reference repo is project-agnostic and runs as part of `build-test`, so a change to the gate regex or the applicability logic fails before it reaches a ruleset.

### Decision 6 — `docs-check` ignores archived changes and generated folders

`.markdownlint-cli2.jsonc` is copied from the reference with its ignore list; the existing proposals already pass it without edits.

## Risks / Trade-offs

- [Setup script changes the default branch to `develop`] → run `--dry-run` first; the Linear issues and README links reference `main` paths, which keep working because `main` persists.
- [`AUTOMATION_TOKEN` missing] → promote, release-please, and sync PRs never get checks; listed as a blocking manual task.
- [Guards hide a broken npm setup once `package.json` exists] → the scaffold change's tasks remove the guards.

## Migration Plan

1. Commit this change on `feature/adopt-github-standards` from `main` (the first branch; `develop` does not exist until the setup script creates it from `main`).
2. Create the `AUTOMATION_TOKEN` secret.
3. Run `scripts/setup-github.sh --dry-run`, review, then run it for real. It creates `develop`, sets it as default, applies merge settings, environments, rulesets, labels.
4. Add required reviewers to the `production` environment.
5. Retarget the adoption PR to `develop`, confirm all four checks report, archive, squash merge.

Rollback: delete the rulesets and workflows; the repository returns to unprotected `main`.
