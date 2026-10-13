# Branching standard

> The `branch-naming` ruleset in `.github/rulesets/` blocks creation of branches
> outside the allowed prefixes. Rulesets with branch-name conditions need a
> public repository, or GitHub Team or Enterprise for private repositories.
> Kimi-JevCompact is public, so the ruleset applies. On other plans the ruleset
> is ignored and only the `openspec-gate` CI job enforces naming.

## Diagram

```text
main      ──●────────●────────●──  (prod, tagged vX.Y.Z, deploy on Release)
              \      /          /
develop   ──●──●──●──●──●──●──●──  (dev build, deploy on push)
              \    /  \     /
feature/  add-dark-mode  add-export      (from develop, to develop)
docs/     document-api                   (from main, to main)
hotfix/   fix-login                      (from main, to main; synced back to develop)
```

## Long-lived branches

| Branch    | Role                                             | Receives squash merges from                                              | Deploys to                    |
|-----------|--------------------------------------------------|--------------------------------------------------------------------------|-------------------------------|
| `main`    | Production. Always releasable. Tagged `vX.Y.Z`.  | `develop` (release promotion), `hotfix/*`, `docs/*`, release-please PRs  | production, on GitHub Release |
| `develop` | Integration. Dev build.                          | `feature/*`, automated `sync/main-to-develop` PR                         | development, on every push    |

Both are protected. No direct pushes, no force pushes, no deletion.
`develop` is the default branch so PRs target it by default.

## Topic branches

| Prefix     | Branch from | PR target | Conventional type                                  | CI jobs that run                                    | Purpose                                                                 |
|------------|-------------|-----------|----------------------------------------------------|-----------------------------------------------------|-------------------------------------------------------------------------|
| `feature/` | `develop`   | `develop` | `feat`, `fix`, `refactor`, `test`, `chore`, `ci`   | `openspec-gate`, `conventional-title`, `build-test` | Any change to application code, shipped with the next release           |
| `docs/`    | `main`      | `main`    | `docs`                                             | `openspec-gate`, `conventional-title`, `docs-check` | Documentation-only work, published independently of app releases        |
| `hotfix/`  | `main`      | `main`    | `fix`                                              | `openspec-gate`, `conventional-title`, `build-test` | Urgent production fix. The `fix:` title makes release-please cut a patch |

The part after the prefix must equal an OpenSpec change id, which is the name
of a folder under `openspec/changes/`. Ids are lowercase and hyphenated.
One change per branch. One branch per change.

The seven planned changes map to branches `feature/scaffold-kimi-jevcompact`,
`feature/precompact-prune-hook-contract`, `feature/prune-record-persistence`,
`feature/compaction-prune-orchestration`, `feature/jev-hook-script`,
`feature/kimi-plugin-packaging`, and `feature/fork-build-and-distribution`.

`docs/*` branches may only touch `docs/**`, `*.md` anywhere, and `openspec/**`.

## What "deploy" means here

Kimi-JevCompact has no hosted service. Users install the plugin from this
repository at a tag, and the patched `kimi-jev` binary is built locally from
`fork/`. The `development` and `production` environment jobs therefore only
record the commit or release. They are kept so the release flow, environment
gates, and rulesets match the standard and can carry real steps later, for
example publishing a prebuilt `kimi-jev` as a release asset.

## Release runbook

1. Confirm `develop` is green and contains everything intended for the release.
2. In the Actions tab, run **Promote develop to main**. It opens or updates a PR
   from `develop` to `main` titled `chore(release): promote develop`. The body
   lists every commit subject from `develop` that is not yet on `main`, one per
   paragraph.
3. Review the body. Remove a paragraph only if that change must not ship.
   Do not reformat the body. release-please reads each paragraph as a change.
4. Get one approval and squash merge.
5. release-please opens a release PR on `main` with the version bump and
   `CHANGELOG.md`. Review and squash merge it.
6. The merge creates tag `vX.Y.Z` and a GitHub Release. The release triggers
   `deploy-prod.yml`, which waits for the `production` environment reviewers.
7. The push to `main` also triggers the back-merge PR into `develop`. Merge it.

## Hotfix runbook

1. From `main`, create the OpenSpec change: `/opsx:new <id>` then `/opsx:ff`.
2. Branch `hotfix/<id>` from `main`. Commit the change folder first.
3. Implement, verify, and open a PR to `main` with a `fix:` title.
4. Archive the change as the final commit, get approval, squash merge.
5. release-please cuts a patch release. Production deploys from the Release.
6. Merge the back-merge PR so `develop` receives the fix.

## Back-merge

Every push to `main` triggers `sync-main-to-develop.yml`. It resets the branch
`sync/main-to-develop` to `main` and opens or updates a PR into `develop`
titled `chore(sync): merge main into develop`. A maintainer merges it.
Auto-merge is off by default. The workflow file explains how to enable it.

## Rulesets

| File                  | Applies to          | Enforces                                                                                  |
|-----------------------|---------------------|-------------------------------------------------------------------------------------------|
| `main.json`           | `main`              | PR required, 1 approval, CODEOWNERS, squash only, linear history, 4 required checks        |
| `develop.json`        | `develop`           | Same as `main`                                                                            |
| `branch-naming.json`  | every other branch  | Only `feature/`, `docs/`, `hotfix/`, `release-please--`, `sync/` prefixes can be created   |

Import them with `scripts/setup-github.ps1` or `scripts/setup-github.sh`.

Solo-maintainer exception: `main.json` and `develop.json` list repository
admins as a bypass actor (`RepositoryRole` 5, mode `always`). GitHub does not
let an author approve their own PR, and this repository has one maintainer, so
without the bypass nothing could merge. The four CI checks still run and must
be green before an admin merges. Remove the bypass when a second reviewer
joins.

Automated PRs (promote, release-please, sync) need the `AUTOMATION_TOKEN`
secret. PRs created with the default workflow token do not trigger CI, so the
required checks would never report and the PR could not merge.

## FAQ

**Where do docs changes go?**
Documentation-only work goes on a `docs/<id>` branch from `main` and merges
straight to `main`. It needs an OpenSpec change like any other branch.

**My feature needs docs. Do I need a docs branch too?**
No. Put the documentation on the feature branch. `docs/*` is only for
documentation-only work.

**What if openspec-gate fails?**
Read the error. Usually the branch name does not match a folder under
`openspec/changes/`, or `tasks.md` has unchecked items. Fix the cause and
push again.

**How do I get a change into production fast?**
Use a `hotfix/<id>` branch from `main`. It skips `develop`, releases as a
patch, and is synced back to `develop` automatically.

**Why can't I create branch `bugfix/x`?**
The `branch-naming` ruleset only allows `feature/`, `docs/`, and `hotfix/`
prefixes (plus automation branches). Use `feature/fix-x` or `hotfix/fix-x`.

**Why did release-please not open a release PR after a promotion?**
The squash commit body on `main` did not contain any `feat:` or `fix:`
paragraphs. Check that the promotion PR body was generated by the workflow
and not rewritten.

**The change I am implementing already has a folder. Do I still run `/opsx:new`?**
No. The seven planned changes were written up front. Branch from `develop`
with the matching name, run `/opsx:apply`, and follow the lifecycle from step 4.
