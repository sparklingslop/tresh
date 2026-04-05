/**
 * Inbox watcher for tmesh.
 *
 * Watches the inbox directory for new signal files using fs.watch.
 * Yields TmeshSignal objects as an async iterator.
 * Zero dependencies -- only node:* built-ins.
 */

import { watch as fsWatch } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { TmeshSignal } from '../types';
import { ensureInbox } from './transport';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WatchOptions {
  /** AbortSignal to stop the watcher. */
  readonly signal?: AbortSignal;
  /** Polling interval in ms as fallback (default: 500). */
  readonly pollInterval?: number;
}

// ---------------------------------------------------------------------------
// watchInbox
// ---------------------------------------------------------------------------

/**
 * Watch the inbox for new signals. Returns an async iterator.
 *
 * Uses fs.watch for immediate notification. Falls back to polling
 * if fs.watch is unreliable on the platform.
 *
 * Break out of the for-await loop or abort via AbortSignal to stop.
 */
export async function* watchInbox(
  home: string,
  options?: WatchOptions,
): AsyncGenerator<TmeshSignal, void, undefined> {
  // Ensure inbox exists
  const inboxResult = await ensureInbox(home);
  if (!inboxResult.ok) return;

  const inboxPath = inboxResult.value;
  const abortSignal = options?.signal;

  // Track which files we've already yielded
  const seen = new Set<string>();

  // Scan existing files on startup
  const existing = await safeReaddir(inboxPath);
  for (const f of existing) {
    seen.add(f);
  }

  // Create a queue for new signals
  const queue: TmeshSignal[] = [];
  let resolve: (() => void) | null = null;

  function notify(): void {
    if (resolve !== null) {
      const r = resolve;
      resolve = null;
      r();
    }
  }

  async function processNewFiles(): Promise<void> {
    const files = await safeReaddir(inboxPath);
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();

    for (const file of jsonFiles) {
      if (seen.has(file)) continue;
      seen.add(file);

      try {
        const content = await readFile(join(inboxPath, file), 'utf-8');
        const signal = JSON.parse(content) as TmeshSignal;
        queue.push(signal);
      } catch {
        // Skip malformed files
      }
    }

    if (queue.length > 0) {
      notify();
    }
  }

  // Start fs.watch
  let watcher: ReturnType<typeof fsWatch> | null = null;
  try {
    watcher = fsWatch(inboxPath, { persistent: false }, (_event, _filename) => {
      processNewFiles().catch(() => {});
    });
  } catch {
    // fs.watch not supported -- rely on polling
  }

  // Cleanup on abort
  if (abortSignal !== undefined) {
    const cleanup = () => {
      watcher?.close();
      watcher = null;
      notify(); // Wake up the yield loop
    };
    if (abortSignal.aborted) {
      watcher?.close();
      return;
    }
    abortSignal.addEventListener('abort', cleanup, { once: true });
  }

  // Yield loop
  try {
    while (true) {
      if (abortSignal?.aborted) return;

      // Process any pending files
      await processNewFiles();

      // Yield queued signals
      while (queue.length > 0) {
        yield queue.shift()!;
        if (abortSignal?.aborted) return;
      }

      // Wait for notification from fs.watch or timeout for polling fallback
      await new Promise<void>((r) => {
        resolve = r;
        const interval = options?.pollInterval ?? 500;
        setTimeout(r, interval);
      });
    }
  } finally {
    watcher?.close();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeReaddir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}
