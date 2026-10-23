# Tasks

## 1. Generate the kit

- [x] 1.1 Write `AGENTS.md`, `CLAUDE.md`, `docs/BRANCHING.md`, `CONTRIBUTING.md` with the installed OpenSpec command names; verified by reading `.claude/commands/opsx/` and `npx --yes markdownlint-cli2 "**/*.md"` passing.
- [x] 1.2 Write `.github/CODEOWNERS`, `pull_request_template.md`, the three issue forms and `config.yml`; verified the contact link points at this repository's `docs/BRANCHING.md`.
- [x] 1.3 Write `ci.yml`, `deploy-dev.yml`, `deploy-prod.yml`, `promote.yml`, `release-please.yml`, `sync-main-to-develop.yml`, `release-please-config.json`, `.release-please-manifest.json`; verified every JSON parses and `bash scripts/test-ci-logic.sh` passes against `ci.yml`.
- [x] 1.4 Write `.github/rulesets/{main,develop,branch-naming}.json` and `scripts/setup-github.{sh,ps1}`; verified `bash -n` on the shell scripts and JSON parse on the rulesets.
- [x] 1.5 Set the OpenSpec profile to `custom` with all workflows and run `openspec update --force`; verified `ls .claude/commands/opsx/` lists `new`, `ff`, `verify`, `continue`.

## 2. Repository settings (maintainer, before merge)

- [x] 2.1 Create the `AUTOMATION_TOKEN` repository secret (fine-grained PAT with contents and pull-requests write); verify by checking Settings, Secrets and variables, Actions.
- [x] 2.2 Run `scripts/setup-github.sh --dry-run`, review the printed calls, then run it for real; verify `gh repo view --json defaultBranchRef` reports `develop` and `gh api repos/kkaminsk/Kimi-JevCompact/rulesets` lists `main`, `develop`, `branch-naming`.
- [x] 2.3 Add required reviewers to the `production` environment; verify in Settings, Environments.
- [x] 2.4 Retarget this change's pull request to `develop` and confirm `openspec-gate`, `conventional-title`, `build-test`, and `docs-check` all report; verify in the PR checks panel.

## 3. Reconcile existing proposals

- [x] 3.1 Reword `scaffold-kimi-jevcompact` task 3.2 from "write" to "extend" `CONTRIBUTING.md`, add a task to switch release-please to `node` and add `@fission-ai/openspec` as a devDependency, and note that the CI guards come off; verified by reading the updated tasks file.
