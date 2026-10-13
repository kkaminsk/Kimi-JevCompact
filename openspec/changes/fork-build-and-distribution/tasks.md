# Tasks

## 1. Fork repository

- [ ] 1.1 Create `kkaminsk/kimi-code` as a GitHub fork and push branch `jev-compaction` = `b510fa9` + patches 0001–0003; verify `git log --oneline -4` on the branch shows the three patch commits on the pinned base.
- [ ] 1.2 Fill `fork/upstream.lock` (`sha`, `version: 2.1.1`, `date: 2026-10-13`, `series: 1`); verify `fork/apply.sh` reads it.

## 2. Scripts

- [ ] 2.1 Write `fork/apply.sh` (clone at SHA into `fork/build/kimi-code`, `git am` each patch, run `pnpm install` and `pnpm --filter @moonshot-ai/agent-core-v2 test`); verify a clean run exits 0 and a deliberately broken lock exits non-zero naming the patch.
- [ ] 2.2 Write `fork/build.sh` (SEA build, copy to `$KIMI_CODE_HOME/bin/kimi-jev`, version suffix, startup marker patch as patch 0004 if needed); verify `kimi-jev --version` prints `2.1.1+jev.1` and `kimi --version` is unchanged.
- [ ] 2.3 Add the startup marker write to the fork (small patch `0004-kimi-jev-version-marker.patch`); verify the marker file appears after `kimi-jev -p "hi"`.
- [ ] 2.4 Write `fork/rebase.md`; verify by performing one dry rebase onto a newer upstream commit in a scratch clone and recording the outcome in the doc.

## 3. End-to-end verification

- [ ] 3.1 Write `fork/verify-e2e.sh` using `kimi-jev -p --output-format stream-json`, a prompt that produces 20+ tool calls, `--continue` with `/compact`, and assertions over the stream events, `wire.jsonl`, and the diagnostics log; verify a green run with a real key and an expected-fail run with the plugin disabled.
- [ ] 3.2 Add a weekly GitHub Actions job running `fork/apply.sh --check` against the lock (no build, no key); verify it passes on the pinned commit.

## 4. Upstream material

- [ ] 4.1 Write `docs/upstream/feature-request.md` covering payload, output, validation, record, orchestration, compatibility, and links to the patches; verify it stands alone by having someone unfamiliar read it against the spec files.
- [ ] 4.2 Add a README section "Running the patched build" (install, update, rollback, which sessions are compatible); verify by following it on a fresh machine or container.
