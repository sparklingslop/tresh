/**
 * Message display formatting for tmesh.
 *
 * Both sides of a conversation see formatted messages:
 *   Outbound: [tmesh 2026-04-05 14:27:08] --> nano-research: message  (delivered)
 *   Inbound:  [tmesh 2026-04-05 14:27:08] <-- tmesh-hq [command]: message
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
}

export interface InboundDisplay {
  readonly sender: string;
  readonly content: string;
  readonly timestamp: string;
  readonly type: string;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

/**
 * Outbound (what you see when YOU send):
 *   [tmesh 2026-04-05 14:27:08] --> nano-research: message  (delivered + injected)
 */
export function formatOutbound(msg: OutboundDisplay): string {
  const ts = formatTimestamp(msg.timestamp);
  return `[tmesh ${ts}] --> ${msg.target}: ${msg.content}  (${msg.status})`;
}

/**
 * Inbound (what you see when you RECEIVE):
 *   [tmesh 2026-04-05 14:27:08] <-- tmesh-hq [command]: message
 */
export function formatInbound(msg: InboundDisplay): string {
  const ts = formatTimestamp(msg.timestamp);
  return `[tmesh ${ts}] <-- ${msg.sender} [${msg.type}]: ${msg.content}`;
}
