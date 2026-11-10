import { defineConfig } from 'tsdown';

// One self-contained ESM file, runnable under Node 20+ with no node_modules.
// fast-jev-compaction (which has no runtime dependencies of its own) is
// inlined; nothing external may remain except node: builtins.
export default defineConfig({
  entry: ['plugin/src/hook.ts'],
  outDir: 'plugin/dist',
  format: ['esm'],
  platform: 'node',
  minify: true,
  sourcemap: false,
  dts: false,
  outExtensions: () => ({ js: '.mjs' }),
  deps: {
    alwaysBundle: ['fast-jev-compaction'],
    onlyBundle: ['fast-jev-compaction'],
  },
});
