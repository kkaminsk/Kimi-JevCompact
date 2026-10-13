# Tasks

## 1. Manifest and layout

- [ ] 1.1 Create root `kimi.plugin.json` (name `kimi-jevcompact`, version from `package.json`, hooks for `PreCompact` and `PostCompact`, `commands: ./commands/`, `skills: ./skills/`, `sessionStart.skill: using-kimi-jevcompact`, `interface`); verify `/plugins install /path/to/checkout` reports `ok` with no diagnostics.
- [ ] 1.2 Move the bundle output to root `dist/hook.mjs`, track it in git, and update change-1 scripts accordingly; verify `git ls-files dist/hook.mjs` lists it.

## 2. Hook CLI modes

- [ ] 2.1 Add `--post` mode: read the PostCompact payload and append a log line; verify a test with a fixture payload.
- [ ] 2.2 Add `--doctor` mode printing pass/fail lines for Node version, key, config file, log dir, prune-contract marker, `KIMI_PLUGIN_ROOT` presence; verify tests for each failing condition and one all-pass run.

## 3. Commands and skill

- [ ] 3.1 Write `commands/status.md`, `commands/doctor.md`, `commands/setup.md` with the behaviours in the spec, including the explicit instruction never to echo the key; verify each renders in `/kimi-jevcompact:` completion after install.
- [ ] 3.2 Write `skills/using-kimi-jevcompact/SKILL.md` under 200 words; verify a new session's system prompt (via `kimi export`) contains the session-start block.

## 4. Verification script

- [ ] 4.1 Add `scripts/check-plugin.mjs` (manifest paths exist, event names in Kimi's list, bundle newer than sources) and wire it into `verify`; verify it fails on a deliberately stale bundle and passes after `npm run build`.

## 5. Install documentation

- [ ] 5.1 Write the README "Install" section: GitHub URL install, enable, `/reload`, key placement, `/kimi-jevcompact:doctor`; verify by following it on a clean `KIMI_CODE_HOME`.
