import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const LOG_FILE_NAME = 'kimi-jevcompact.jsonl';

export function appendLogLine(kimiCodeHome: string | undefined, entry: Record<string, unknown>): void {
  try {
    if (kimiCodeHome === undefined || kimiCodeHome.length === 0) return;
    const dir = join(kimiCodeHome, 'logs');
    mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
    appendFileSync(join(dir, LOG_FILE_NAME), `${line}\n`, 'utf8');
  } catch {
    // Diagnostics must never change the decision or crash the hook.
  }
}
