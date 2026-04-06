/**
 * Synchronization primitives for tmesh (tmux wait-for).
 *
 * Wraps tmux `wait-for` command for zero-polling agent coordination.
 * A waiter blocks until the channel is signaled, enabling efficient
 * rendezvous between tmux sessions without filesystem polling.
 *
 * DESIGN:
 * - `waitFor` spawns a child process (tmux wait-for blocks the caller)
 *   and returns a Promise that resolves when the child exits or times out.
 * - `signalWait` uses execFileSync since `tmux wait-for -S` returns immediately.
 * - All channels are prefixed with `tmesh-` to avoid collisions with
 *   other tmux wait-for users.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { spawn, execFileSync } from 'node:child_process';
import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WaitForOptions {
  /** Timeout in ms (default: 30000). 0 = no timeout. */
  readonly timeout?: number;
}

export interface WaitForResult {
  readonly channel: string;
  readonly timedOut: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Allowed channel name pattern: starts with letter, then alphanumeric/hyphen/underscore. */
const CHANNEL_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Maximum channel name length. */
const MAX_CHANNEL_LENGTH = 64;

/** Default timeout for waitFor in ms. */
const DEFAULT_TIMEOUT = 30000;

/** Internal prefix to namespace tmesh channels within tmux. */
const CHANNEL_PREFIX = 'tmesh-';

// ---------------------------------------------------------------------------
// Channel validation
// ---------------------------------------------------------------------------

/**
 * Check if a channel name is valid.
 *
 * Rules:
 * - Must start with a letter (a-z, A-Z)
 * - May contain alphanumeric, hyphens, underscores
 * - Max 64 characters
 * - No spaces, dots, or shell metacharacters
 */
export function isValidChannel(channel: string): boolean {
  if (channel.length === 0) return false;
  if (channel.length > MAX_CHANNEL_LENGTH) return false;
  return CHANNEL_PATTERN.test(channel);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the internal (prefixed) channel name.
 * Throws TypeError if the channel name is invalid.
 */
function resolveChannel(channel: string): string {
  if (!isValidChannel(channel)) {
    throw new TypeError(
      `Invalid channel name: "${channel}". Must match ${CHANNEL_PATTERN.source} (max ${MAX_CHANNEL_LENGTH} chars)`,
    );
  }
  return `${CHANNEL_PREFIX}${channel}`;
}

// ---------------------------------------------------------------------------
// Command builders (exposed for testing)
// ---------------------------------------------------------------------------

/**
 * Build the tmux wait-for command (for testing).
 *
 * Returns: ['tmux', 'wait-for', 'tmesh-{channel}']
 *
 * @throws TypeError if channel name is invalid
 */
export function buildWaitForCommand(channel: string): readonly string[] {
  const internal = resolveChannel(channel);
  return ['tmux', 'wait-for', internal];
}

/**
 * Build the tmux wait-for -S command (for testing).
 *
 * Returns: ['tmux', 'wait-for', '-S', 'tmesh-{channel}']
 *
 * @throws TypeError if channel name is invalid
 */
export function buildSignalWaitCommand(channel: string): readonly string[] {
  const internal = resolveChannel(channel);
  return ['tmux', 'wait-for', '-S', internal];
}

// ---------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------

/**
 * Wait for a tmux channel to be signaled.
 *
 * Spawns `tmux wait-for {channel}` as a child process (since the command
 * blocks until signaled) and returns a Promise that resolves when:
 * - The channel is signaled (timedOut: false)
 * - The timeout expires (timedOut: true)
 * - The child process errors (Result.ok: false)
 *
 * Uses spawn() (NOT execFileSync) to avoid blocking the event loop.
 */
export function waitFor(
  channel: string,
  options?: WaitForOptions,
): Promise<Result<WaitForResult>> {
  // Validate before spawning
  let args: readonly string[];
  try {
    args = buildWaitForCommand(channel);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Promise.resolve(Err(new Error(msg)));
  }

  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  return new Promise((resolve) => {
    const child = spawn(args[0]!, args.slice(1) as string[], {
      stdio: 'pipe',
    });

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function settle(result: Result<WaitForResult>): void {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(result);
    }

    child.on('close', (code) => {
      if (code === 0) {
        settle(Ok({ channel, timedOut: false }));
      } else {
        settle(Err(new Error(
          `tmux wait-for exited with code ${code} for channel "${channel}"`,
        )));
      }
    });

    child.on('error', (err) => {
      settle(Err(new Error(
        `Failed to spawn tmux wait-for for channel "${channel}": ${err.message}`,
      )));
    });

    // Set up timeout if non-zero
    if (timeout > 0) {
      timer = setTimeout(() => {
        child.kill('SIGTERM');
        settle(Ok({ channel, timedOut: true }));
      }, timeout);
    }
  });
}

/**
 * Signal a tmux wait-for channel, releasing all waiters.
 *
 * Uses execFileSync since `tmux wait-for -S` returns immediately.
 * This does NOT use a shell -- execFileSync invokes the binary directly.
 */
export function signalWait(channel: string): Result<void> {
  let args: readonly string[];
  try {
    args = buildSignalWaitCommand(channel);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(msg));
  }

  try {
    execFileSync(args[0]!, args.slice(1), {
      stdio: 'pipe',
      timeout: 5000,
    });
    return Ok(undefined);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to signal channel "${channel}": ${msg}`));
  }
}
