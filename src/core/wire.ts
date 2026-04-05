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
  const time = msg.timestamp.slice(11, 16); // HH:MM from ISO string
  const maxContent = 120;
  const content = msg.content.length > maxContent
    ? msg.content.slice(0, maxContent - 3) + '...'
    : msg.content;

  return `[tmesh ${time}] ${msg.from}: ${content}`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const DISPLAY_PATTERN = /\[tmesh (\d{2}:\d{2})\] (\S+): (.+)/;

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

You are connected to a tmesh mesh -- a tmux-native agent communication network.

## Receiving signals

Signals arrive as messages in your prompt, formatted as:

    [tmesh HH:MM] sender-name: message content

The full signal with metadata is in your inbox as a JSON file at:
~/.tmesh/nodes/{your-identity}/inbox/{signal-id}.json

## Replying

To reply to a signal, use tmesh send:

    tmesh send {sender-name} "your reply message"

Example: if you receive "[tmesh 16:30] tmesh-hq: status check", reply with:

    tmesh send tmesh-hq "All systems nominal. 218 tests passing."

## Commands

    tmesh inbox              List pending signals
    tmesh read {id}          Read a specific signal
    tmesh ack {id}           Acknowledge and delete a signal
    tmesh send {target} ...  Send a signal to another node
    tmesh who                See who is on the mesh

## Identity

Your mesh identity is set via the TMESH_IDENTITY environment variable.
`;
