#!/usr/bin/env bash
# Fixture tests for the shell logic inside .github/workflows/ci.yml.
#
# Extracts the openspec-gate, conventional-title, build-test applicability,
# and docs-check applicability scripts from the workflow and runs them against
# known branch names, change folders, and PR titles. Exits non-zero on any
# mismatch. Needs bash, node (for npx js-yaml), and python3.
#
# Usage: scripts/test-ci-logic.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CI_YML="$REPO_ROOT/.github/workflows/ci.yml"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

npx --yes js-yaml "$CI_YML" > "$WORK/ci.json"

python3 -I - "$WORK/ci.json" "$WORK" <<'PY'
import json, os, subprocess, sys

ci = json.load(open(sys.argv[1]))
work = sys.argv[2]
jobs = ci["jobs"]

def step_run(job, name_or_index):
    steps = jobs[job]["steps"]
    if isinstance(name_or_index, int):
        return steps[name_or_index]["run"]
    for s in steps:
        if s.get("name") == name_or_index:
            return s["run"]
    raise KeyError(f"{job}: no step named {name_or_index}")

gate = step_run("openspec-gate", "Check branch name and OpenSpec change")
title = step_run("conventional-title", "Validate PR title")
bt_gate = step_run("build-test", "Decide whether this job applies")
dc_gate = step_run("docs-check", "Decide whether this job applies")

# Fixture repo: one active change, one archived change, one with open tasks.
root = os.path.join(work, "repo")
def mk(rel, tasks):
    d = os.path.join(root, rel)
    os.makedirs(d)
    open(os.path.join(d, "proposal.md"), "w").write("x\n")
    open(os.path.join(d, "tasks.md"), "w").write(tasks)
mk("openspec/changes/add-dark-mode", "- [x] done\n")
mk("openspec/changes/archive/2026-01-01-document-api", "- [x] done\n")
mk("openspec/changes/fix-login", "- [ ] todo\n")

# Stub npx so the validate step never downloads anything here.
binp = os.path.join(work, "bin"); os.makedirs(binp)
stub = os.path.join(binp, "npx")
open(stub, "w").write('#!/usr/bin/env bash\necho "stub npx $*"\n')
os.chmod(stub, 0o755)
env = dict(os.environ, PATH=binp + os.pathsep + os.environ["PATH"])

def run(script, **vars):
    r = subprocess.run(["bash", "-c", script], cwd=root, env=dict(env, **vars),
                       capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()

failures = 0
def check(ok, label, detail=""):
    global failures
    print(("ok   " if ok else "FAIL ") + label + (("  | " + detail) if detail and not ok else ""))
    if not ok:
        failures += 1

print("== openspec-gate ==")
cases = [
    ("feature/add-dark-mode", 0, "active change validates"),
    ("docs/document-api", 0, "archived change skips validation"),
    ("hotfix/fix-login", 1, "unchecked tasks fail"),
    ("feature/missing", 1, "missing change folder fails"),
    ("develop", 0, "release promotion is skipped"),
    ("release-please--branches--main", 0, "release-please branch is skipped"),
    ("sync/main-to-develop", 0, "sync branch is skipped"),
    ("bugfix/x", 1, "unknown prefix fails"),
    ("feature/Add_Bad", 1, "uppercase or underscore fails"),
]
for branch, want, label in cases:
    rc, out = run(gate, BRANCH=branch, GITHUB_OUTPUT=os.devnull)
    check((rc != 0) == (want != 0), f"{branch}: {label}", out.splitlines()[-1] if out else "")

print("== conventional-title ==")
titles = [
    ("feat: add thing", 0), ("fix(auth)!: drop legacy", 0),
    ("chore(release): promote develop", 0), ("chore(sync): merge main into develop", 0),
    ("docs(openspec): propose add-x", 0), ("perf(a-b1): ok", 0),
    ("Feat: bad", 1), ("feat:no-space", 1), ("build: nope", 1), ("random words", 1),
]
for t, want in titles:
    rc, out = run(title, TITLE=t)
    check((rc != 0) == (want != 0), repr(t))

print("== applicability ==")
expect = {
    "feature/x": ("true", "false"),
    "docs/y": ("false", "true"),
    "hotfix/z": ("true", "false"),
    "develop": ("true", "false"),
}
for branch, (bt_want, dc_want) in expect.items():
    out = os.path.join(work, "out.txt")
    open(out, "w").close(); run(bt_gate, BRANCH=branch, GITHUB_OUTPUT=out)
    bt = open(out).read().strip()
    open(out, "w").close(); run(dc_gate, BRANCH=branch, GITHUB_OUTPUT=out)
    dc = open(out).read().strip()
    check(bt == f"applicable={bt_want}" and dc == f"applicable={dc_want}",
          f"{branch}: build-test {bt}, docs-check {dc}")

print("== job shape ==")
for j in ("openspec-gate", "conventional-title", "build-test", "docs-check"):
    check("if" not in jobs[j] and "name" not in jobs[j], f"{j}: no job-level if, no name key")
check(ci.get("on", ci.get(True, {})).get("pull_request", {}).get("paths") is None,
      "no paths filter on the pull_request trigger")

print()
if failures:
    print(f"{failures} check(s) failed")
    sys.exit(1)
print("all checks passed")
PY
