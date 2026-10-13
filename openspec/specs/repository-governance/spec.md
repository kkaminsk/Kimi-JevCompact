# repository-governance Specification

## Purpose
Defines the rules every pull request and release in this repository must satisfy: branch naming tied to OpenSpec changes, the required CI checks, the merge policy, and the promotion and release flow.

## Requirements

### Requirement: Branches are named after OpenSpec changes

Every topic branch SHALL be named `feature/<id>`, `docs/<id>`, or `hotfix/<id>` where `<id>` is a lowercase hyphenated OpenSpec change id with a folder under `openspec/changes/` or `openspec/changes/archive/`.

#### Scenario: Matching branch passes the gate

- **WHEN** a pull request comes from `feature/jev-hook-script` and `openspec/changes/jev-hook-script/` holds a proposal and a tasks file with no unchecked task
- **THEN** the `openspec-gate` check passes

#### Scenario: Unknown prefix fails

- **WHEN** a pull request comes from `bugfix/anything`
- **THEN** the `openspec-gate` check fails and names the allowed prefixes

#### Scenario: Automation branches are exempt

- **WHEN** a pull request comes from `develop`, a `release-please--` branch, or a `sync/` branch
- **THEN** the `openspec-gate` check is skipped and reports success

### Requirement: Four checks are required on main and develop

Pull requests to `main` or `develop` SHALL report the checks `openspec-gate`, `conventional-title`, `build-test`, and `docs-check`, and all four SHALL pass before merge. A check that does not apply to the branch prefix SHALL still report success with a "not applicable" notice.

#### Scenario: Docs branch

- **WHEN** a pull request comes from a `docs/` branch
- **THEN** `build-test` reports success without building and `docs-check` validates that only `docs/**`, Markdown files, and `openspec/**` changed

#### Scenario: Before the package manifest exists

- **WHEN** a feature pull request is opened and the repository has no `package.json`
- **THEN** `build-test` passes with a notice naming the `scaffold-kimi-jevcompact` change instead of failing

### Requirement: Pull request titles are Conventional Commits

The title SHALL match `^(feat|fix|docs|chore|refactor|ci|test|perf)(\([a-z0-9-]+\))?!?: .+`.

#### Scenario: Valid title

- **WHEN** the title is `feat(hook): emit prune decision`
- **THEN** `conventional-title` passes

#### Scenario: Invalid title

- **WHEN** the title is `Add hook`
- **THEN** `conventional-title` fails with the expected format

### Requirement: Squash-only merge with one review

`main` and `develop` SHALL accept only squash merges, SHALL require one approving review with stale reviews dismissed on push and code-owner review for owned paths, and SHALL reject direct pushes, force pushes, and deletion.

#### Scenario: Direct push rejected

- **WHEN** anyone pushes directly to `develop`
- **THEN** the push is rejected by the ruleset

### Requirement: Releases come from promotion and release-please

A release SHALL be produced by promoting `develop` to `main` through a pull request whose body lists one commit subject per paragraph, after which release-please opens a release pull request that, when merged, creates the tag and GitHub Release.

#### Scenario: Promotion carries subjects

- **WHEN** the promote workflow runs with three `feat:` commits on `develop` not on `main`
- **THEN** the opened pull request body has three paragraphs, one per subject

#### Scenario: Back-merge after release

- **WHEN** a release pull request merges to `main`
- **THEN** a pull request from `sync/main-to-develop` into `develop` is opened or updated
