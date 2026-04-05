/**
 * Conversation log for tmesh.
 *
 * Append-only log file per node. Both directions in one stream.
 * This is THE view of the conversation — watch tails it.
 *
 *   [tmesh 2026-04-05 14:30:00] --> bob: hello  (sent)
 *   [tmesh 2026-04-05 14:30:05] <-- bob [message]: hey back
 *   [tmesh 2026-04-05 14:30:10] <-- alice [event] #deploys: v1 shipped
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { appendFile, readFile, mkdir, stat, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { formatOutbound, formatInbound } from './display';

const LOG_FILE = 'conversation.log';
const MAX_LOG_BYTES = 1024 * 1024; // 1MB
const MAX_ROTATIONS = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutboundEntry {
  readonly target: string;
  readonly content: string;
  readonly timestamp: string;
  readonly channel?: string;
}

export interface InboundEntry {
  readonly sender: string;
  readonly content: string;
  readonly timestamp: string;
  readonly type: string;
  readonly channel?: string;
}

// ---------------------------------------------------------------------------
// Log rotation
// ---------------------------------------------------------------------------

async function rotateIfNeeded(nodeHome: string): Promise<void> {
  const logPath = join(nodeHome, LOG_FILE);
  try {
    const s = await stat(logPath);
    if (s.size < MAX_LOG_BYTES) return;
  } catch {
    return; // file doesn't exist yet
  }

  // Rotate: .3 -> delete, .2 -> .3, .1 -> .2, current -> .1
  for (let i = MAX_ROTATIONS; i >= 1; i--) {
    const from = i === 1 ? logPath : `${logPath}.${i - 1}`;
    const to = `${logPath}.${i}`;
    try {
      await rename(from, to);
    } catch {
      // source doesn't exist, skip
    }
  }
}

// ---------------------------------------------------------------------------
// Append
// ---------------------------------------------------------------------------

/**
 * Append an outbound (-->) entry to the node's conversation log.
 */
export async function appendOutbound(nodeHome: string, entry: OutboundEntry): Promise<void> {
  await mkdir(nodeHome, { recursive: true });
  await rotateIfNeeded(nodeHome);
  const line = formatOutbound({
    target: entry.target,
    content: entry.content,
    timestamp: entry.timestamp,
    status: 'sent',
    channel: entry.channel,
  });
  await appendFile(join(nodeHome, LOG_FILE), line + '\n', 'utf-8');
}

/**
 * Append an inbound (<--) entry to the node's conversation log.
 */
export async function appendInbound(nodeHome: string, entry: InboundEntry): Promise<void> {
  await mkdir(nodeHome, { recursive: true });
  await rotateIfNeeded(nodeHome);
  const line = formatInbound({
    sender: entry.sender,
    content: entry.content,
    timestamp: entry.timestamp,
    type: entry.type,
    channel: entry.channel,
  });
  await appendFile(join(nodeHome, LOG_FILE), line + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export interface ReadOptions {
  readonly tail?: number;
}

/**
 * Read the conversation log. Returns lines.
 */
export async function readLog(nodeHome: string, options?: ReadOptions): Promise<string[]> {
  const filePath = join(nodeHome, LOG_FILE);
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content.trim().split('\n').filter((l) => l.length > 0);

  if (options?.tail !== undefined && options.tail < lines.length) {
    return lines.slice(-options.tail);
  }

  return lines;
}
