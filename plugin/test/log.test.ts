import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { appendLogLine, LOG_FILE_NAME } from '../src/log';

let dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('appendLogLine', () => {
  it('appends one JSON line per entry under $KIMI_CODE_HOME/logs', () => {
    const home = mkdtempSync(join(tmpdir(), 'kimi-jevcompact-log-'));
    dirs.push(home);

    appendLogLine(home, { outcome: 'prune', note: 'kept 2/4' });
    appendLogLine(home, { outcome: 'proceed', reason: 'no api key' });

    const lines = readFileSync(join(home, 'logs', LOG_FILE_NAME), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ outcome: 'prune', note: 'kept 2/4' });
    expect(typeof lines[0]?.timestamp).toBe('string');
    expect(lines[1]).toMatchObject({ outcome: 'proceed', reason: 'no api key' });
  });

  it('swallows write errors on unwritable paths', () => {
    expect(() => appendLogLine('/nonexistent-root/home', { outcome: 'prune' })).not.toThrow();
    expect(() => appendLogLine(undefined, { outcome: 'prune' })).not.toThrow();
  });
});
