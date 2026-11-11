import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveConfig } from './config';

export interface DoctorCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface DoctorInput {
  readonly env: NodeJS.ProcessEnv;
  readonly version: string;
  readonly readFile: (path: string) => string;
  readonly probeWrite: (dir: string) => boolean;
}

const DEFAULT_PROBES: Pick<DoctorInput, 'readFile' | 'probeWrite'> = {
  readFile: (path) => readFileSync(path, 'utf8'),
  probeWrite: (dir) => {
    try {
      mkdirSync(dir, { recursive: true });
      const probe = join(dir, `.doctor-probe-${String(process.pid)}`);
      writeFileSync(probe, 'ok', 'utf8');
      rmSync(probe);
      return true;
    } catch {
      return false;
    }
  },
};

export function runDoctor(env: NodeJS.ProcessEnv, version: string): DoctorCheck[] {
  return runDoctorWith({ env, version, ...DEFAULT_PROBES });
}

export function runDoctorWith(input: DoctorInput): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const major = Number.parseInt(input.version.replace(/^v/, ''), 10);
  checks.push({
    name: 'node',
    ok: Number.isInteger(major) && major >= 20,
    detail: `Node.js ${input.version} on PATH (>= 20 required)`,
  });

  const home = input.env.KIMI_CODE_HOME;
  const { config, warnings } = resolveConfig(input.env, home, input.readFile);
  checks.push({
    name: 'api key',
    ok: config.apiKey !== undefined,
    detail:
      config.apiKey !== undefined
        ? 'TypeSafe API key resolved from environment or kimi-jevcompact.json'
        : 'no TypeSafe API key (set TYPESAFE_API_KEY or apiKey in $KIMI_CODE_HOME/kimi-jevcompact.json)',
  });
  checks.push({
    name: 'config file',
    ok: warnings.every((warning) => !warning.includes('config')),
    detail:
      warnings.length > 0
        ? warnings.join('; ')
        : 'kimi-jevcompact.json parseable or absent',
  });

  if (home === undefined || home.length === 0) {
    checks.push({ name: 'log dir', ok: false, detail: 'KIMI_CODE_HOME is not set' });
  } else {
    const writable = input.probeWrite(join(home, 'logs'));
    checks.push({
      name: 'log dir',
      ok: writable,
      detail: writable ? `writable: ${join(home, 'logs')}` : `not writable: ${join(home, 'logs')}`,
    });
  }

  const marker = home === undefined ? undefined : join(home, 'kimi-jev.version');
  let markerVersion: string | undefined;
  if (marker !== undefined) {
    try {
      const raw = input.readFile(marker).trim();
      if (raw.length > 0) markerVersion = raw;
    } catch {
      markerVersion = undefined;
    }
  }
  checks.push({
    name: 'prune contract',
    ok: markerVersion !== undefined && markerVersion.length > 0,
    detail:
      markerVersion !== undefined && markerVersion.length > 0
        ? `kimi-jev build detected (${markerVersion})`
        : 'stock Kimi build: prune contract missing; install the patched kimi-jev build (see the Kimi-JevCompact repository fork/ directory)',
  });

  checks.push({
    name: 'plugin root',
    ok: input.env.KIMI_PLUGIN_ROOT !== undefined && input.env.KIMI_PLUGIN_ROOT.length > 0,
    detail:
      input.env.KIMI_PLUGIN_ROOT !== undefined && input.env.KIMI_PLUGIN_ROOT.length > 0
        ? `KIMI_PLUGIN_ROOT=${input.env.KIMI_PLUGIN_ROOT}`
        : 'KIMI_PLUGIN_ROOT is not set (run from inside Kimi)',
  });

  return checks;
}

export function formatDoctorReport(checks: readonly DoctorCheck[]): string {
  return checks
    .map((check) => `${check.ok ? 'pass' : 'fail'} ${check.name}: ${check.detail}`)
    .join('\n');
}
