/**
 * Output streaming module for tmesh.
 *
 * Streams output from tmux panes via pipe-pane, with pattern matching
 * for event detection. Uses a temp file as the intermediary: tmux
 * pipe-pane writes to it, we tail it for new content.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { watch as fsWatch, mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import type { FSWatcher } from 'node:fs';

import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANE_ID_PATTERN = /^%\d+$/;
const STREAMS_DIR = '/tmp/tmesh/streams';
const DEFAULT_TIMEOUT = 60_000;
const POLL_INTERVAL = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamOptions {
  /** Callback for each new line of output. */
  readonly onLine?: (line: string) => void;
  /** Pattern to match -- when found, the stream resolves. */
  readonly pattern?: RegExp;
  /** Timeout in ms (default: 60000). 0 = no timeout. */
  readonly timeout?: number;
}

export interface StreamHandle {
  /** Promise that resolves when pattern matches or timeout. */
  readonly done: Promise<Result<StreamResult>>;
  /** Stop streaming and clean up. */
  stop(): void;
}

export interface StreamResult {
  readonly paneId: string;
  readonly matched: boolean;
  readonly matchedLine?: string;
  readonly timedOut: boolean;
}

// ---------------------------------------------------------------------------
// Pane ID validation
// ---------------------------------------------------------------------------

function validatePaneId(paneId: string): void {
  if (!PANE_ID_PATTERN.test(paneId)) {
    throw new TypeError(
      `Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source} (e.g. %0, %1, %42)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Command builders
// ---------------------------------------------------------------------------

/**
 * Build the tmux pipe-pane command to start streaming.
 *
 * Returns: ['tmux', 'pipe-pane', '-O', '-t', paneId, 'cat >> outputPath']
 */
export function buildPipePaneCommand(paneId: string, outputPath: string): readonly string[] {
  validatePaneId(paneId);
  if (outputPath.length === 0) {
    throw new TypeError('Output path cannot be empty');
  }
  return ['tmux', 'pipe-pane', '-O', '-t', paneId, `cat >> ${outputPath}`];
}

/**
 * Build the tmux pipe-pane command to stop streaming (empty command).
 *
 * Returns: ['tmux', 'pipe-pane', '-t', paneId]
 */
export function buildStopPipePaneCommand(paneId: string): readonly string[] {
  validatePaneId(paneId);
  return ['tmux', 'pipe-pane', '-t', paneId];
}

// ---------------------------------------------------------------------------
// Path generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique stream output path.
 *
 * Format: /tmp/tmesh/streams/{numericId}-{timestamp}
 */
export function streamOutputPath(paneId: string): string {
  validatePaneId(paneId);
  const numericId = paneId.slice(1); // strip the %
  const timestamp = Date.now();
  return `${STREAMS_DIR}/${numericId}-${timestamp}`;
}

// ---------------------------------------------------------------------------
// Internal: file tailing
// ---------------------------------------------------------------------------

interface TailHandle {
  readonly done: Promise<Result<StreamResult>>;
  stop(): void;
}

/**
 * Tail a file for new content. Exported as _tailFile for testing.
 *
 * Uses fs.watch + polling fallback to detect new content.
 * Splits content into lines and calls onLine for each.
 * Checks each line against pattern if provided.
 */
export function _tailFile(
  filePath: string,
  options?: StreamOptions & { paneId?: string },
): TailHandle {
  const paneId = options?.paneId ?? 'unknown';
  const onLine = options?.onLine;
  const pattern = options?.pattern;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  let offset = 0;
  let stopped = false;
  let watcher: FSWatcher | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveDone: ((result: Result<StreamResult>) => void) | null = null;

  const done = new Promise<Result<StreamResult>>((resolve) => {
    resolveDone = resolve;
  });

  function cleanup(): void {
    if (stopped) return;
    stopped = true;

    if (watcher !== null) {
      watcher.close();
      watcher = null;
    }
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (timeoutTimer !== null) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }

  function processFile(): void {
    if (stopped) return;

    try {
      const content = readFileSync(filePath, 'utf-8');
      if (content.length <= offset) return;

      const newContent = content.slice(offset);
      offset = content.length;

      // Split into lines. The last element after split may be empty
      // (if content ends with \n) or a partial line.
      const parts = newContent.split('\n');

      // If content ends with \n, last element is empty string -- skip it
      // If content does NOT end with \n, last element is partial -- also skip
      // (we'll pick it up on next read when more data arrives)
      const hasTrailingNewline = newContent.endsWith('\n');
      const lineCount = hasTrailingNewline ? parts.length - 1 : parts.length - 1;

      for (let i = 0; i < lineCount; i++) {
        const line = parts[i]!;
        onLine?.(line);

        if (pattern !== undefined && pattern.test(line)) {
          cleanup();
          resolveDone?.(Ok({
            paneId,
            matched: true,
            matchedLine: line,
            timedOut: false,
          }));
          return;
        }
      }

      // If there's no trailing newline, we consumed one too many -- adjust offset
      if (!hasTrailingNewline && parts.length > 0) {
        const partial = parts[parts.length - 1]!;
        offset -= partial.length;
      }
    } catch {
      // File may not exist yet or be mid-write -- ignore
    }
  }

  // Start watching the file
  try {
    watcher = fsWatch(filePath, { persistent: false }, () => {
      processFile();
    });
  } catch {
    // fs.watch not supported -- rely on polling only
  }

  // Polling fallback
  pollTimer = setInterval(processFile, POLL_INTERVAL);

  // Timeout
  if (timeout > 0) {
    timeoutTimer = setTimeout(() => {
      cleanup();
      resolveDone?.(Ok({
        paneId,
        matched: false,
        timedOut: true,
      }));
    }, timeout);
  }

  function stop(): void {
    if (stopped) return;
    cleanup();
    resolveDone?.(Ok({
      paneId,
      matched: false,
      timedOut: false,
    }));
  }

  return { done, stop };
}

// ---------------------------------------------------------------------------
// streamPane -- full integration
// ---------------------------------------------------------------------------

/**
 * Stream output from a tmux pane to a file and tail it.
 *
 * Uses tmux pipe-pane to capture output to a temp file, then watches
 * the file for new content. Returns a StreamHandle with a done promise
 * and a stop() method.
 */
export function streamPane(paneId: string, options?: StreamOptions): Result<StreamHandle> {
  // Validate pane ID
  if (!PANE_ID_PATTERN.test(paneId)) {
    return Err(new Error(
      `Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source} (e.g. %0, %1, %42)`,
    ));
  }

  // Ensure streams directory exists
  try {
    mkdirSync(STREAMS_DIR, { recursive: true });
  } catch {
    return Err(new Error(`Failed to create streams directory: ${STREAMS_DIR}`));
  }

  // Generate output path and create the file
  const outputPath = streamOutputPath(paneId);
  try {
    writeFileSync(outputPath, '');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to create stream output file: ${msg}`));
  }

  // Start pipe-pane
  const startCmd = buildPipePaneCommand(paneId, outputPath);
  try {
    execFileSync(startCmd[0]!, startCmd.slice(1), {
      stdio: 'pipe',
      timeout: 5000,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Clean up the file we created
    try { unlinkSync(outputPath); } catch { /* ignore */ }
    return Err(new Error(`Failed to start pipe-pane for "${paneId}": ${msg}`));
  }

  // Start tailing the file
  const tail = _tailFile(outputPath, {
    ...options,
    paneId,
  });

  // Wrap stop to also stop pipe-pane and clean up the temp file
  const handle: StreamHandle = {
    done: tail.done.then((result) => {
      // Stop pipe-pane (best-effort)
      const stopCmd = buildStopPipePaneCommand(paneId);
      try {
        execFileSync(stopCmd[0]!, stopCmd.slice(1), {
          stdio: 'pipe',
          timeout: 5000,
        });
      } catch {
        // tmux may have exited already
      }

      // Clean up temp file (best-effort)
      try { unlinkSync(outputPath); } catch { /* ignore */ }

      return result;
    }),
    stop(): void {
      tail.stop();
    },
  };

  return Ok(handle);
}
