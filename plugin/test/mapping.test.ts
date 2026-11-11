import { describe, expect, it } from 'vitest';

import { goalFromPayload, toLibraryMessages, toPruneDecision, type PayloadMessage } from '../src/mapping';

function user(text: string, origin_kind?: string): PayloadMessage {
  return {
    index: 0,
    role: 'user',
    origin_kind,
    text,
    is_error: false,
    chars: text.length,
  };
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

describe('toLibraryMessages', () => {
  it('pairs out-of-order results with their own calls', () => {
    const { messages, idByToolCall } = toLibraryMessages([
      user('read both'),
      assistant('doing it', { id: 'c1', arguments: '{"path":"a"}' }, { id: 'c2', arguments: '{"path":"b"}' }),
      tool('c2', 'contents b'),
      tool('c1', 'contents a'),
    ]);

    expect(messages).toHaveLength(4);
    const exchange = messages[1];
    expect(exchange?.toolUses.map((use) => use.tool_use_id)).toEqual(['c1', 'c2']);
    expect(exchange?.toolUses[0]?.input).toEqual({ path: 'a' });
    expect(messages[2]?.toolResults?.[0]?.tool_use_id).toBe('c2');
    expect(messages[3]?.toolResults?.[0]?.tool_use_id).toBe('c1');
    expect([...idByToolCall.values()]).toEqual(['c1', 'c2']);
  });

  it('ignores a result whose call does not exist when pairing', () => {
    const { messages } = toLibraryMessages([
      user('hi'),
      assistant('', { id: 'c1', arguments: '{}' }),
      tool('orphan', 'lost result'),
      tool('c1', 'result'),
    ]);

    expect(messages[1]?.toolUses).toHaveLength(1);
    expect(messages[1]?.toolUses[0]?.tool_use_id).toBe('c1');
    expect(messages.filter((message) => (message.toolResults ?? []).length > 0)).toHaveLength(2);
  });

  it('passes non-JSON argument strings through as a raw input', () => {
    const { messages } = toLibraryMessages([
      assistant('', { id: 'c1', arguments: 'not json at all' }),
      tool('c1', 'result'),
    ]);

    expect(messages[0]?.toolUses[0]?.input).toEqual({ raw: 'not json at all' });
  });

  it('carries assistant text verbatim and flags error results', () => {
    const { messages } = toLibraryMessages([
      assistant('plain answer with "quotes"'),
      tool('c1', 'boom'),
    ]);
    const withError: PayloadMessage = { ...tool('c2', 'boom'), is_error: true };
    const errorMapped = toLibraryMessages([assistant('', { id: 'c2', arguments: '{}' }), withError]);

    expect(messages[0]?.text).toBe('plain answer with "quotes"');
    expect(errorMapped.messages[1]?.toolResults?.[0]?.isError).toBe(true);
  });
});

describe('toPruneDecision', () => {
  it('maps the mixed decision scenario back to Kimi tool call ids', () => {
    const output = toPruneDecision(
      [
        { id: 't1', action: 'keep' },
        { id: 't2', action: 'drop_result' },
        { id: 't3', action: 'drop_call' },
      ],
      new Map([
        ['t1', 'c7'],
        ['t2', 'c7'],
        ['t3', 'c9'],
      ]),
      300,
    );

    expect(output).toEqual({
      dropCalls: ['c9'],
      truncateResults: [{ toolCallId: 'c7', headChars: 300 }],
    });
  });

  it('drops decisions whose short id is unknown', () => {
    const output = toPruneDecision([{ id: 't9', action: 'drop_call' }], new Map(), 300);
    expect(output.dropCalls).toEqual([]);
  });
});

describe('goalFromPayload', () => {
  it('uses the last three user-origin prompts', () => {
    const goal = goalFromPayload([
      user('first'),
      user('injected reminder', 'injection'),
      user('second'),
      tool('c1', 'result text'),
      user('third'),
      user('fourth'),
    ]);

    expect(goal).toBe('second\nthird\nfourth');
  });

  it('returns undefined when there is no user prompt', () => {
    expect(goalFromPayload([tool('c1', 'result')])).toBeUndefined();
  });
});
