/**
 * Conversation log for tmesh.
 *
 * Append-only log file per node. Both directions in one stream.
 * This is THE view of the conversation — watch tails it.
 *
 *   [tmesh 2026-04-05 14:30:00] --> bob: hello
 *   [tmesh 2026-04-05 14:30:05] <-- bob [message]: hey back
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { formatOutbound, formatInbound } from './display';

const LOG_FILE = 'conversation.log';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutboundEntry {
  readonly target: string;
  readonly content: string;
  readonly timestamp: string;
}

export interface InboundEntry {
  readonly sender: string;
  readonly content: string;
  readonly timestamp: string;
  readonly type: string;
}

// ---------------------------------------------------------------------------
// Append
// ---------------------------------------------------------------------------

/**
 * Append an outbound (-->) entry to the node's conversation log.
 */
export async function appendOutbound(nodeHome: string, entry: OutboundEntry): Promise<void> {
  await mkdir(nodeHome, { recursive: true });
  const line = formatOutbound({
    target: entry.target,
    content: entry.content,
    timestamp: entry.timestamp,
    status: 'sent',
  });
  await appendFile(join(nodeHome, LOG_FILE), line + '\n', 'utf-8');
}

/**
 * Append an inbound (<--) entry to the node's conversation log.
 */
export async function appendInbound(nodeHome: string, entry: InboundEntry): Promise<void> {
  await mkdir(nodeHome, { recursive: true });
  const line = formatInbound({
    sender: entry.sender,
    content: entry.content,
    timestamp: entry.timestamp,
    type: entry.type,
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
