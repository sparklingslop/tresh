/**
 * Pane supervision module for tmesh.
 *
 * Transparent observation of tmux panes via capture-pane polling.
 * The supervised pane does not know it is being watched. Detects
 * completion patterns, pane death, and supports timeouts.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANE_ID_PATTERN = /^%\d+$/;
const DEFAULT_OBSERVE_INTERVAL = 5000;
const DEFAULT_CAPTURE_LINES = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuperviseOptions {
  /** How often to observe worker output (ms, default: 5000). */
  readonly observeInterval?: number;
  /** Callback on each observation. */
  readonly onObserve?: (content: string, paneId: string) => void;
  /** Pattern that indicates task completion. */
  readonly completionPattern?: RegExp;
  /** Callback when completion detected. */
  readonly onComplete?: (content: string, paneId: string) => void;
  /** Callback when pane dies. */
  readonly onDead?: (paneId: string) => void;
  /** Number of lines to capture on each observation (default: 50). */
  readonly captureLines?: number;
  /** Timeout -- max supervision duration in ms (default: 0 = infinite). */
  readonly timeout?: number;
}

export interface SuperviseHandle {
  /** Promise that resolves when supervision ends (completion, death, timeout, or stop). */
  readonly done: Promise<SuperviseResult>;
  /** Stop supervision manually. */
  stop(): void;
}

export interface SuperviseResult {
  readonly paneId: string;
  readonly reason: 'completed' | 'dead' | 'timeout' | 'stopped' | 'error';
  readonly lastContent?: string;
  readonly observations: number;
}

// ---------------------------------------------------------------------------
// Pane ID validation
// ---------------------------------------------------------------------------

function validatePaneId(paneId: string): boolean {
  return PANE_ID_PATTERN.test(paneId);
}

// ---------------------------------------------------------------------------
// Internal: capture pane content
// ---------------------------------------------------------------------------

function capturePaneContent(paneId: string, lines: number): string {
  return execFileSync('tmux', [
    'capture-pane', '-t', paneId, '-p', '-S', String(-lines),
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5000,
    encoding: 'utf-8',
  });
}

// ---------------------------------------------------------------------------
// Internal: check if pane is dead
// ---------------------------------------------------------------------------

function isPaneDead(paneId: string): boolean {
  const output = execFileSync('tmux', [
    'display-message', '-t', paneId, '-p', '#{pane_dead}',
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5000,
    encoding: 'utf-8',
  });
  return output.trim() === '1';
}

// ---------------------------------------------------------------------------
// supervise
// ---------------------------------------------------------------------------

/**
 * Supervise a tmux pane. Polls capture-pane at intervals,
 * checks for completion patterns and pane death.
 * The supervised pane does not know it is being watched.
 */
export function supervise(paneId: string, options?: SuperviseOptions): Result<SuperviseHandle> {
  if (!validatePaneId(paneId)) {
    return Err(new Error(
      `Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source} (e.g. %0, %1, %42)`,
    ));
  }

  const observeInterval = options?.observeInterval ?? DEFAULT_OBSERVE_INTERVAL;
  const captureLines = options?.captureLines ?? DEFAULT_CAPTURE_LINES;
  const completionPattern = options?.completionPattern;
  const timeout = options?.timeout ?? 0;
  const onObserve = options?.onObserve;
  const onComplete = options?.onComplete;
  const onDead = options?.onDead;

  let stopped = false;
  let observations = 0;
  let lastContent: string | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveDone: ((result: SuperviseResult) => void) | null = null;

  const done = new Promise<SuperviseResult>((resolve) => {
    resolveDone = resolve;
  });

  function cleanup(): void {
    if (intervalTimer !== null) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    if (timeoutTimer !== null) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }

  function finish(reason: SuperviseResult['reason']): void {
    if (stopped) return;
    stopped = true;
    cleanup();
    resolveDone?.({
      paneId,
      reason,
      lastContent,
      observations,
    });
  }

  function tick(): void {
    if (stopped) return;

    try {
      // Capture pane content
      const content = capturePaneContent(paneId, captureLines);
      lastContent = content;
      observations++;

      // Notify observer
      onObserve?.(content, paneId);

      // Check completion pattern first (highest priority)
      if (completionPattern !== undefined && completionPattern.test(content)) {
        onComplete?.(content, paneId);
        finish('completed');
        return;
      }

      // Check if pane is dead
      const dead = isPaneDead(paneId);
      if (dead) {
        onDead?.(paneId);
        finish('dead');
        return;
      }
    } catch {
      finish('error');
    }
  }

  // Start the observation interval
  intervalTimer = setInterval(tick, observeInterval);

  // Start timeout if configured
  if (timeout > 0) {
    timeoutTimer = setTimeout(() => {
      finish('timeout');
    }, timeout);
  }

  function stop(): void {
    finish('stopped');
  }

  return Ok({ done, stop });
}
