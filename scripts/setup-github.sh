#!/usr/bin/env bash
# Configure the GitHub repository for the branching standard in docs/BRANCHING.md.
# Idempotent. Needs the gh CLI authenticated with admin rights on the repo.
#
# Usage:
#   scripts/setup-github.sh            apply changes
#   scripts/setup-github.sh --dry-run  print every write call without executing
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULESET_DIR="$SCRIPT_DIR/../.github/rulesets"
DONE=()
MANUAL=()

command -v gh >/dev/null 2>&1 || { echo "gh CLI not found. Install it from https://cli.github.com/" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated. Run: gh auth login" >&2; exit 1; }

# Read calls always run so dry-run output reflects real repository state.
gh_read() {
  gh "$@"
}

# Write calls are printed. In dry-run they are not executed.
gh_write() {
  echo "+ gh $*"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi
  gh "$@"
}

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY RUN: write calls are printed, not executed."
fi

# 1. Resolve owner/repo
REPO=$(gh_read repo view --json nameWithOwner --jq .nameWithOwner)
echo "Repository: $REPO"

# 2. Create develop from main if it does not exist
if gh_read api "repos/$REPO/git/ref/heads/develop" >/dev/null 2>&1; then
  echo "Branch develop already exists."
else
  MAIN_SHA=$(gh_read api "repos/$REPO/git/ref/heads/main" --jq .object.sha)
  gh_write api -X POST "repos/$REPO/git/refs" -f ref=refs/heads/develop -f sha="$MAIN_SHA"
  DONE+=("Created branch develop from main at $MAIN_SHA")
fi

# 3. Default branch
CURRENT_DEFAULT=$(gh_read api "repos/$REPO" --jq .default_branch)
if [[ "$CURRENT_DEFAULT" == "develop" ]]; then
  echo "Default branch is already develop."
else
  gh_write api -X PATCH "repos/$REPO" -f default_branch=develop
  DONE+=("Default branch set to develop (was $CURRENT_DEFAULT)")
fi

# 4. Merge settings. Safe to repeat; the PATCH overwrites these fields.
gh_write api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY
DONE+=("Repository merge settings: squash only, PR_TITLE/PR_BODY, delete branch on merge")

# 4b. Let workflows open pull requests. Off by default, and release-please,
#     promote, and sync all fail without it when AUTOMATION_TOKEN is unset.
gh_write api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true
DONE+=("GitHub Actions may create and approve pull requests")

# 5. Environments. PUT creates or updates.
for ENV_NAME in development production; do
  gh_write api -X PUT "repos/$REPO/environments/$ENV_NAME"
  DONE+=("Environment $ENV_NAME ensured")
done
MANUAL+=("Add required reviewers to the production environment: Settings -> Environments -> production")

# 6. Rulesets. Update by name if present, otherwise create.
EXISTING_RULESETS=$(gh_read api "repos/$REPO/rulesets" --paginate --jq '.[] | "\(.id)\t\(.name)"' || true)
for FILE in "$RULESET_DIR"/*.json; do
  [[ -f "$FILE" ]] || continue
  NAME=$(sed -n 's/^[[:space:]]*"name":[[:space:]]*"\([^"]*\)".*/\1/p' "$FILE" | head -n 1)
  if [[ -z "$NAME" ]]; then
    echo "Skipping $FILE: no \"name\" field found." >&2
    continue
  fi
  ID=$(printf '%s\n' "$EXISTING_RULESETS" | awk -F'\t' -v n="$NAME" '$2 == n { print $1; exit }')
  if [[ -n "$ID" ]]; then
    gh_write api -X PUT "repos/$REPO/rulesets/$ID" --input "$FILE"
    DONE+=("Ruleset $NAME updated (id $ID)")
  else
    gh_write api -X POST "repos/$REPO/rulesets" --input "$FILE"
    DONE+=("Ruleset $NAME created")
  fi
done
MANUAL+=("Confirm the branch-naming ruleset is supported on this plan (public repo, or Team/Enterprise for private)")

# 7. Labels. --force updates colour and description when the label exists.
while IFS='|' read -r LABEL COLOR DESCRIPTION; do
  gh_write label create "$LABEL" --color "$COLOR" --description "$DESCRIPTION" --force
  DONE+=("Label $LABEL ensured (#$COLOR)")
done <<'LABELS'
openspec|5319e7|Has or needs an OpenSpec change
sync|0e8a16|Automated back-merge from main to develop
release|fbca04|Release promotion from develop to main
docs|0075ca|Documentation-only work
hotfix|b60205|Urgent production fix from main
LABELS

# 8. Summary
echo
echo "== Done =="
if (( ${#DONE[@]} == 0 )); then
  echo "Nothing to change."
else
  printf -- '- %s\n' "${DONE[@]}"
fi
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "(dry run: the items above were printed, not applied)"
fi
echo
echo "== Remains manual =="
printf -- '- %s\n' "${MANUAL[@]}"
echo "- Create the AUTOMATION_TOKEN secret so promote, release-please, and sync PRs trigger CI"
echo "- Replace {{DEFAULT_OWNERS}} in .github/CODEOWNERS if still present"
echo "- Fill any remaining placeholder tokens in .github/workflows"
