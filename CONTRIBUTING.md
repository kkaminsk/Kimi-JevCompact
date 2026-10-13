# Contributing

This guide is for people. Agents follow `AGENTS.md`, which says the same thing
in more detail.

## Setup

```text
git clone https://github.com/kkaminsk/Kimi-JevCompact.git
cd Kimi-JevCompact
npm install -g @fission-ai/openspec
```

Node 20 or newer runs the plugin's hook and the tests. Building the patched
Kimi binary from `fork/` needs Node 24.15 or newer and pnpm 10.33; that is
documented in `fork/README.md` once the `fork-build-and-distribution` change
lands. Once `package.json` exists, also run `npm ci`.

Never commit a TypeSafe API key. It belongs in `$KIMI_CODE_HOME/kimi-jevcompact.json`
or the `TYPESAFE_API_KEY` environment variable. `.gitignore` already covers the
config file name.

## Where the work is

The project is specified as a series of OpenSpec changes under
`openspec/changes/`, listed in order in `README.md`, and tracked as issues in
the Linear project "Kimi-JevCompact". `openspec/config.yaml` carries the
architecture decision and the pinned upstream Kimi Code commit. Read it and
`docs/research/kimi-code-compaction-seams.md` before touching the fork patches.

## Every change starts with an OpenSpec proposal

1. Check out the base branch and pull. Use `develop` for features and `main`
   for documentation-only work and hotfixes.
2. Create the change. In Claude Code run `/opsx:new <id>` then `/opsx:ff`.
   From a terminal run `openspec new change <id>` and fill in the generated
   artifacts. The id is lowercase and hyphenated, for example `add-dark-mode`.
   The seven planned changes already have folders; skip this step for them.
3. Create the branch with the same id and commit the change folder first:

   ```text
   git switch -c feature/add-dark-mode
   git add openspec/changes/add-dark-mode
   git commit -m "docs(openspec): propose add-dark-mode"
   ```

## Branch names

| Prefix     | From      | To        | Use for                                   |
|------------|-----------|-----------|-------------------------------------------|
| `feature/` | `develop` | `develop` | Application changes for the next release  |
| `docs/`    | `main`    | `main`    | Documentation-only changes                |
| `hotfix/`  | `main`    | `main`    | Urgent production fixes                   |

The part after the prefix must match the OpenSpec change id exactly. CI checks
this on every pull request.

## Pull requests

- Title in Conventional Commits form: `feat(scope): add thing`, `fix: ...`,
  `docs: ...`. The title becomes the squash commit subject.
- Fill in the PR template. Link the change folder.
- Keep the PR in draft until every task in `tasks.md` is checked.
- Run `/opsx:verify` (or re-read the spec deltas) before requesting review.
- After approval, run `/opsx:archive <id>` and push that as the last commit.
- One approval and green CI are required. Do not merge your own PR.
- Squash merge. Delete the branch.

## Review etiquette

- Review within one working day where possible.
- Check the proposal and spec deltas, not just the diff.
- For fork patches, confirm the patch still applies to the commit in
  `fork/upstream.lock` and that the upstream test suite passes.
- Request changes with a reason. Approve when the Definition of Done in
  `AGENTS.md` is met.

## Releases

Maintainers run the **Promote develop to main** workflow. It opens a PR whose
body lists every change on `develop`. After it merges, release-please opens a
release PR. Merging that PR tags the release. Users install the plugin from the
tagged repository. See `docs/BRANCHING.md` for the full runbook.

## Hotfixes

Branch `hotfix/<id>` from `main`, use a `fix:` title, merge to `main`. The fix
is released as a patch and synced back to `develop` automatically.

## Who to ask

Code owner: @kkaminsk. Open an issue using one of the templates if you are
unsure which kind of change you need.
