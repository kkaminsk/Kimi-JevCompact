#!/usr/bin/env node
// Validates the installable plugin shape:
//   1. kimi.plugin.json parses, names the plugin, and matches package.json
//   2. every referenced path (commands, skills, hook command) exists
//   3. hook event names are ones Kimi knows
//   4. dist/hook.mjs exists and is newer than every file under plugin/src
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`could not parse ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

const KNOWN_HOOK_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionResult',
  'UserPromptSubmit',
  'UserPromptQueued',
  'TurnStarted',
  'Stop',
  'StopFailure',
  'Interrupt',
  'SessionStart',
  'SessionEnd',
  'SessionHeartbeat',
  'SubagentStart',
  'SubagentStop',
  'TaskStarted',
  'PreCompact',
  'PostCompact',
  'Notification',
]);

const manifest = readJson(join(root, 'kimi.plugin.json'));
const pkg = readJson(join(root, 'package.json'));

if (manifest !== undefined) {
  if (typeof manifest.name !== 'string' || !/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(manifest.name)) {
    fail(`manifest name "${String(manifest.name)}" is not a valid plugin id`);
  }
  if (pkg !== undefined && manifest.version !== pkg.version) {
    fail(`manifest version ${String(manifest.version)} does not match package.json ${String(pkg.version)}`);
  }
  for (const key of ['commands', 'skills']) {
    const value = manifest[key];
    const paths = Array.isArray(value) ? value : [value];
    for (const entry of paths) {
      if (typeof entry !== 'string' || !existsSync(join(root, entry))) {
        fail(`manifest ${key} points at a missing path: ${String(entry)}`);
      }
    }
  }
  const sessionSkill = manifest.sessionStart?.skill;
  if (typeof sessionSkill !== 'string') {
    fail('manifest sessionStart.skill is missing');
  } else if (!existsSync(join(root, 'skills', sessionSkill, 'SKILL.md'))) {
    fail(`sessionStart skill not found at skills/${sessionSkill}/SKILL.md`);
  }
  for (const hook of manifest.hooks ?? []) {
    if (!KNOWN_HOOK_EVENTS.has(hook.event)) {
      fail(`manifest declares an unknown hook event: ${String(hook.event)}`);
    }
    if (typeof hook.command !== 'string' || !hook.command.includes('./dist/hook.mjs')) {
      fail(`hook command must run ./dist/hook.mjs: ${String(hook.command)}`);
    }
  }
}

const bundlePath = join(root, 'dist', 'hook.mjs');
if (!existsSync(bundlePath)) {
  fail('dist/hook.mjs is missing (run npm run build)');
} else {
  const bundleMtime = statSync(bundlePath).mtimeMs;
  let newest = 0;
  let newestFile = '';
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        walk(path);
      } else if (stat.mtimeMs > newest) {
        newest = stat.mtimeMs;
        newestFile = path;
      }
    }
  };
  walk(join(root, 'plugin', 'src'));
  if (newest > bundleMtime) {
    fail(`dist/hook.mjs is older than ${newestFile} (rebuild with npm run build)`);
  }
}

if (failures.length > 0) {
  console.error('check:plugin FAILED:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('check:plugin ok');
