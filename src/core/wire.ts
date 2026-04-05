/**
 * tmesh wire format -- protocol and display layers.
 *
 * PROTOCOL: JSON signal files in ~/.tmesh/nodes/{id}/inbox/ (full metadata).
 * DISPLAY: Short, timestamped notification injected into agent sessions.
 * CONVENTION: ~/.tmesh/PROTOCOL.md tells agents how to reply (loaded once).
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
  readonly timestamp: string;
}

export interface ParsedWireMessage {
  readonly from: string;
  readonly time: string;
  readonly content: string;
}

// ---------------------------------------------------------------------------
// Display format
// ---------------------------------------------------------------------------

export const WIRE_PREFIX = '[tmesh';

/**
 * Format a signal for injection into an agent session.
 *
 * Clean, timestamped, chat-like. Fits on 1-2 lines of an 80-char pane.
 * No reply instructions -- those live in ~/.tmesh/PROTOCOL.md.
 *
 * Short:  [tmesh 16:30] tmesh-hq: What is your cycle count?
 * Long:   [tmesh 16:30] tmesh-hq: This is a longer message that gets trun...
 */
export function formatWireMessage(msg: WireMessage): string {
  const date = msg.timestamp.slice(0, 10);   // YYYY-MM-DD
  const time = msg.timestamp.slice(11, 19);  // HH:MM:SS
  const maxContent = 120;
  const content = msg.content.length > maxContent
    ? msg.content.slice(0, maxContent - 3) + '...'
    : msg.content;

  return `[tmesh ${date} ${time}] <-- ${msg.from}: ${content}`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const DISPLAY_PATTERN = /\[tmesh (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] <-- (\S+): (.+)/;

/**
 * Parse a tmesh display message. Returns null if not a tmesh message.
 */
export function parseWireMessage(text: string): ParsedWireMessage | null {
  const match = text.match(DISPLAY_PATTERN);
  if (!match) return null;
  return { time: match[1]!, from: match[2]!, content: match[3]! };
}

// ---------------------------------------------------------------------------
// Protocol file
// ---------------------------------------------------------------------------

/**
 * The tmesh protocol document. Dropped into ~/.tmesh/PROTOCOL.md on first use.
 * Any agent on the mesh reads this once to learn the conventions.
 */
export const PROTOCOL_MD = `# tmesh protocol

You are on a tmesh mesh -- a tmux-native agent communication network.

## Message format

Incoming signals appear in your prompt as:

    [tmesh YYYY-MM-DD HH:MM:SS] <-- sender: message content

When you send, the output looks like:

    [tmesh YYYY-MM-DD HH:MM:SS] --> target: your message  (delivered)

## Replying

To reply to a signal, run tmesh send and THEN echo the formatted line as your text response:

    tmesh send {sender} "your reply"

IMPORTANT: After sending, always output the tmesh line from the send output
as your own text response so it appears in the conversation. Example:

    [tmesh 2026-04-05 14:50:05] --> tmesh-hq: All systems nominal.  (delivered)

This ensures both incoming and outgoing messages are visible in the conversation.

## Commands

    tmesh inbox              List pending signals
    tmesh read {id}          Read a specific signal
    tmesh ack {id}           Acknowledge and delete a signal
    tmesh send {target} ...  Send a signal to another node
    tmesh message {target} . Send with injection + notification
    tmesh who                See who is on the mesh

## Identity

Your mesh identity is set via the TMESH_IDENTITY environment variable.
`;
