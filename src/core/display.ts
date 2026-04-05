/**
 * Message display formatting for tmesh.
 *
 * Both sides of a conversation see formatted messages:
 *   Outbound: [tmesh 2026-04-05 14:27:08] --> nano-research: message  (delivered)
 *   Inbound:  [tmesh 2026-04-05 14:27:08] <-- tmesh-hq [command]: message
 *   With ch:  [tmesh 2026-04-05 14:27:08] <-- tmesh-hq [event] #deploys: message
 *
 * Same [tmesh timestamp] prefix everywhere. Arrows show direction.
 *
 * Zero dependencies -- pure TypeScript.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutboundDisplay {
  readonly target: string;
  readonly content: string;
  readonly timestamp: string;
  readonly status: string;
  readonly channel?: string;
}

export interface InboundDisplay {
  readonly sender: string;
  readonly content: string;
  readonly timestamp: string;
  readonly type: string;
  readonly channel?: string;
}

export interface ParsedLogLine {
  readonly direction: 'in' | 'out';
  readonly peer: string;
  readonly channel?: string;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

function formatChannel(channel: string | undefined): string {
  if (channel === undefined || channel === 'default') return '';
  return ` #${channel}`;
}

/**
 * Outbound (what you see when YOU send):
 *   [tmesh 2026-04-05 14:27:08] --> nano-research: message  (delivered)
 *   [tmesh 2026-04-05 14:27:08] --> nano-research #deploys: message  (delivered)
 */
export function formatOutbound(msg: OutboundDisplay): string {
  const ts = formatTimestamp(msg.timestamp);
  const ch = formatChannel(msg.channel);
  return `[tmesh ${ts}] --> ${msg.target}${ch}: ${msg.content}  (${msg.status})`;
}

/**
 * Inbound (what you see when you RECEIVE):
 *   [tmesh 2026-04-05 14:27:08] <-- tmesh-hq [command]: message
 *   [tmesh 2026-04-05 14:27:08] <-- tmesh-hq [event] #deploys: message
 */
export function formatInbound(msg: InboundDisplay): string {
  const ts = formatTimestamp(msg.timestamp);
  const ch = formatChannel(msg.channel);
  return `[tmesh ${ts}] <-- ${msg.sender} [${msg.type}]${ch}: ${msg.content}`;
}

// ---------------------------------------------------------------------------
// Parsing (for structured filtering)
// ---------------------------------------------------------------------------

const OUTBOUND_RE = /^\[tmesh [^\]]+\] --> ([^\s#:]+)/;
const INBOUND_RE = /^\[tmesh [^\]]+\] <-- ([^\s\[]+)/;
const CHANNEL_RE = /#([a-zA-Z0-9._-]+)/;

/**
 * Parse a log line to extract direction, peer, and optional channel.
 * Returns null if the line doesn't match the tmesh log format.
 */
export function parseLogLine(line: string): ParsedLogLine | null {
  const outMatch = OUTBOUND_RE.exec(line);
  if (outMatch !== null) {
    const channelMatch = CHANNEL_RE.exec(line);
    return {
      direction: 'out',
      peer: outMatch[1]!,
      channel: channelMatch?.[1],
    };
  }

  const inMatch = INBOUND_RE.exec(line);
  if (inMatch !== null) {
    const channelMatch = CHANNEL_RE.exec(line);
    return {
      direction: 'in',
      peer: inMatch[1]!,
      channel: channelMatch?.[1],
    };
  }

  return null;
}
