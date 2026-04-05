/**
 * File-based signal transport for tmesh.
 *
 * Delivers signals as JSON files to target node inboxes.
 * Atomic writes (temp + rename) prevent partial reads.
 * Zero dependencies -- only node:* built-ins.
 */

import { mkdir, readdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

import { Ok, Err } from '../types';
import type { TmeshSignal, Result } from '../types';

// ---------------------------------------------------------------------------
// ensureInbox
// ---------------------------------------------------------------------------

/**
 * Ensure the inbox directory exists under the given home.
 * Creates both home and inbox if missing.
 */
export async function ensureInbox(home: string): Promise<Result<string>> {
  const inboxPath = join(home, 'inbox');
  try {
    await mkdir(inboxPath, { recursive: true });
    return Ok(inboxPath);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Ensure the outbox directory exists under the given home.
 */
async function ensureOutbox(home: string): Promise<Result<string>> {
  const outboxPath = join(home, 'outbox');
  try {
    await mkdir(outboxPath, { recursive: true });
    return Ok(outboxPath);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------------------------------------------------------------------------
// Atomic file write
// ---------------------------------------------------------------------------

/**
 * Write content to a file atomically (temp file + rename).
 */
async function atomicWrite(dir: string, filename: string, content: string): Promise<void> {
  const tmpName = `.${filename}.${randomBytes(4).toString('hex')}.tmp`;
  const tmpPath = join(dir, tmpName);
  const targetPath = join(dir, filename);

  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, targetPath);
}

// ---------------------------------------------------------------------------
// Signal filename
// ---------------------------------------------------------------------------

function signalFilename(signal: TmeshSignal): string {
  return `${signal.id}.json`;
}

// ---------------------------------------------------------------------------
// deliverSignal
// ---------------------------------------------------------------------------

export interface DeliverOptions {
  /** If set, also write signal to sender's outbox for audit trail. */
  readonly senderHome?: string;
}

/**
 * Deliver a signal to the target node's inbox.
 *
 * - Creates the inbox directory if it doesn't exist
 * - Writes the signal as an atomic JSON file
 * - Optionally copies to sender's outbox
 */
export async function deliverSignal(
  signal: TmeshSignal,
  targetHome: string,
  options?: DeliverOptions,
): Promise<Result<void>> {
  const json = JSON.stringify(signal, null, 2);
  const filename = signalFilename(signal);

  // Ensure target inbox
  const inboxResult = await ensureInbox(targetHome);
  if (!inboxResult.ok) return inboxResult as Result<void>;

  try {
    await atomicWrite(inboxResult.value, filename, json);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }

  // Optional: write to sender outbox
  if (options?.senderHome !== undefined) {
    const outboxResult = await ensureOutbox(options.senderHome);
    if (!outboxResult.ok) return outboxResult as Result<void>;

    try {
      await atomicWrite(outboxResult.value, filename, json);
    } catch (err: unknown) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return Ok(undefined);
}

// ---------------------------------------------------------------------------
// listInbox
// ---------------------------------------------------------------------------

/**
 * List all signals in the inbox, sorted chronologically (by ULID).
 *
 * Skips non-JSON files and malformed JSON gracefully.
 */
export async function listInbox(home: string): Promise<Result<TmeshSignal[]>> {
  const inboxPath = join(home, 'inbox');

  // Ensure inbox exists
  const ensureResult = await ensureInbox(home);
  if (!ensureResult.ok) return ensureResult as Result<TmeshSignal[]>;

  let entries: string[];
  try {
    entries = await readdir(inboxPath);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }

  const jsonFiles = entries.filter((f) => f.endsWith('.json')).sort();
  const signals: TmeshSignal[] = [];

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(inboxPath, file), 'utf-8');
      const parsed = JSON.parse(content) as TmeshSignal;
      signals.push(parsed);
    } catch {
      // Skip malformed files
    }
  }

  return Ok(signals);
}

// ---------------------------------------------------------------------------
// readSignalFile
// ---------------------------------------------------------------------------

/**
 * Read a specific signal by its ID from the inbox.
 */
export async function readSignalFile(
  signalId: string,
  home: string,
): Promise<Result<TmeshSignal>> {
  const inboxPath = join(home, 'inbox');
  const filePath = join(inboxPath, `${signalId}.json`);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return Err(new Error(`Signal not found: ${signalId}`));
    }
    return Err(err instanceof Error ? err : new Error(String(err)));
  }

  try {
    const signal = JSON.parse(content) as TmeshSignal;
    return Ok(signal);
  } catch (err: unknown) {
    return Err(new Error(`Malformed signal file: ${signalId}`));
  }
}

// ---------------------------------------------------------------------------
// ackSignal
// ---------------------------------------------------------------------------

/**
 * Acknowledge (delete) a signal from the inbox.
 */
export async function ackSignal(
  signalId: string,
  home: string,
): Promise<Result<void>> {
  const filePath = join(home, 'inbox', `${signalId}.json`);

  try {
    await unlink(filePath);
    return Ok(undefined);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return Err(new Error(`Signal not found: ${signalId}`));
    }
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------------------------------------------------------------------------
// cleanExpired
// ---------------------------------------------------------------------------

/**
 * Remove all signals from the inbox whose TTL has expired.
 * Returns the number of signals cleaned.
 *
 * Signals without a TTL are never cleaned.
 */
export async function cleanExpired(home: string): Promise<Result<number>> {
  const listResult = await listInbox(home);
  if (!listResult.ok) return listResult as Result<number>;

  const now = Date.now();
  let cleaned = 0;

  for (const signal of listResult.value) {
    if (signal.ttl === undefined) continue;

    const signalTime = new Date(signal.timestamp).getTime();
    const expiresAt = signalTime + signal.ttl * 1000;

    if (now >= expiresAt) {
      const result = await ackSignal(signal.id, home);
      if (result.ok) cleaned++;
    }
  }

  return Ok(cleaned);
}
