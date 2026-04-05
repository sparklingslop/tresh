/**
 * Message display formatting for tmesh.
 *
 * ONE format everywhere:
 *   [tmesh YYYY-MM-DD HH:MM:SS] --> nano-research: Status report   (sent)
 *   [tmesh YYYY-MM-DD HH:MM:SS] <-- tmesh-hq: Status report       (received)
 *   [tmesh YYYY-MM-DD HH:MM:SS] tmesh-hq: Status report           (injected into session)
 *
 * Same prefix, same timestamp, same structure. Only the arrow differs.
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
// Shared
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Sender side (after sending):
 *   [tmesh 2026-04-05 14:22:22] --> nano-research: Status report  (delivered + injected)
 */
export function formatOutbound(msg: OutboundDisplay): string {
  const ts = formatTimestamp(msg.timestamp);
  return `[tmesh ${ts}] --> ${msg.target}: ${msg.content}  (${msg.status})`;
}

/**
 * Receiver side (inbox, watch):
 *   [tmesh 2026-04-05 14:22:22] <-- tmesh-hq [command]: Status report
 */
export function formatInbound(msg: InboundDisplay): string {
  const ts = formatTimestamp(msg.timestamp);
  return `[tmesh ${ts}] <-- ${msg.sender} [${msg.type}]: ${msg.content}`;
}
