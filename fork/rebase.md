# Moving the patch series to a newer upstream commit

`fork/upstream.lock` pins the upstream commit the patches in `fork/patches/`
apply to. Upstream moves fast; this is the bounded procedure to move with it.

1. **Pick the new base.** Find the upstream commit you want (usually the
   latest release tag or `main` HEAD of `MoonshotAI/kimi-code`).
2. **Update the lock.** Edit `fork/upstream.lock`: set `sha` to the full
   commit sha, `version` to the upstream app version, `date` to today, and
   **bump `series`** by one. The series number becomes the `+jev.N` suffix
   and the marker the plugin's doctor checks.
3. **Dry-run the apply.** Run `fork/apply.sh --check`. If every patch
   applies cleanly, the rebase is mechanical: skip to step 5. If a patch
   fails, the output names it — continue to step 4 for that patch only.
4. **Rebase a conflicting patch** in a scratch clone:

   ```sh
   git clone https://github.com/MoonshotAI/kimi-code scratch
   cd scratch && git checkout -b rebase <new-sha>
   git am --3way /path/to/fork/patches/<all patches up to the conflict>
   git am --3way /path/to/fork/patches/<conflicting patch>   # resolve here
   git am --3way /path/to/fork/patches/<remaining patches>
   ```

   Resolve conflicts by keeping upstream's refactors and re-applying the
   prune behaviour on top. Run the package tests
   (`corepack pnpm --filter @moonshot-ai/agent-core-v2 test` and
   `corepack pnpm --filter @moonshot-ai/kimi-code typecheck`) with all
   patches applied.
5. **Re-export the patches.** In the scratch (or rebuilt) clone, regenerate
   each `fork/patches/000N-*.patch` with
   `git format-patch -1 --stdout <commit> > ...` so the series stays one
   commit per patch, then commit the updated lock and patches.
6. **Verify.** `fork/apply.sh --check` must exit 0, `npm run verify` in this
   repository must pass, and `fork/build.sh` must produce a `kimi-jev`
   whose `--version` ends in the new `+jev.N`.
7. **Push the fork branch.** Update the `jev-compaction` branch of
   `kkaminsk/kimi-code` with the rebased series.

## Dry-run record

- 2026-11-10: dry-run against upstream `main` HEAD `7490d07d3` (a month and
  ~400 commits past the pin). `git am --3way` of patch 0001 stops with
  conflicts in `packages/agent-core-v2/src/agent/fullCompaction/fullCompaction.ts`
  and `packages/agent-core-v2/src/agent/fullCompaction/agentExternalHooksService.ts`
  — upstream refactored both files since `b510fa9` — and patches 0002-0004
  build on 0001, so they cannot apply either. Conclusion: moving to latest
  `main` is a real rebase (steps 4-7 above), not a mechanical lock bump.
  The pinned base in `fork/upstream.lock` still applies cleanly — that is
  what the lock guarantees and what the weekly `fork/apply.sh --check` job
  watches. Re-run this dry run any time to re-check drift without committing
  to a rebase.
