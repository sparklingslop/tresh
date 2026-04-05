/**
 * tmesh wire format -- protocol and display layers.
 *
 * PROTOCOL: JSON signal files on disk (TmeshSignal).
 *   Complete metadata. Handled by transport.ts.
 *
 * DISPLAY: Short text injected into agent sessions.
 *   Designed for tmux panes (80-120 chars wide).
 *   Shows: who sent it, brief preview, how to read more, how to reply.
 *   Full content is in the inbox -- use `tmesh read <id>`.
 *
 * Zero dependencies -- pure TypeScript.
 */

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
  readonly content: string;
}

// ---------------------------------------------------------------------------
// Display format
// ---------------------------------------------------------------------------

export const WIRE_PREFIX = '[tmesh';

/**
 * Format a signal for injection into an agent session.
 *
 * Short enough to fit on ~2 lines of an 80-char tmux pane.
 * Full content is in the inbox -- this is just the notification.
 *
 * Result (short messages):
 *   [tmesh from tmesh-hq] Deploy complete. Reply: tmesh send tmesh-hq ...
 *
 * Result (long messages):
 *   [tmesh from tmesh-hq] Deploy compl... Read: tmesh read 01K... Reply: tmesh send tmesh-hq ...
 */
export function formatWireMessage(msg: WireMessage): string {
  const maxPreview = 80;
  const preview = msg.content.length > maxPreview
    ? msg.content.slice(0, maxPreview - 3) + '...'
    : msg.content;

  const parts = [`[tmesh from ${msg.from}] ${preview}`];

  // If content was truncated, tell agent how to read the full message
  if (msg.content.length > maxPreview) {
    parts.push(`Read: tmesh read ${msg.id}`);
  }

  parts.push(`Reply: tmesh send ${msg.from} ...`);

  return parts.join(' -- ');
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const DISPLAY_PATTERN = /\[tmesh from (\S+)\]\s+(.+?)(?:\s+--|\s*$)/;

/**
 * Parse a tmesh display message. Returns null if not a tmesh message.
 */
export function parseWireMessage(text: string): ParsedWireMessage | null {
  const match = text.match(DISPLAY_PATTERN);
  if (!match) return null;
  return { from: match[1]!, content: match[2]! };
}
