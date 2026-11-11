# fork/

The Kimi Code fork material: a patch series against the pinned upstream commit
in `upstream.lock`, plus scripts that apply and build it.

- `upstream.lock` — the pinned upstream commit, version, and date.
- `patches/` — `git format-patch` output, applied in order by `apply.sh`.
- `apply.sh`, `build.sh` — land with the `fork-build-and-distribution` change.

The fork patches turn Kimi's `PreCompact` hook into a mutating hook so the
plugin can prune obsolete tool calls instead of summarising them away. See
[`../docs/research/kimi-code-compaction-seams.md`](../docs/research/kimi-code-compaction-seams.md)
for the upstream seams the patches use.

Building the patched binary needs Node 24.15 or newer and pnpm 10.33. The
build never touches the managed `kimi` binary; it installs `kimi-jev`
beside it.
