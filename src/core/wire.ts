/**
 * tmesh wire format — the protocol for agent-to-agent messages.
 *
 * When tmesh injects a message into a live agent session, it uses this
 * structured format so that:
 * 1. The receiving agent KNOWS this is a tmesh signal (not user input)
 * 2. The receiving agent knows WHO sent it
 * 3. The receiving agent knows HOW TO REPLY (exact tmesh command)
 * 4. Any harness (Claude Code, Cursor, Aider, etc.) can parse it
 *
 * Wire format uses XML-like tags because LLM agents parse them natively.
 *
 * Zero dependencies -- pure TypeScript.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WIRE_PREFIX = '<tmesh-signal';
export const WIRE_SUFFIX = '</tmesh-signal>';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WireMessage {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly channel: string;
  readonly content: string;
}

export interface ParsedWireMessage {
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly channel: string;
  readonly content: string;
  readonly id: string;
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/**
 * Format a signal into the tmesh wire format for injection into an agent session.
 *
 * The format is designed to be:
 * - Recognizable by any LLM agent (XML-like tags)
 * - Self-documenting (includes reply instructions)
 * - Short enough for tmux send-keys (max ~400 chars)
 * - Parseable back into structured data
 */
export function formatWireMessage(msg: WireMessage): string {
  // Truncate content for injection (tmux send-keys has practical limits)
  const maxContent = 280;
  const content = msg.content.length > maxContent
    ? msg.content.slice(0, maxContent - 3) + '...'
    : msg.content;

  return [
    `${WIRE_PREFIX} from="${msg.from}" to="${msg.to}" type="${msg.type}" channel="${msg.channel}" id="${msg.id}">`,
    content,
    `To reply: tmesh send ${msg.from} "your reply"`,
    WIRE_SUFFIX,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const ATTR_PATTERN = /(\w+)="([^"]*)"/g;

/**
 * Parse a tmesh wire message from text.
 * Returns null if the text is not a tmesh wire message.
 */
export function parseWireMessage(text: string): ParsedWireMessage | null {
  if (!text.includes(WIRE_PREFIX)) return null;

  // Extract opening tag
  const tagStart = text.indexOf(WIRE_PREFIX);
  const tagEnd = text.indexOf('>', tagStart);
  if (tagEnd === -1) return null;

  const openTag = text.slice(tagStart, tagEnd + 1);

  // Parse attributes
  const attrs: Record<string, string> = {};
  for (const match of openTag.matchAll(ATTR_PATTERN)) {
    attrs[match[1]!] = match[2]!;
  }

  if (!attrs['from'] || !attrs['to'] || !attrs['type']) return null;

  // Extract content (between opening tag and "To reply:" line or closing tag)
  const contentStart = tagEnd + 1;
  const replyLine = text.indexOf('To reply:', contentStart);
  const closingTag = text.indexOf(WIRE_SUFFIX, contentStart);
  const contentEnd = replyLine !== -1 ? replyLine : (closingTag !== -1 ? closingTag : text.length);

  const content = text.slice(contentStart, contentEnd).trim();

  return {
    from: attrs['from']!,
    to: attrs['to']!,
    type: attrs['type']!,
    channel: attrs['channel'] ?? 'default',
    content,
    id: attrs['id'] ?? '',
  };
}
