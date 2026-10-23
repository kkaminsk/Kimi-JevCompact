<#
.SYNOPSIS
Configure the GitHub repository for the branching standard in docs/BRANCHING.md.

.DESCRIPTION
Idempotent. Needs the gh CLI authenticated with admin rights on the repository.
Read calls always run. Write calls are printed and, with -WhatIf, not executed.

.EXAMPLE
./scripts/setup-github.ps1 -WhatIf

.EXAMPLE
./scripts/setup-github.ps1
#>
[CmdletBinding(SupportsShouldProcess)]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RulesetDir = Join-Path $PSScriptRoot '..' '.github' 'rulesets'
$Done = [System.Collections.Generic.List[string]]::new()
$Manual = [System.Collections.Generic.List[string]]::new()

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'gh CLI not found. Install it from https://cli.github.com/'
}
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'gh is not authenticated. Run: gh auth login'
}

# Read calls always run so -WhatIf output reflects real repository state.
function Invoke-GhRead {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GhArgs)
    $output = & gh @GhArgs 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "gh $($GhArgs -join ' ') failed"
    }
    return ($output -join "`n")
}

# Returns $true when a read call succeeds, without throwing.
function Test-GhRead {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GhArgs)
    & gh @GhArgs *> $null
    return ($LASTEXITCODE -eq 0)
}

# Write calls are printed. With -WhatIf they are not executed.
function Invoke-GhWrite {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GhArgs)
    $display = "gh $($GhArgs -join ' ')"
    if ($WhatIfPreference) {
        Write-Host "What if: $display"
        return
    }
    Write-Host "+ $display"
    & gh @GhArgs
    if ($LASTEXITCODE -ne 0) {
        throw "$display failed"
    }
}

if ($WhatIfPreference) {
    Write-Host 'WHATIF: write calls are printed, not executed.'
}

# 1. Resolve owner/repo
$Repo = Invoke-GhRead repo view --json nameWithOwner --jq .nameWithOwner
Write-Host "Repository: $Repo"

# 2. Create develop from main if it does not exist
if (Test-GhRead api "repos/$Repo/git/ref/heads/develop") {
    Write-Host 'Branch develop already exists.'
}
else {
    $MainSha = Invoke-GhRead api "repos/$Repo/git/ref/heads/main" --jq .object.sha
    Invoke-GhWrite api -X POST "repos/$Repo/git/refs" -f ref=refs/heads/develop -f "sha=$MainSha"
    $Done.Add("Created branch develop from main at $MainSha")
}

# 3. Default branch
$CurrentDefault = Invoke-GhRead api "repos/$Repo" --jq .default_branch
if ($CurrentDefault -eq 'develop') {
    Write-Host 'Default branch is already develop.'
}
else {
    Invoke-GhWrite api -X PATCH "repos/$Repo" -f default_branch=develop
    $Done.Add("Default branch set to develop (was $CurrentDefault)")
}

# 4. Merge settings. Safe to repeat; the PATCH overwrites these fields.
Invoke-GhWrite api -X PATCH "repos/$Repo" `
    -F allow_squash_merge=true `
    -F allow_merge_commit=false `
    -F allow_rebase_merge=false `
    -F delete_branch_on_merge=true `
    -f squash_merge_commit_title=PR_TITLE `
    -f squash_merge_commit_message=PR_BODY
$Done.Add('Repository merge settings: squash only, PR_TITLE/PR_BODY, delete branch on merge')

# 4b. Let workflows open pull requests. Off by default, and release-please,
#     promote, and sync all fail without it when AUTOMATION_TOKEN is unset.
Invoke-GhWrite api -X PUT "repos/$Repo/actions/permissions/workflow" `
    -f default_workflow_permissions=read `
    -F can_approve_pull_request_reviews=true
$Done.Add('GitHub Actions may create and approve pull requests')

# 5. Environments. PUT creates or updates.
foreach ($EnvName in @('development', 'production')) {
    Invoke-GhWrite api -X PUT "repos/$Repo/environments/$EnvName"
    $Done.Add("Environment $EnvName ensured")
}
$Manual.Add('Add required reviewers to the production environment: Settings -> Environments -> production')

# 6. Rulesets. Update by name if present, otherwise create.
$ExistingRulesets = @{}
try {
    $json = Invoke-GhRead api "repos/$Repo/rulesets" --paginate
    if ($json) {
        foreach ($r in ($json | ConvertFrom-Json)) {
            $ExistingRulesets[$r.name] = $r.id
        }
    }
}
catch {
    Write-Warning "Could not list existing rulesets: $_"
}
foreach ($File in Get-ChildItem -Path $RulesetDir -Filter '*.json' -File) {
    $Name = (Get-Content -Path $File.FullName -Raw | ConvertFrom-Json).name
    if (-not $Name) {
        Write-Warning "Skipping $($File.Name): no name field."
        continue
    }
    if ($ExistingRulesets.ContainsKey($Name)) {
        $Id = $ExistingRulesets[$Name]
        Invoke-GhWrite api -X PUT "repos/$Repo/rulesets/$Id" --input $File.FullName
        $Done.Add("Ruleset $Name updated (id $Id)")
    }
    else {
        Invoke-GhWrite api -X POST "repos/$Repo/rulesets" --input $File.FullName
        $Done.Add("Ruleset $Name created")
    }
}
$Manual.Add('Confirm the branch-naming ruleset is supported on this plan (public repo, or Team/Enterprise for private)')

# 7. Labels. --force updates colour and description when the label exists.
$Labels = @(
    @{ Name = 'openspec'; Color = '5319e7'; Description = 'Has or needs an OpenSpec change' },
    @{ Name = 'sync';     Color = '0e8a16'; Description = 'Automated back-merge from main to develop' },
    @{ Name = 'release';  Color = 'fbca04'; Description = 'Release promotion from develop to main' },
    @{ Name = 'docs';     Color = '0075ca'; Description = 'Documentation-only work' },
    @{ Name = 'hotfix';   Color = 'b60205'; Description = 'Urgent production fix from main' }
)
foreach ($Label in $Labels) {
    Invoke-GhWrite label create $Label.Name --color $Label.Color --description $Label.Description --force
    $Done.Add("Label $($Label.Name) ensured (#$($Label.Color))")
}

# 8. Summary
Write-Host ''
Write-Host '== Done =='
if ($Done.Count -eq 0) {
    Write-Host 'Nothing to change.'
}
else {
    $Done | ForEach-Object { Write-Host "- $_" }
}
if ($WhatIfPreference) {
    Write-Host '(WhatIf: the items above were printed, not applied)'
}
Write-Host ''
Write-Host '== Remains manual =='
$Manual | ForEach-Object { Write-Host "- $_" }
Write-Host '- Create the AUTOMATION_TOKEN secret so promote, release-please, and sync PRs trigger CI'
Write-Host '- Replace {{DEFAULT_OWNERS}} in .github/CODEOWNERS if still present'
Write-Host '- Fill any remaining placeholder tokens in .github/workflows'
