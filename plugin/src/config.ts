import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SYSTEM_ONE_URL } from 'fast-jev-compaction';

export interface HookConfig {
  readonly apiKey: string | undefined;
  readonly keepThreshold: number;
  readonly preserveRecentMessages: number;
  readonly minReductionRatio: number;
  readonly maxStateTokens: number;
  readonly maxRequestTokens: number;
  readonly truncateHeadChars: number;
  readonly model: string;
  readonly baseUrl: string;
}

export const CONFIG_DEFAULTS = {
  keepThreshold: 0.5,
  preserveRecentMessages: 6,
  minReductionRatio: 0.25,
  maxStateTokens: 25_000,
  maxRequestTokens: 30_000,
  truncateHeadChars: 300,
  model: 'jev-latest',
} as const;

export interface ConfigResolution {
  readonly config: HookConfig;
  readonly warnings: string[];
}

type FileShape = Record<string, unknown>;

export function resolveConfig(
  env: NodeJS.ProcessEnv,
  kimiCodeHome: string | undefined,
  readFile: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): ConfigResolution {
  const warnings: string[] = [];
  let file: FileShape | undefined;
  if (kimiCodeHome !== undefined && kimiCodeHome.length > 0) {
    const path = join(kimiCodeHome, 'kimi-jevcompact.json');
    try {
      const parsed: unknown = JSON.parse(readFile(path));
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        file = parsed as FileShape;
      } else {
        warnings.push(`kimi-jevcompact: config file at ${path} is not a JSON object; ignoring it`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
        warnings.push(
          `kimi-jevcompact: could not read config file at ${path} (${errorMessage(error)}); ignoring it`,
        );
      }
    }
  }

  const envNumber = (name: string): number | undefined => {
    const raw = env[name];
    if (raw === undefined || raw.trim() === '') return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      warnings.push(`kimi-jevcompact: ${name}="${raw}" is not a finite number; ignoring it`);
      return undefined;
    }
    return value;
  };
  const fileNumber = (key: string): number | undefined => {
    const raw = file?.[key];
    if (raw === undefined) return undefined;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      warnings.push(`kimi-jevcompact: config key "${key}" is not a finite number; ignoring it`);
      return undefined;
    }
    return raw;
  };
  const ratio = (
    envName: string,
    fileKey: string,
    defaultValue: number,
  ): number => {
    const value = envNumber(envName) ?? fileNumber(fileKey) ?? defaultValue;
    if (value < 0 || value > 1) {
      warnings.push(
        `kimi-jevcompact: ${fileKey} must be within [0, 1] (got ${String(value)}); using ${String(defaultValue)}`,
      );
      return defaultValue;
    }
    return value;
  };
  const count = (
    envName: string,
    fileKey: string,
    defaultValue: number,
    minimum: number,
  ): number => {
    const value = envNumber(envName) ?? fileNumber(fileKey) ?? defaultValue;
    if (value < minimum) {
      warnings.push(
        `kimi-jevcompact: ${fileKey} must be at least ${String(minimum)} (got ${String(value)}); using ${String(defaultValue)}`,
      );
      return defaultValue;
    }
    return value;
  };
  const text = (envName: string, fileKey: string, defaultValue: string): string => {
    const fromEnv = env[envName];
    if (fromEnv !== undefined && fromEnv.trim() !== '') return fromEnv;
    const fromFile = file?.[fileKey];
    if (typeof fromFile === 'string' && fromFile.trim() !== '') return fromFile;
    return defaultValue;
  };

  const apiKey = nonEmpty(env.TYPESAFE_API_KEY) ?? nonEmpty(file?.apiKey);

  return {
    config: {
      apiKey,
      keepThreshold: ratio('KIMI_JEVCOMPACT_KEEP_THRESHOLD', 'keepThreshold', CONFIG_DEFAULTS.keepThreshold),
      preserveRecentMessages: Math.floor(
        count(
          'KIMI_JEVCOMPACT_PRESERVE_RECENT',
          'preserveRecentMessages',
          CONFIG_DEFAULTS.preserveRecentMessages,
          0,
        ),
      ),
      minReductionRatio: ratio(
        'KIMI_JEVCOMPACT_MIN_REDUCTION',
        'minReductionRatio',
        CONFIG_DEFAULTS.minReductionRatio,
      ),
      maxStateTokens: count('KIMI_JEVCOMPACT_MAX_STATE_TOKENS', 'maxStateTokens', CONFIG_DEFAULTS.maxStateTokens, 1),
      maxRequestTokens: count(
        'KIMI_JEVCOMPACT_MAX_REQUEST_TOKENS',
        'maxRequestTokens',
        CONFIG_DEFAULTS.maxRequestTokens,
        1,
      ),
      truncateHeadChars: Math.floor(
        count('KIMI_JEVCOMPACT_TRUNCATE_HEAD_CHARS', 'truncateHeadChars', CONFIG_DEFAULTS.truncateHeadChars, 0),
      ),
      model: text('KIMI_JEVCOMPACT_MODEL', 'model', CONFIG_DEFAULTS.model),
      baseUrl: text('KIMI_JEVCOMPACT_BASE_URL', 'baseUrl', SYSTEM_ONE_URL),
    },
    warnings,
  };
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
