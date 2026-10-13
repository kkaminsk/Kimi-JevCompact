# Proposal

## Why

The repository has seven proposals and a public GitHub remote but no branching, review, or release rules, so the first implementation PR would have nothing to enforce naming, required checks, or how a release is cut. Adopting the kkaminsk/GithubStandards kit now, before any product code, makes every later change follow one workflow.

## What Changes

- Adopt Git Flow lite with OpenSpec: `main` is production, `develop` is the integration branch and repository default, and every `feature/`, `docs/`, or `hotfix/` branch is named after an OpenSpec change id.
- Add the agent and human documentation: `AGENTS.md`, `CLAUDE.md`, `docs/BRANCHING.md`, `CONTRIBUTING.md`.
- Add the GitHub configuration: `CODEOWNERS`, pull request template, issue forms, importable rulesets for `main`, `develop`, and branch naming, and the `gh` setup scripts.
- Add the workflows: `ci.yml` with the four required checks (`openspec-gate`, `conventional-title`, `build-test`, `docs-check`), `deploy-dev.yml`, `deploy-prod.yml`, `promote.yml`, `release-please.yml`, `sync-main-to-develop.yml`, plus release-please configuration and the CI logic fixture test.
- Switch the OpenSpec profile to the custom workflow set so `/opsx:new`, `/opsx:ff`, `/opsx:verify`, and `/opsx:continue` are installed alongside the core commands.
- Guard the build, lint, and test steps until `scaffold-kimi-jevcompact` adds `package.json`, so the adoption PR and the first feature PRs can pass CI.

## Capabilities

### New Capabilities

- `repository-governance`: Branch naming, required checks, merge policy, and the release flow that every pull request to this repository must satisfy.

### Modified Capabilities

<!-- None. -->

## Impact

- **Repository settings:** `develop` becomes the default branch; squash-only merging; rulesets; environments; labels. Applied by `scripts/setup-github.sh`, which needs admin rights and the `AUTOMATION_TOKEN` secret.
- **Existing proposals:** change 1's `CONTRIBUTING.md` task becomes "extend" rather than "write". The seven planned changes are implemented on `feature/<id>` branches.
- **No product code** is touched.
