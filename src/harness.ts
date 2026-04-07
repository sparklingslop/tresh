// tresh -- harness provider
// Optional harness-specific formatting and delivery behavior.
// tresh works without any harness code -- this just polishes the experience.

import type { Signal } from "./types";

function formatTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19);
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Harness {
  readonly name: string;
  /** Write notifications directly to target's TTY device? */
  readonly ttyPush: boolean;
  /** Auto-acknowledge consumed messages by default? */
  readonly ackByDefault: boolean;
  /** Format sent signal confirmation (shown to sender) */
  sent(signal: Signal): string;
  /** Format received signal (shown to receiver in watch/inbox) */
  received(signal: Signal): string;
  /** Format TTY push notification (only used when ttyPush=true) */
  notification?(signal: Signal): string;
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

const terminal: Harness = {
  name: "terminal",
  ttyPush: true,
  ackByDefault: false,
  sent(s) {
    return `\x1b[36m→ ${s.to}\x1b[0m ${s.body}`;
  },
  received(s) {
    const ts = formatTime(s.ts);
    if (s.type === "ack") {
      return `\x1b[2m✓ ${s.from} [${ts}] ${s.body}\x1b[0m`;
    }
    return `\x1b[33m← ${s.from}\x1b[0m [${ts}] ${s.body}`;
  },
  notification(s) {
    const ts = formatTime(s.ts);
    const from = stripAnsi(s.from);
    const body = stripAnsi(s.body);
    const prefix = s.type === "ack" ? "\x1b[2m✓" : "\x1b[33m←";
    return `\r\n${prefix} ${from} [${ts}] ${body}\x1b[0m\r\n`;
  },
};

const claudeCode: Harness = {
  name: "claude-code",
  ttyPush: false,
  ackByDefault: true,
  sent(s) {
    return `→ ${s.to}: ${s.body}`;
  },
  received(s) {
    const ts = formatTime(s.ts);
    if (s.type === "ack") {
      return `✓ ${s.from} [${ts}] ${s.body}`;
    }
    return `← ${s.from} [${ts}] ${s.body}`;
  },
};

// ---------------------------------------------------------------------------
// Registry & detection
// ---------------------------------------------------------------------------

const registry: Record<string, Harness> = {
  terminal,
  "claude-code": claudeCode,
};

function detect(): Harness {
  const explicit = process.env.TRESH_HARNESS;
  if (explicit && registry[explicit]) return registry[explicit];
  return terminal;
}

let _harness: Harness | undefined;

export function harness(): Harness {
  if (!_harness) _harness = detect();
  return _harness;
}

/** List available harness names */
export function available(): string[] {
  return Object.keys(registry);
}
