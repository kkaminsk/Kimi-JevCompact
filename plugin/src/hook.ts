import {
  buildJevRequest,
  compact,
  parseJevResponse,
  reductionRatio,
  type CompactResult,
  type JevAsker,
} from 'fast-jev-compaction';
import { pathToFileURL } from 'node:url';

import { resolveConfig, type HookConfig } from './config';
import { formatDoctorReport, runDoctor } from './doctor';
import { appendLogLine } from './log';
import {
  goalFromPayload,
  toLibraryMessages,
  toPruneDecision,
  type PayloadMessage,
  type PruneOutput,
} from './mapping';

export interface HookPayload {
  readonly messages?: PayloadMessage[];
  readonly instruction?: string;
  readonly session_id?: string;
  readonly trigger?: string;
  readonly token_count?: number;
}

export interface HookOutput {
  readonly stdout: Record<string, unknown>;
}

export interface HookDeps {
  readonly config: HookConfig;
  readonly warnings: readonly string[];
  readonly deadlineMs: number;
  readonly createAsker: (signal: AbortSignal) => JevAsker;
  readonly log: (entry: Record<string, unknown>) => void;
}

export function jevAsker(
  fetchImpl: typeof fetch,
  apiKey: string,
  model: string,
  baseUrl: string,
  signal: AbortSignal,
): JevAsker {
  return {
    ask: async (state, questions) => {
      const request = buildJevRequest({ apiKey, model, baseUrl }, state, questions);
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal,
      });
      return parseJevResponse(response.status, response.ok, await response.text());
    },
  };
}

export function formatNote(result: CompactResult, reduction: number, prune: PruneOutput): string {
  const stats = result.stats;
  const percent = Math.round(reduction * 100);
  return (
    `kept ${stats.messagesAfter}/${stats.messagesBefore} messages, no summary ` +
    `(${percent}% reduction; ${stats.kept} kept, ${stats.resultsDropped} results truncated, ` +
    `${stats.callsDropped} calls dropped; state ~${stats.stateTokens} tokens in ${stats.requests} request(s))`
  );
}

export async function runHook(payload: HookPayload, deps: HookDeps): Promise<HookOutput> {
  const baseLog = {
    session_id: payload.session_id,
    trigger: payload.trigger,
  };
  for (const warning of deps.warnings) {
    deps.log({ ...baseLog, outcome: 'warning', message: warning });
  }

  if (!Array.isArray(payload.messages)) {
    return proceed(
      deps,
      'kimi-jevcompact: Kimi build lacks the PreCompact prune contract (a patched kimi-jev build is required)',
      { ...baseLog, outcome: 'proceed', reason: 'unpatched kimi build' },
    );
  }
  if (deps.config.apiKey === undefined) {
    return proceed(
      deps,
      'kimi-jevcompact: no TypeSafe API key (set TYPESAFE_API_KEY or apiKey in kimi-jevcompact.json)',
      { ...baseLog, outcome: 'proceed', reason: 'no api key' },
    );
  }

  const { messages, idByToolCall } = toLibraryMessages(payload.messages);
  const goal =
    payload.instruction !== undefined && payload.instruction.trim() !== ''
      ? payload.instruction
      : (goalFromPayload(payload.messages) ?? undefined);

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, deps.deadlineMs);
  try {
    const result = await compact(messages, deps.createAsker(controller.signal), {
      goal,
      keepThreshold: deps.config.keepThreshold,
      preserveRecentMessages: deps.config.preserveRecentMessages,
      maxStateTokens: deps.config.maxStateTokens,
      maxRequestTokens: deps.config.maxRequestTokens,
      truncateHeadChars: deps.config.truncateHeadChars,
    });
    const reduction = reductionRatio(result);
    if (controller.signal.aborted) {
      return proceed(deps, 'kimi-jevcompact: Jev scoring timed out; proceeding', {
        ...baseLog,
        outcome: 'proceed',
        reason: 'timeout',
        stats: result.stats,
      });
    }
    if (reduction < deps.config.minReductionRatio) {
      return proceed(
        deps,
        `kimi-jevcompact: estimated reduction ${Math.round(reduction * 100)}% below required ${Math.round(deps.config.minReductionRatio * 100)}%`,
        { ...baseLog, outcome: 'proceed', reason: 'reduction below minimum', stats: result.stats },
      );
    }
    const prune = toPruneDecision(result.decisions, idByToolCall, deps.config.truncateHeadChars);
    if (prune.dropCalls.length === 0 && prune.truncateResults.length === 0) {
      return proceed(deps, 'kimi-jevcompact: nothing worth pruning', {
        ...baseLog,
        outcome: 'proceed',
        reason: 'empty prune',
        stats: result.stats,
      });
    }
    const note = formatNote(result, reduction, prune);
    deps.log({
      ...baseLog,
      outcome: 'prune',
      note,
      stats: result.stats,
      decisions: result.decisions.map((decision) => ({
        id: idByToolCall.get(decision.id) ?? decision.id,
        tool: decision.tool,
        action: decision.action,
        keepCall: decision.keepCall,
        keepResult: decision.keepResult,
        pinned: decision.reason === 'pinned',
      })),
    });
    return {
      stdout: {
        hookSpecificOutput: {
          compactionDecision: 'prune',
          prune: {
            dropCalls: prune.dropCalls,
            truncateResults: prune.truncateResults,
            note,
          },
        },
      },
    };
  } catch (error) {
    if (controller.signal.aborted) {
      return proceed(deps, 'kimi-jevcompact: Jev scoring timed out; proceeding', {
        ...baseLog,
        outcome: 'proceed',
        reason: 'timeout',
      });
    }
    return proceed(
      deps,
      `kimi-jevcompact: Jev scoring failed (${error instanceof Error ? error.message : String(error)})`,
      { ...baseLog, outcome: 'proceed', reason: 'jev error' },
    );
  } finally {
    clearTimeout(timer);
  }
}

function proceed(deps: HookDeps, message: string, logEntry: Record<string, unknown>): HookOutput {
  deps.log(logEntry);
  return {
    stdout: {
      message,
      hookSpecificOutput: { compactionDecision: 'proceed' },
    },
  };
}

async function readStdin(): Promise<string> {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

export interface PostPayload {
  readonly trigger?: string;
  readonly estimated_token_count?: number;
  readonly mode?: string;
  readonly dropped_calls?: number;
  readonly truncated_results?: number;
  readonly session_id?: string;
}

export function runPost(payload: PostPayload, log: (entry: Record<string, unknown>) => void): void {
  log({
    outcome: 'post',
    session_id: payload.session_id,
    trigger: payload.trigger,
    mode: payload.mode,
    dropped_calls: payload.dropped_calls,
    truncated_results: payload.truncated_results,
    estimated_token_count: payload.estimated_token_count,
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const env = process.env;
  if (mode === '--post') {
    let payload: PostPayload = {};
    try {
      payload = JSON.parse(await readStdin()) as PostPayload;
    } catch {
      payload = {};
    }
    runPost(payload, (entry) => appendLogLine(env.KIMI_CODE_HOME, entry));
    return;
  }
  if (mode === '--doctor') {
    const checks = runDoctor(env, process.version);
    process.stdout.write(`${formatDoctorReport(checks)}\n`);
    return;
  }

  let payload: HookPayload = {};
  try {
    payload = JSON.parse(await readStdin()) as HookPayload;
  } catch {
    payload = {};
  }
  const { config, warnings } = resolveConfig(env, env.KIMI_CODE_HOME);
  const timeoutSeconds = Number(env.KIMI_JEVCOMPACT_TIMEOUT_S ?? 120);
  const deadlineMs =
    (Number.isFinite(timeoutSeconds) && timeoutSeconds > 5 ? timeoutSeconds - 5 : 115) * 1000;
  const output = await runHook(payload, {
    config,
    warnings,
    deadlineMs,
    createAsker: (signal) =>
      jevAsker(fetch, config.apiKey ?? '', config.model, config.baseUrl, signal),
    log: (entry) => appendLogLine(env.KIMI_CODE_HOME, entry),
  });
  process.stdout.write(`${JSON.stringify(output.stdout)}\n`);
}

const invokedAsEntry =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsEntry) {
  main()
    .catch(() => {
      process.stdout.write(
        `${JSON.stringify({
          message: 'kimi-jevcompact: unexpected error',
          hookSpecificOutput: { compactionDecision: 'proceed' },
        })}\n`,
      );
    })
    .finally(() => {
      process.exit(0);
    });
}
