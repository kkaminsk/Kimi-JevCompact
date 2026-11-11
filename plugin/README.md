# plugin/

The installable Kimi plugin. Kimi's installer copies this tree as-is and never
runs a build, so everything the hook needs at runtime must already be here.

- `src/` — TypeScript source of the PreCompact hook.
- `dist/hook.mjs` — the self-contained bundle produced by `npm run build`
  (ignored by git until the packaging change starts committing it).
- `kimi.plugin.json` — placeholder manifest; the real one lands with the
  `kimi-plugin-packaging` change.

Configuration and diagnostics documentation lands with the `jev-hook-script`
change.
