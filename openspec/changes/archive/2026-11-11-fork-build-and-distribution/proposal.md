# Proposal

## Why

The three fork patches are useless until someone can build and run a Kimi binary that includes them, keep that binary current as upstream moves, and verify the whole chain end to end. This change defines the fork workflow, the `kimi-jev` build, the verification procedure, and the upstream feature request that could one day make the fork unnecessary.

## What Changes

- Create the GitHub fork `kkaminsk/kimi-code` with branch `jev-compaction` holding patches 0001–0003 on top of the pinned upstream commit `b510fa9`.
- Add `fork/apply.sh`: clones upstream at the pinned SHA into `fork/build/kimi-code`, applies `fork/patches/*.patch`, and runs the upstream test suite for `agent-core-v2`.
- Add `fork/build.sh`: runs `pnpm install` and `pnpm -C apps/kimi-code build:native:sea --profile=local`, copies the resulting executable to `$KIMI_CODE_HOME/bin/kimi-jev`, and installs a startup shim that writes `$KIMI_CODE_HOME/kimi-jev.version`. The managed `kimi` binary is never touched.
- Add `fork/rebase.md`: the procedure to move the patch series to a new upstream commit, update `fork/upstream.lock`, and re-export patches.
- Add an end-to-end verification script and checklist: build, install the plugin, configure a key, run a scripted session that makes 20+ tool calls, run `/compact`, assert the notice shows prune mode, assert the wire log has `context.apply_prune`, resume the session, and assert the message count matches.
- Draft `docs/upstream/feature-request.md`: the feature issue for MoonshotAI/kimi-code proposing the prune contract (changes 2–4) with links to the patches, written to the project's "discuss first" contribution policy.

## Capabilities

### New Capabilities

- `fork-distribution`: A reproducible way to build, install, update, and verify the patched Kimi binary, plus the material to propose the patch upstream.

### Modified Capabilities

<!-- None. -->

## Impact

- **External:** a public fork repository under the maintainer's GitHub account; a feature issue filed upstream once the patches are tested.
- **Local:** `~/.kimi-code/bin/kimi-jev` and `~/.kimi-code/kimi-jev.version`.
- **Tooling:** requires Node ≥ 24.15 and pnpm 10.33 for the build only.
