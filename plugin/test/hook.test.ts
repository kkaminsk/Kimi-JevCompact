import { describe, expect, it } from 'vitest';

import type { JevAsker, JevQuestions, JevState } from 'fast-jev-compaction';

import { resolveConfig } from '../src/config';
import { formatNote, runHook, type HookDeps, type HookPayload } from '../src/hook';
import type { PayloadMessage } from '../src/mapping';

function user(text: string): PayloadMessage {
  return { index: 0, role: 'user', text, is_error: false, chars: text.length };
}

function assistant(text: string, ...calls: { id: string; arguments: string }[]): PayloadMessage {
  return {
    index: 0,
    role: 'assistant',
    text,
    tool_calls: calls.map((call) => ({ id: call.id, name: 'Read', arguments: call.arguments })),
    is_error: false,
    chars: text.length,
  };
}

function tool(toolCallId: string, text: string): PayloadMessage {
  return {
    index: 0,
    role: 'tool',
    text,
    tool_call_id: toolCallId,
    is_error: false,
    chars: text.length,
  };
}

function fixtureMessages(): PayloadMessage[] {
  const messages: PayloadMessage[] = [
    user('first prompt'),
    assistant('reading both', { id: 'c7', arguments: '{"path":"a"}' }, { id: 'c9', arguments: '{"path":"b"}' }),
    tool('c7', 'contents a '.repeat(200)),
    tool('c9', 'contents b '.repeat(200)),
  ];
  for (let i = 0; i < 8; i += 1) {
    messages.push(user(`filler question ${i}`), assistant(`filler answer ${i}`));
  }
  messages.push(user('last prompt'), assistant('final answer'));
  return messages;
}

function fakeAsker(
  scores: Record<string, number>,
  seen: { goal?: string; calls: number } = { calls: 0 },
): JevAsker {
  return {
    ask: async (state: JevState, questions: JevQuestions) => {
      seen.goal = (state as { goal?: string }).goal;
      seen.calls += 1;
      return {
        answers: Object.fromEntries(
          Object.keys(questions).map((name) => [name, { noul: scores[name] ?? 0.99 }]),
        ),
      };
    },
  };
}

interface Harness {
  readonly deps: HookDeps;
  readonly logEntries: Record<string, unknown>[];
}

function makeHarness(
  asker: JevAsker | ((signal: AbortSignal) => JevAsker),
  env: NodeJS.ProcessEnv = { TYPESAFE_API_KEY: 'test-key' },
): Harness {
  const logEntries: Record<string, unknown>[] = [];
  const { config, warnings } = resolveConfig(env, undefined, () => {
    throw new Error('ENOENT');
  });
  const deps: HookDeps = {
    config,
    warnings,
    deadlineMs: 5_000,
    createAsker: typeof asker === 'function' ? asker : () => asker,
    log: (entry) => {
      logEntries.push(entry);
    },
  };
  return { deps, logEntries };
}

describe('runHook', () => {
  it('prints a prune decision mapped back to Kimi tool call ids', async () => {
    const scores = {
      call_t1: 0.7,
      result_t1: 0.2,
      call_t2: 0.2,
      result_t2: 0.2,
    };
    const { deps, logEntries } = makeHarness(fakeAsker(scores));

    const output = await runHook(
      { messages: fixtureMessages(), session_id: 's1', trigger: 'manual' },
      deps,
    );

    const specific = output.stdout['hookSpecificOutput'] as {
      compactionDecision: string;
      prune?: { dropCalls: string[]; truncateResults: { toolCallId: string; headChars: number }[]; note: string };
    };
    expect(specific.compactionDecision).toBe('prune');
    expect(specific.prune?.dropCalls).toEqual(['c9']);
    expect(specific.prune?.truncateResults).toEqual([{ toolCallId: 'c7', headChars: 300 }]);
    expect(specific.prune?.note).toMatch(/^kept \d+\/\d+ messages, no summary \(\d+% reduction/);
    const lastLog = logEntries.at(-1);
    expect(lastLog).toMatchObject({ outcome: 'prune', session_id: 's1', trigger: 'manual' });
    expect(lastLog).toHaveProperty('decisions');
  });

  it('proceeds with the exact no-key message when no key is configured', async () => {
    const { deps } = makeHarness(fakeAsker({}), {});
    const output = await runHook({ messages: fixtureMessages() }, deps);

    expect(output.stdout).toEqual({
      message: 'kimi-jevcompact: no TypeSafe API key (set TYPESAFE_API_KEY or apiKey in kimi-jevcompact.json)',
      hookSpecificOutput: { compactionDecision: 'proceed' },
    });
  });

  it('proceeds when the estimated reduction is below the minimum', async () => {
    const keepEverything = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`q${i}`, 0.99]),
    );
    const { deps } = makeHarness(fakeAsker(keepEverything));
    const output = await runHook({ messages: fixtureMessages() }, deps);

    const message = String(output.stdout['message']);
    expect(message).toContain('below required 25%');
    expect((output.stdout['hookSpecificOutput'] as { compactionDecision: string }).compactionDecision).toBe('proceed');
  });

  it('proceeds when Jev fails', async () => {
    const failing: JevAsker = {
      ask: async () => {
        throw new Error('HTTP 500');
      },
    };
    const { deps } = makeHarness(failing);
    const output = await runHook({ messages: fixtureMessages() }, deps);

    expect(String(output.stdout['message'])).toContain('Jev scoring failed (HTTP 500)');
  });

  it('proceeds without contacting Jev when the payload lacks messages', async () => {
    let asked = 0;
    const counting: JevAsker = {
      ask: async () => {
        asked += 1;
        return { answers: {} };
      },
    };
    const { deps } = makeHarness(counting);

    const output = await runHook({ trigger: 'auto' }, deps);

    expect(asked).toBe(0);
    expect(String(output.stdout['message'])).toContain('lacks the PreCompact prune contract');
  });

  it('proceeds when the internal deadline passes', async () => {
    const slow = (signal: AbortSignal): JevAsker => ({
      ask: () =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    });
    const { deps } = makeHarness(slow);
    const shorter: HookDeps = { ...deps, deadlineMs: 30 };

    const output = await runHook({ messages: fixtureMessages() }, shorter);
    expect(String(output.stdout['message'])).toContain('timed out');
  });

  it('forwards the /compact instruction as the Jev goal', async () => {
    const seen: { goal?: string } = {};
    const asker: JevAsker = {
      ask: async (state) => {
        seen.goal = (state as { goal?: string }).goal;
        return { answers: {} };
      },
    };
    const { deps } = makeHarness(asker);
    await runHook({ messages: fixtureMessages(), instruction: 'keep the API notes' }, deps);
    expect(seen.goal).toBe('keep the API notes');
  });

  it('defaults the goal to the recent user prompts', async () => {
    const seen: { goal?: string } = {};
    const asker: JevAsker = {
      ask: async (state) => {
        seen.goal = (state as { goal?: string }).goal;
        return { answers: {} };
      },
    };
    const { deps } = makeHarness(asker);
    await runHook({ messages: fixtureMessages() }, deps);
    expect(seen.goal).toContain('last prompt');
    expect(seen.goal).not.toContain('contents a');
  });
});

describe('formatNote', () => {
  it('matches the scenario string exactly', () => {
    const note = formatNote(
      {
        messages: [],
        decisions: [],
        stats: {
          messagesBefore: 58,
          messagesAfter: 41,
          charsBefore: 100_000,
          charsAfter: 56_000,
          calls: 20,
          kept: 17,
          resultsDropped: 2,
          callsDropped: 1,
          pinned: 3,
          stateTokens: 12_000,
          stateStage: 'full',
          requests: 2,
          ms: 900,
        },
      },
      0.44,
      { dropCalls: ['c9'], truncateResults: [{ toolCallId: 'c7', headChars: 300 }] },
    );

    expect(note).toBe(
      'kept 41/58 messages, no summary (44% reduction; 17 kept, 2 results truncated, 1 calls dropped; state ~12000 tokens in 2 request(s))',
    );
  });
});
