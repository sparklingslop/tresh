/**
 * Message display formatting for tmesh CLI.
 *
 * Consistent format for both sender and receiver sides.
 * Makes the conversation visible in both terminals.
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
 * Format an outbound message (what the SENDER sees after sending).
 *
 *   --> nano-research  2026-04-05 14:19:12  (delivered + injected)
 *       Reply to this via tmesh
 */
export function formatOutbound(msg: OutboundDisplay): string {
  const ts = formatTimestamp(msg.timestamp);
  return [
    `  --> ${msg.target}  ${ts}  (${msg.status})`,
    `      ${msg.content}`,
  ].join('\n');
}

/**
 * Format an inbound message (what the RECEIVER sees in inbox/watch).
 *
 *   <-- tmesh-hq  2026-04-05 14:19:12  [command]
 *       Reply to this via tmesh
 */
export function formatInbound(msg: InboundDisplay): string {
  const ts = formatTimestamp(msg.timestamp);
  return [
    `  <-- ${msg.sender}  ${ts}  [${msg.type}]`,
    `      ${msg.content}`,
  ].join('\n');
}
