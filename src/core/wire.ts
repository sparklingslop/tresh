/**
 * tmesh wire format -- the protocol for agent-to-agent messages.
 *
 * Single-line, pipe-delimited format designed for tmux send-keys injection.
 * No newlines, no quotes in metadata, no XML. Clean in any terminal.
 *
 * Format:
 *   [tmesh|from:alice|to:bob|type:command|ch:default|id:01K...] Message content here. Reply via: tmesh send alice "your reply"
 *
 * Why this format:
 * - Single line: no \n escaping issues in tmux send-keys
 * - No quotes in header: no \" mangling
 * - Pipe-delimited: easy to parse, impossible to confuse with prose
 * - [tmesh|...] prefix: instantly recognizable by any agent
 * - Reply instruction inline: agent knows exactly how to respond
 *
 * Zero dependencies -- pure TypeScript.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WIRE_PREFIX = '[tmesh ';

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
 * Format a signal into the tmesh wire format for injection.
 *
 * Produces a single clean line with no special characters in the header.
 */
export interface FormatOptions {
  /** Override the tmesh binary path in reply instructions. */
  readonly bin?: string;
}

export function formatWireMessage(msg: WireMessage, options?: FormatOptions): string {
  const maxContent = 280;
  const content = msg.content.length > maxContent
    ? msg.content.slice(0, maxContent - 3) + '...'
    : msg.content;

  const bin = options?.bin ?? 'tmesh';
  const header = `[tmesh from:${msg.from} to:${msg.to} type:${msg.type} ch:${msg.channel} id:${msg.id}]`;

  return `${header} ${content} -- reply via: ${bin} send ${msg.from} "your reply"`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const HEADER_PATTERN = /\[tmesh ([^\]]+)\]/;
const FIELD_PATTERN = /(\w+):(\S+)/g;

/**
 * Parse a tmesh wire message from text.
 * Returns null if the text is not a tmesh wire message.
 */
export function parseWireMessage(text: string): ParsedWireMessage | null {
  const headerMatch = text.match(HEADER_PATTERN);
  if (!headerMatch) return null;

  const headerContent = headerMatch[1]!;
  const fields: Record<string, string> = {};

  for (const match of headerContent.matchAll(FIELD_PATTERN)) {
    fields[match[1]!] = match[2]!;
  }

  if (!fields['from'] || !fields['to'] || !fields['type']) return null;

  // Content is everything after the ] and before " -- reply via:"
  const headerEnd = text.indexOf(']');
  const replyMarker = text.indexOf(' -- reply via:');
  const contentEnd = replyMarker !== -1 ? replyMarker : text.length;
  const content = text.slice(headerEnd + 2, contentEnd).trim();

  return {
    from: fields['from']!,
    to: fields['to']!,
    type: fields['type']!,
    channel: fields['ch'] ?? 'default',
    content,
    id: fields['id'] ?? '',
  };
}
