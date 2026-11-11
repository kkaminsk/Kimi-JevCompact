#!/usr/bin/env node
// Isolation check for the hook bundle:
//   1. plugin/dist/hook.mjs must not import any bare specifier
//      (nothing that requires a node_modules directory at runtime)
//   2. the bundle must run under node with `{}` on stdin and exit 0
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const bundle = resolve('plugin/dist/hook.mjs');

function fail(message) {
  console.error(`check:bundle FAILED: ${message}`);
  process.exit(1);
}

let code;
try {
  code = readFileSync(bundle, 'utf8');
} catch {
  fail(`missing bundle: ${bundle} (run npm run build)`);
}

const specifiers = new Set();
const importPatterns = [
  /(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];
for (const pattern of importPatterns) {
  for (const match of code.matchAll(pattern)) {
    specifiers.add(match[1]);
  }
}
const leaked = [...specifiers].filter(
  (specifier) =>
    !specifier.startsWith('node:') &&
    !specifier.startsWith('./') &&
    !specifier.startsWith('../'),
);
if (leaked.length > 0) {
  fail(`bundle imports bare specifiers (node_modules leak?): ${leaked.join(', ')}`);
}

const dir = mkdtempSync(join(tmpdir(), 'kimi-jevcompact-bundle-'));
try {
  copyFileSync(bundle, join(dir, 'hook.mjs'));
  const run = spawnSync(process.execPath, ['hook.mjs'], {
    cwd: dir,
    input: '{}',
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (run.error) {
    fail(`bundle did not run: ${run.error.message}`);
  }
  if (run.status !== 0) {
    fail(`bundle exited ${run.status}: ${(run.stderr || '').trim()}`);
  }
  if (/Cannot find module/.test(run.stderr || '')) {
    fail(`bundle failed to resolve a module: ${(run.stderr || '').trim()}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('check:bundle ok');
