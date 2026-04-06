/**
 * Task orchestration module for tmesh.
 *
 * Higher-level patterns (single, parallel, chain) built on tmux
 * primitives. Agent-agnostic -- works with any process that runs
 * in a tmux pane.
 *
 * - runTask: send command to a pane, poll for completion, capture output
 * - runParallel: run N tasks with concurrency limiting
 * - runChain: sequential pipeline with {previous} output substitution
 * - mapWithConcurrency: generic semaphore-based concurrent map
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { escapeForTmux } from './inject';
import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANE_ID_PATTERN = /^%\d+$/;
const DEFAULT_COMPLETION_PATTERN = /\$ $/;
const DEFAULT_TIMEOUT = 300_000; // 5 minutes
const POLL_INTERVAL = 1_000; // 1 second
const CAPTURE_LINES = 50;
const PREVIOUS_OUTPUT_MAX = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskDef {
  /** Pane ID or name to send the task to */
  readonly pane: string;
  /** The task command/instruction to send */
  readonly command: string;
  /** Completion pattern (default: /\$ $/ -- shell prompt) */
  readonly completionPattern?: RegExp;
  /** Timeout per task in ms (default: 300000 = 5min) */
  readonly timeout?: number;
}

export interface TaskResult {
  readonly pane: string;
  readonly status: 'completed' | 'timeout' | 'error';
  readonly output: string;
  readonly durationMs: number;
}

export interface ParallelOptions {
  /** Max concurrent tasks (default: 4) */
  readonly concurrency?: number;
}

// ---------------------------------------------------------------------------
// Pane ID validation
// ---------------------------------------------------------------------------

function validatePaneId(paneId: string): boolean {
  return PANE_ID_PATTERN.test(paneId);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Send a command to a tmux pane via send-keys.
 * The command is escaped for safe tmux injection.
 */
function sendCommand(pane: string, command: string): void {
  const escaped = escapeForTmux(command);
  execFileSync('tmux', ['send-keys', '-t', pane, escaped, 'Enter'], {
    stdio: 'pipe',
    timeout: 5000,
  });
}

/**
 * Capture current pane output via capture-pane.
 * Returns the captured text.
 */
function captureOutput(pane: string): string {
  const output = execFileSync(
    'tmux',
    ['capture-pane', '-t', pane, '-p', '-S', `-${CAPTURE_LINES}`],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf-8',
    },
  );
  return String(output);
}

/**
 * Sleep for a given number of milliseconds.
 * Uses a promise-based approach for async polling.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// runTask
// ---------------------------------------------------------------------------

/**
 * Execute a single task: send command, wait for completion, capture output.
 *
 * 1. Validate pane ID (/^%\d+$/)
 * 2. Send command via tmux send-keys
 * 3. Poll output via tmux capture-pane at 1s intervals
 * 4. Check for completion pattern match
 * 5. On match or timeout, return captured output + timing
 */
export async function runTask(task: TaskDef): Promise<Result<TaskResult>> {
  const { pane, command } = task;
  const completionPattern = task.completionPattern ?? DEFAULT_COMPLETION_PATTERN;
  const timeout = task.timeout ?? DEFAULT_TIMEOUT;

  // Validate pane ID
  if (!validatePaneId(pane)) {
    return Err(new Error(
      `Invalid pane ID: "${pane}". Must match ${PANE_ID_PATTERN.source} (e.g. %0, %1, %42)`,
    ));
  }

  const startTime = Date.now();

  // Send the command
  try {
    sendCommand(pane, command);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to send-keys to pane "${pane}": ${msg}`));
  }

  // Poll for completion
  let output = '';
  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed >= timeout) {
      return Ok({
        pane,
        status: 'timeout',
        output,
        durationMs: Date.now() - startTime,
      });
    }

    try {
      output = captureOutput(pane);
    } catch {
      // capture-pane might fail transiently -- keep polling
    }

    if (completionPattern.test(output)) {
      return Ok({
        pane,
        status: 'completed',
        output,
        durationMs: Date.now() - startTime,
      });
    }

    await sleep(POLL_INTERVAL);
  }
}

// ---------------------------------------------------------------------------
// mapWithConcurrency
// ---------------------------------------------------------------------------

/**
 * Concurrency-limited map utility.
 * Runs fn over items with at most N concurrent executions.
 *
 * Uses a semaphore pattern: maintains a pool of at most `concurrency`
 * in-flight promises. Results are returned in input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let activeCount = 0;
  let resolveAll: (() => void) | null = null;
  let rejectAll: ((err: unknown) => void) | null = null;
  let settled = false;

  const allDone = new Promise<void>((resolve, reject) => {
    resolveAll = resolve;
    rejectAll = reject;
  });

  function startNext(): void {
    if (settled) return;
    if (nextIndex >= items.length) {
      if (activeCount === 0) {
        settled = true;
        resolveAll?.();
      }
      return;
    }

    const idx = nextIndex;
    nextIndex++;
    activeCount++;

    fn(items[idx]!)
      .then((result) => {
        results[idx] = result;
        activeCount--;
        startNext();
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          rejectAll?.(err);
        }
      });
  }

  // Kick off initial batch
  const initialBatch = Math.min(concurrency, items.length);
  for (let i = 0; i < initialBatch; i++) {
    startNext();
  }

  await allDone;
  return results;
}

// ---------------------------------------------------------------------------
// runParallel
// ---------------------------------------------------------------------------

/**
 * Execute tasks in parallel with concurrency limiting.
 *
 * Uses mapWithConcurrency to run runTask on each task definition.
 * Task-level errors (validation failures) are propagated as Err results.
 * Individual task timeouts are reported in the TaskResult status.
 */
export async function runParallel(
  tasks: readonly TaskDef[],
  options?: ParallelOptions,
): Promise<Result<TaskResult[]>> {
  if (tasks.length === 0) {
    return Ok([]);
  }

  const concurrency = options?.concurrency ?? 4;

  try {
    const results = await mapWithConcurrency(tasks, concurrency, async (task) => {
      const result = await runTask(task);
      if (!result.ok) {
        // Convert Err to a TaskResult with error status
        return {
          pane: task.pane,
          status: 'error' as const,
          output: result.error.message,
          durationMs: 0,
        };
      }
      return result.value;
    });

    return Ok(results);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Parallel execution failed: ${msg}`));
  }
}

// ---------------------------------------------------------------------------
// runChain
// ---------------------------------------------------------------------------

/**
 * Execute tasks in chain. Output of step N is substituted into step N+1
 * via {previous}. Substituted output is trimmed to the last 500 chars
 * to avoid command overflow.
 *
 * Chain stops on the first error (validation failure or send-keys error).
 * Timeout results do NOT stop the chain -- only hard errors do.
 */
export async function runChain(
  tasks: readonly TaskDef[],
): Promise<Result<TaskResult[]>> {
  if (tasks.length === 0) {
    return Ok([]);
  }

  const results: TaskResult[] = [];
  let previousOutput = '';

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;

    // Substitute {previous} in the command
    const substituted = task.command.replace(
      /\{previous\}/g,
      previousOutput.slice(-PREVIOUS_OUTPUT_MAX).trim(),
    );

    const modifiedTask: TaskDef = {
      ...task,
      command: substituted,
    };

    const result = await runTask(modifiedTask);

    if (!result.ok) {
      return Err(new Error(
        `Chain failed at step ${i}: ${result.error.message}`,
      ));
    }

    results.push(result.value);

    // Extract output for next task's {previous} substitution
    // Strip the completion pattern match (typically the prompt) for cleaner output
    previousOutput = result.value.output;
  }

  return Ok(results);
}
