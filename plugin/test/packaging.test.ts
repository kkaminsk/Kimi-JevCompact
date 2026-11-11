import { describe, expect, it } from 'vitest';

import { runDoctorWith, type DoctorInput } from '../src/doctor';
import { runPost } from '../src/hook';

function doctorInput(overrides: Partial<DoctorInput> = {}): DoctorInput {
  return {
    env: {
      TYPESAFE_API_KEY: 'key',
      KIMI_CODE_HOME: '/tmp/kimi-home',
      KIMI_PLUGIN_ROOT: '/tmp/plugin',
    },
    version: 'v24.19.0',
    readFile: (path) => {
      if (path.endsWith('kimi-jev.version')) return '2.1.1+jev.1\n';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    },
    probeWrite: () => true,
    ...overrides,
  };
}

function check(input: DoctorInput, name: string) {
  const result = runDoctorWith(input).find((entry) => entry.name === name);
  if (result === undefined) throw new Error(`check ${name} not found`);
  return result;
}

describe('runDoctorWith', () => {
  it('passes every check in a healthy setup', () => {
    const checks = runDoctorWith(doctorInput());
    expect(checks.map((entry) => entry.name)).toEqual([
      'node',
      'api key',
      'config file',
      'log dir',
      'prune contract',
      'plugin root',
    ]);
    expect(checks.every((entry) => entry.ok)).toBe(true);
  });

  it('fails the node check below version 20', () => {
    expect(check(doctorInput({ version: 'v18.20.0' }), 'node').ok).toBe(false);
    expect(check(doctorInput({ version: 'v20.0.0' }), 'node').ok).toBe(true);
  });

  it('fails the key check without a key and names both fixes', () => {
    const result = check(doctorInput({ env: { KIMI_CODE_HOME: '/tmp/kimi-home' } }), 'api key');
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('TYPESAFE_API_KEY');
    expect(result.detail).toContain('kimi-jevcompact.json');
  });

  it('fails the config check on malformed config', () => {
    const result = check(
      doctorInput({
        readFile: () => {
          throw new Error('unexpected token');
        },
      }),
      'config file',
    );
    expect(result.ok).toBe(false);
  });

  it('fails the log dir check when the probe write fails', () => {
    expect(check(doctorInput({ probeWrite: () => false }), 'log dir').ok).toBe(false);
  });

  it('fails the prune-contract check under stock Kimi', () => {
    const result = check(doctorInput(), 'prune contract');
    expect(result.ok).toBe(true);

    const stock = check(
      doctorInput({
        readFile: () => {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        },
      }),
      'prune contract',
    );
    expect(stock.ok).toBe(false);
    expect(stock.detail).toContain('kimi-jev');
  });

  it('fails the plugin root check outside Kimi', () => {
    const result = check(
      doctorInput({ env: { TYPESAFE_API_KEY: 'key', KIMI_CODE_HOME: '/tmp/home' } }),
      'plugin root',
    );
    expect(result.ok).toBe(false);
  });
});

describe('runPost', () => {
  it('appends the PostCompact outcome to the diagnostics log', () => {
    const entries: Record<string, unknown>[] = [];
    runPost(
      {
        trigger: 'manual',
        mode: 'prune',
        dropped_calls: 12,
        truncated_results: 5,
        estimated_token_count: 40_000,
        session_id: 's1',
      },
      (entry) => entries.push(entry),
    );

    expect(entries).toEqual([
      {
        outcome: 'post',
        session_id: 's1',
        trigger: 'manual',
        mode: 'prune',
        dropped_calls: 12,
        truncated_results: 5,
        estimated_token_count: 40_000,
      },
    ]);
  });
});
