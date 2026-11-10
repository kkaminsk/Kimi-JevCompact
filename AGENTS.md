# AGENTS.md

Canonical rules for any AI agent working in this repository. Claude Code reads
this through `CLAUDE.md`. Kimi Code, Codex, Cursor, and Copilot read it directly.

## Project status and architecture

The repository is in the design phase: there is no product code or
`package.json` yet. The seven active changes under `openspec/changes/` are the
implementation plan; implement them in the order listed in `README.md`.

Kimi-JevCompact preserves user and assistant text verbatim while using
TypeSafe's Jev model to drop obsolete tool calls and truncate tool results. It
has two deliverables:

- A patch series against `MoonshotAI/kimi-code` at commit `b510fa9` (app 2.1.1).
  The fork turns `PreCompact` into a mutating hook, persists pruning as a
  durable context record, and falls back to the existing summary path when
  pruning does not free enough context. The patched binary is `kimi-jev`.
- A standard Kimi plugin whose bundled Node hook uses the published
  `fast-jev-compaction` 0.4.1 library. Stock Kimi shell hooks cannot mutate
  compaction, so the plugin requires the patched binary.

For each change, read its `proposal.md`, `design.md`, `tasks.md`, and spec
deltas before implementing. `openspec/config.yaml` is the canonical source for
the upstream pin, key upstream files, and artifact rules.

## Implementation guardrails

- Never rewrite, inject, or synthesize user or assistant text. Only drop tool
  calls and their matching results, or truncate tool results.
- Preserve existing behavior when no valid prune decision is returned. Ignore
  malformed or invalid decisions, log the reason, and proceed with normal
  compaction. The plugin hook always prints a decision and exits 0.
- Apply pruning through a deterministic `context.apply_prune` record and update
  every replay consumer in the relevant change; in-memory-only pruning is not
  sufficient.
- Hook payload fields are snake_case; keys inside `hookSpecificOutput` are
  camelCase. Preserve raw tool argument strings and tool-call/result pairing.
- Use TypeScript strict mode, ESM, vitest, and npm for this repository. The
  hook requires Node 20 or newer and must build to one self-contained file with
  no runtime `node_modules`. Do not vendor `fast-jev-compaction` or add another
  runtime dependency without a design change.
- Fork builds require Node 24.15 or newer and pnpm 10.33. Keep the upstream
  patch series explicit under `fork/`; do not replace it with a submodule.
- Tests must not call TypeSafe or any other live service. Use a fake Jev
  transport. Runtime network access is limited to the configurable TypeSafe
  endpoint during compaction.
- Never overwrite or replace the managed `kimi` binary. Install and verify the
  patched build only as `kimi-jev`.

## Repository map

| Path                            | Contents                                                                 |
|---------------------------------|--------------------------------------------------------------------------|
| `README.md`                     | What Kimi-JevCompact is, the architecture, the proposal series           |
| `AGENTS.md`, `CLAUDE.md`        | Agent rules (this file is canonical)                                     |
| `docs/BRANCHING.md`             | Full branching standard with diagram and runbooks                        |
| `docs/research/`                | Notes on the Kimi Code source that shaped the design                     |
| `CONTRIBUTING.md`               | Human contributor workflow                                               |
| `openspec/`                     | OpenSpec specs and change proposals; `openspec/config.yaml` holds project context |
| `.claude/`, `.kimi-code/`       | OpenSpec slash commands and skills installed by `openspec init`          |
| `.github/workflows/`            | CI, dev and prod jobs, promotion, release-please, back-merge             |
| `.github/rulesets/`             | Importable branch rulesets                                               |
| `scripts/`                      | `gh` setup scripts and the CI logic fixture test                         |
| `plugin/`, `fork/`              | Planned by `openspec/changes/scaffold-kimi-jevcompact`; not present yet  |

These checks are available in the current design-phase repository:

```text
bash scripts/test-ci-logic.sh
npx --yes markdownlint-cli2 "**/*.md"
npx --yes @fission-ai/openspec validate --all --strict
```

The npm scripts are defined by `scaffold-kimi-jevcompact`. Until that change
lands there is no `package.json`, and CI passes the npm steps with a notice.
Once it lands, run:

```text
npm ci                                        # setup
npm run typecheck                             # lint
npm run build                                 # build (single-file hook bundle)
npm test                                      # test
npm run verify                                # typecheck, test, bundle checks, and OpenSpec validation
```

## Branching standard

### Long-lived branches

| Branch    | Role                                             | Receives squash merges from                                              | Deploys to                    |
|-----------|--------------------------------------------------|--------------------------------------------------------------------------|-------------------------------|
| `main`    | Production. Always releasable. Tagged `vX.Y.Z`.  | `develop` (release promotion), `hotfix/*`, `docs/*`, release-please PRs  | production, on GitHub Release |
| `develop` | Integration. Dev build.                          | `feature/*`, automated `sync/main-to-develop` PR                         | development, on every push    |

Both are protected. No direct pushes, no force pushes, no deletion.
`develop` is the repository default branch so PRs target it by default.

### Topic branches

| Prefix     | Branch from | PR target | Conventional type                                  | CI jobs that run                                    | Purpose                                                                 |
|------------|-------------|-----------|----------------------------------------------------|-----------------------------------------------------|-------------------------------------------------------------------------|
| `feature/` | `develop`   | `develop` | `feat`, `fix`, `refactor`, `test`, `chore`, `ci`   | `openspec-gate`, `conventional-title`, `build-test` | Any change to application code, shipped with the next release           |
| `docs/`    | `main`      | `main`    | `docs`                                             | `openspec-gate`, `conventional-title`, `docs-check` | Documentation-only work, published independently of app releases        |
| `hotfix/`  | `main`      | `main`    | `fix`                                              | `openspec-gate`, `conventional-title`, `build-test` | Urgent production fix. The `fix:` title makes release-please cut a patch |

Branch naming rule: the part after the prefix MUST equal the id of an active
OpenSpec change folder, `openspec/changes/<id>/`, or an archived folder matching
`openspec/changes/archive/*-<id>/` for follow-up work. Ids are lowercase,
hyphenated, verb-first where natural: `add-dark-mode`, `fix-login-timeout`,
`document-api`. One change per branch. One branch per change.

The seven changes already under `openspec/changes/` are implemented on
`feature/<id>` branches from `develop`, in the order the README lists them.

`docs/*` branches may only touch `docs/**`, `*.md` anywhere, and `openspec/**`.
The `docs-check` CI job fails if any other path changed.

A feature that needs documentation carries that documentation on the feature
branch. `docs/*` is for documentation-only work.

### Release flow

1. A maintainer runs the `Promote develop to main` workflow (manual dispatch).
   It opens or updates a PR from `develop` to `main` titled
   `chore(release): promote develop`. The PR body is generated from
   `git log origin/main..origin/develop --no-merges --format=%s`, one subject
   per paragraph separated by blank lines. Reviewers approve and squash merge.
2. The repository squash setting uses the PR body as the commit body, so the
   squash commit on `main` carries every `feat:` and `fix:` subject from
   `develop` as its own paragraph. release-please parses each paragraph that
   starts with a Conventional type as a separate change. The `chore(release)`
   title itself is hidden from the changelog.
3. release-please, triggered by the push to `main`, opens or updates a release PR
   that bumps the version and rewrites `CHANGELOG.md` from those changes since
   the last tag.
4. Merging the release PR creates the tag `vX.Y.Z` and a GitHub Release.
5. The `release: published` event triggers `deploy-prod.yml`.

Why the body matters: squash merging collapses history. Without the generated
body, release-please would see a single `chore` commit and cut no release. Never
edit the generated body except to remove a subject that should not ship. If the
promotion PR is opened by hand, the author must write the body in the same
one-subject-per-paragraph form.

### Back-merge

Every push to `main` (release bump, hotfix, docs) triggers
`sync-main-to-develop.yml`, which opens or updates a PR from branch
`sync/main-to-develop` into `develop`. A maintainer merges it. Auto-merge is
off by default. The workflow comments explain how to turn it on.

### Commit and PR title format

Conventional Commits, enforced on the PR title because squash merging uses the
PR title as the commit subject:

```text
<type>(<optional scope>)!: <imperative summary>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `ci`, `test`, `perf`.
Use `!` or a `BREAKING CHANGE:` footer for breaking changes.

### Merge policy (enforced by rulesets)

- Squash merge only. Merge commits and rebase merges are disabled at repo level.
- At least 1 approving review. Stale reviews are dismissed on new commits.
- Code owner review required for paths listed in CODEOWNERS.
- Required status checks must pass: `openspec-gate`, `conventional-title`,
  `build-test`, and `docs-check`. The last two always report; the one that does
  not apply to the branch prefix passes with a "not applicable" step.
- Authors may not merge their own PR. GitHub cannot enforce this directly, but
  the single-approver rule plus CODEOWNERS makes it effective.
- Linear history required on `main` and `develop`.

## OpenSpec workflow

OpenSpec (<https://github.com/Fission-AI/OpenSpec>) is the spec-driven change
workflow. Every branch is the implementation of exactly one OpenSpec change.
The custom profile enables every workflow; slash commands are listed in
`.claude/commands/opsx/` and skills in `.kimi-code/skills/`. Use `openspec`
when installed globally or `npx --yes @fission-ai/openspec` otherwise, matching
CI. Check `--help` rather than assuming a flag exists.

### Lifecycle for every branch

1. Start on the correct base branch (`develop` for `feature/`, `main` for
   `docs/` and `hotfix/`). Pull latest.
2. Run `/opsx:new <id>` and then `/opsx:ff` to generate all artifacts
   (or `/opsx:continue` to create them one at a time). The result is
   `openspec/changes/<id>/` with `proposal.md`, `design.md`, `tasks.md`, and a
   `specs/` folder of spec deltas. For the seven planned changes the folder
   already exists; skip this step.
3. Create the branch `<prefix>/<id>` and commit the change folder as the first
   commit: `docs(openspec): propose <id>`. For a pre-existing change the first
   commit is the first implementation commit.
4. Run `/opsx:apply` to implement `tasks.md`, checking off tasks as they complete.
5. Run `/opsx:verify` to confirm the implementation matches the spec deltas.
6. Open a PR using the template. The PR stays in draft until every task in
   `tasks.md` is checked.
7. After approval and before merge, run `/opsx:archive <id>` on the branch and
   push the archive commit as the final commit of the PR:
   `chore(openspec): archive <id>`. The archive moves the folder to
   `openspec/changes/archive/YYYY-MM-DD-<id>/` and applies the deltas to
   `openspec/specs/`.
8. Squash merge.

### Rules

- `proposal.md` exists before any code is written.
- Spec deltas live in `openspec/changes/<id>/specs/`. Archived changes update
  `openspec/specs/`. Never edit `openspec/specs/` directly on a topic branch.
- Never edit inside a block that OpenSpec wrote between its START and END
  comment markers, if one exists. That block belongs to `openspec update`.
- Do not fabricate `openspec` CLI flags. If unsure, use the slash commands and
  check `openspec --help`.
- Read `openspec/config.yaml` before drafting any artifact. It carries the
  project context (architecture decision, pinned upstream commit, key files)
  and per-artifact rules.

### The CI gate

The `openspec-gate` job in `ci.yml` runs on every PR to `main` or `develop`:

1. If the head branch is `develop` (release promotion) or starts with
   `release-please--` or `sync/`, the gate is skipped.
2. The branch must match `^(feature|docs|hotfix)/([a-z0-9]+(-[a-z0-9]+)*)$`.
3. `openspec/changes/<id>/proposal.md` and `tasks.md` must exist, or a folder
   matching `openspec/changes/archive/*-<id>/` must exist.
4. The `tasks.md` that was found must contain no unchecked `- [ ]` line.
5. For an active change, `npx --yes @fission-ai/openspec validate <id> --strict`
   must pass. Archived changes skip validation.

## Pull request checklist

Identical to `.github/pull_request_template.md`.

- [ ] All tasks in tasks.md are checked
- [ ] /opsx:verify passes
- [ ] Tests and lint pass locally
- [ ] Documentation updated on this branch
- [ ] /opsx:archive commit is the final commit
- [ ] PR title follows Conventional Commits

## Definition of Done

- All tasks in `tasks.md` checked.
- Spec deltas written and `/opsx:verify` passes.
- `npm test` and `npm run typecheck` pass locally (once `package.json` exists),
  and `bash scripts/test-ci-logic.sh` passes.
- Documentation updated on the same branch.
- `/opsx:archive` commit pushed as the final commit.
- PR title follows Conventional Commits.

## What agents must not do

- Never push to `main` or `develop`.
- Never force-push a branch that has an open PR.
- Never merge a PR you authored.
- Never edit OpenSpec managed blocks.
- Never edit `CHANGELOG.md`, `.release-please-manifest.json`, or version
  fields in manifests. release-please owns them.
- Never skip `/opsx:verify` before opening a PR for review.
- Never commit secrets. The TypeSafe API key lives only in
  `$KIMI_CODE_HOME/kimi-jevcompact.json` or the environment. Use GitHub
  environments and secrets for CI.
