import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CONFIG_DEFAULTS, resolveConfig } from '../src/config';

const cleanEnv = {};

let dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function withConfigFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'kimi-jevcompact-config-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'kimi-jevcompact.json'), content, 'utf8');
  return dir;
}

describe('resolveConfig', () => {
  it('returns defaults when no file and no env are present', () => {
    const { config, warnings } = resolveConfig(cleanEnv, undefined, () => {
      throw new Error('ENOENT');
    });

    expect(config).toEqual({
      apiKey: undefined,
      keepThreshold: CONFIG_DEFAULTS.keepThreshold,
      preserveRecentMessages: CONFIG_DEFAULTS.preserveRecentMessages,
      minReductionRatio: CONFIG_DEFAULTS.minReductionRatio,
      maxStateTokens: CONFIG_DEFAULTS.maxStateTokens,
      maxRequestTokens: CONFIG_DEFAULTS.maxRequestTokens,
      truncateHeadChars: CONFIG_DEFAULTS.truncateHeadChars,
      model: CONFIG_DEFAULTS.model,
      baseUrl: expect.stringContaining('api.typesafe.ai'),
    });
    expect(warnings).toEqual([]);
  });

  it('lets the environment override the file', () => {
    const home = withConfigFile(JSON.stringify({ keepThreshold: 0.7, model: 'jev-old' }));
    const { config } = resolveConfig(
      { KIMI_JEVCOMPACT_KEEP_THRESHOLD: '0.4', TYPESAFE_API_KEY: 'env-key' },
      home,
    );

    expect(config.keepThreshold).toBe(0.4);
    expect(config.model).toBe('jev-old');
    expect(config.apiKey).toBe('env-key');
  });

  it('reads the file when the environment is silent', () => {
    const home = withConfigFile(
      JSON.stringify({ apiKey: 'file-key', preserveRecentMessages: 10, truncateHeadChars: 120 }),
    );
    const { config } = resolveConfig(cleanEnv, home);

    expect(config.apiKey).toBe('file-key');
    expect(config.preserveRecentMessages).toBe(10);
    expect(config.truncateHeadChars).toBe(120);
  });

  it('warns and falls back when the file is malformed', () => {
    const home = withConfigFile('{ not json');
    const { config, warnings } = resolveConfig(cleanEnv, home);

    expect(config.keepThreshold).toBe(CONFIG_DEFAULTS.keepThreshold);
    expect(warnings.some((warning) => warning.includes('could not read config file'))).toBe(true);
  });

  it('warns and clamps ratios outside [0, 1]', () => {
    const home = withConfigFile(JSON.stringify({ keepThreshold: 1.5 }));
    const { config, warnings } = resolveConfig(cleanEnv, home);

    expect(config.keepThreshold).toBe(CONFIG_DEFAULTS.keepThreshold);
    expect(warnings.some((warning) => warning.includes('within [0, 1]'))).toBe(true);
  });

  it('warns on non-finite environment numbers', () => {
    const { config, warnings } = resolveConfig(
      { KIMI_JEVCOMPACT_MIN_REDUCTION: 'banana' },
      undefined,
      () => {
        throw new Error('ENOENT');
      },
    );

    expect(config.minReductionRatio).toBe(CONFIG_DEFAULTS.minReductionRatio);
    expect(warnings.some((warning) => warning.includes('KIMI_JEVCOMPACT_MIN_REDUCTION'))).toBe(true);
  });

  it('treats a missing file as fine', () => {
    const { warnings } = resolveConfig(cleanEnv, '/nonexistent/home', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    });
    expect(warnings).toEqual([]);
  });
});
