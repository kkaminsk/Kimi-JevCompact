import type { Message } from 'fast-jev-compaction';

export interface PayloadToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export interface PayloadMessage {
  readonly index: number;
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly origin_kind?: string;
  readonly text: string;
  readonly tool_calls?: readonly PayloadToolCall[];
  readonly tool_call_id?: string;
  readonly is_error: boolean;
  readonly chars: number;
}

export interface MappedMessages {
  readonly messages: Message[];
  readonly idByToolCall: Map<string, string>;
}

export function toLibraryMessages(payloadMessages: readonly PayloadMessage[]): MappedMessages {
  const messages: Message[] = [];
  const idByToolCall = new Map<string, string>();
  const resultIds = new Set<string>();
  for (const message of payloadMessages) {
    if (message.role === 'tool' && message.tool_call_id !== undefined) {
      resultIds.add(message.tool_call_id);
    }
  }
  for (const message of payloadMessages) {
    if (message.role === 'assistant') {
      const toolUses = (message.tool_calls ?? [])
        .filter((call) => resultIds.has(call.id))
        .map((call) => ({
          tool_use_id: call.id,
          tool: call.name,
          input: parseArguments(call.arguments),
        }));
      for (const toolUse of toolUses) {
        idByToolCall.set(`t${idByToolCall.size + 1}`, toolUse.tool_use_id);
      }
      messages.push({ role: 'assistant', text: message.text, toolUses });
      continue;
    }
    if (message.role === 'tool') {
      if (message.tool_call_id === undefined) continue;
      messages.push({
        role: 'user',
        text: '',
        toolUses: [],
        toolResults: [
          { tool_use_id: message.tool_call_id, text: message.text, isError: message.is_error },
        ],
      });
      continue;
    }
    messages.push({ role: 'user', text: message.text, toolUses: [] });
  }
  return { messages, idByToolCall };
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { raw };
  } catch {
    return { raw };
  }
}

export interface PruneOutput {
  readonly dropCalls: string[];
  readonly truncateResults: { readonly toolCallId: string; readonly headChars: number }[];
}

export function toPruneDecision(
  decisions: readonly {
    readonly id: string;
    readonly action: 'keep' | 'drop_result' | 'drop_call';
  }[],
  idByToolCall: ReadonlyMap<string, string>,
  truncateHeadChars: number,
): PruneOutput {
  const dropCalls: string[] = [];
  const truncateResults: { readonly toolCallId: string; readonly headChars: number }[] = [];
  for (const decision of decisions) {
    const toolCallId = idByToolCall.get(decision.id);
    if (toolCallId === undefined) continue;
    if (decision.action === 'drop_call') {
      dropCalls.push(toolCallId);
    } else if (decision.action === 'drop_result') {
      truncateResults.push({ toolCallId, headChars: truncateHeadChars });
    }
  }
  return { dropCalls, truncateResults };
}

export function goalFromPayload(payloadMessages: readonly PayloadMessage[]): string | undefined {
  const texts = payloadMessages
    .filter(
      (message) =>
        message.role === 'user' &&
        (message.origin_kind ?? 'user') === 'user' &&
        message.text.trim().length > 0,
    )
    .map((message) => message.text.trim());
  if (texts.length === 0) return undefined;
  return texts
    .slice(-3)
    .map((text) => (text.length > 500 ? `${text.slice(0, 500)}…` : text))
    .join('\n');
}
