/**
 * Pane lifecycle management for tmesh.
 *
 * Spawn, kill, and health-check tmux panes. All tmux interaction uses
 * execFileSync (NOT execSync) to avoid shell interpolation. Pane IDs
 * are validated strictly before use.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnPaneOptions {
  /** Command to run in the new pane */
  readonly command?: string;
  /** Split direction: 'horizontal' | 'vertical' (default: 'vertical') */
  readonly direction?: 'horizontal' | 'vertical';
  /** Size as percentage or lines (e.g., '50%' or '20') */
  readonly size?: string;
  /** Don't switch focus to new pane */
  readonly noFocus?: boolean;
  /** Target session (default: current) */
  readonly session?: string;
}

export type PaneMode = 'copy-mode' | 'view-mode' | 'normal';
export type PaneHealth = 'running' | 'idle' | 'dead';

// ---------------------------------------------------------------------------
// Pane ID validation
// ---------------------------------------------------------------------------

const PANE_ID_PATTERN = /^%\d+$/;

/**
 * Validate a tmux pane ID (format: %N where N is one or more digits).
 * Returns true if the string is a safe, well-formed pane ID.
 */
export function isValidPaneId(paneId: string): boolean {
  return PANE_ID_PATTERN.test(paneId);
}

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

/**
 * Spawn a new pane via tmux split-window. Returns the pane ID.
 *
 * Uses -P -F '#{pane_id}' to capture the new pane's ID from tmux output.
 */
export function spawnPane(options?: SpawnPaneOptions): Result<string> {
  const args: string[] = ['split-window'];

  // Direction flag
  const direction = options?.direction ?? 'vertical';
  args.push(direction === 'horizontal' ? '-h' : '-v');

  // Size
  if (options?.size !== undefined) {
    args.push('-l', options.size);
  }

  // No focus (detach)
  if (options?.noFocus === true) {
    args.push('-d');
  }

  // Target session
  if (options?.session !== undefined) {
    args.push('-t', options.session);
  }

  // Print pane ID
  args.push('-P', '-F', '#{pane_id}');

  // Command to run
  if (options?.command !== undefined) {
    args.push(options.command);
  }

  try {
    const output = execFileSync('tmux', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf-8',
    });

    const paneId = String(output).trim();

    if (!isValidPaneId(paneId)) {
      return Err(new Error(`Unexpected pane ID format from tmux: "${paneId}"`));
    }

    return Ok(paneId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to spawn pane: ${msg}`));
  }
}

// ---------------------------------------------------------------------------
// Kill
// ---------------------------------------------------------------------------

/**
 * Kill a specific pane by ID.
 */
export function killPane(paneId: string): Result<void> {
  if (!isValidPaneId(paneId)) {
    return Err(new Error(`Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source}`));
  }

  try {
    execFileSync('tmux', ['kill-pane', '-t', paneId], {
      stdio: 'pipe',
      timeout: 5000,
    });

    return Ok(undefined);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to kill pane "${paneId}": ${msg}`));
  }
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

/**
 * Check if a pane is dead (process exited).
 */
export function isPaneDead(paneId: string): Result<boolean> {
  if (!isValidPaneId(paneId)) {
    return Err(new Error(`Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source}`));
  }

  try {
    const output = execFileSync('tmux', ['display-message', '-t', paneId, '-p', '#{pane_dead}'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf-8',
    });

    return Ok(String(output).trim() === '1');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to check pane "${paneId}": ${msg}`));
  }
}

/**
 * Check what mode a pane is in (copy-mode, view-mode, or normal).
 *
 * First queries #{pane_in_mode} to see if the pane is in any mode at all.
 * If it is, queries #{pane_mode} to determine which specific mode.
 */
export function getPaneMode(paneId: string): Result<PaneMode> {
  if (!isValidPaneId(paneId)) {
    return Err(new Error(`Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source}`));
  }

  try {
    const inMode = execFileSync('tmux', ['display-message', '-t', paneId, '-p', '#{pane_in_mode}'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf-8',
    });

    if (String(inMode).trim() !== '1') {
      return Ok('normal');
    }

    const mode = execFileSync('tmux', ['display-message', '-t', paneId, '-p', '#{pane_mode}'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf-8',
    });

    const modeStr = String(mode).trim();
    if (modeStr === 'copy-mode' || modeStr === 'view-mode') {
      return Ok(modeStr);
    }

    // Fall back to returning whatever tmux reports as a PaneMode
    return Ok(modeStr as PaneMode);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to get pane mode for "${paneId}": ${msg}`));
  }
}

// ---------------------------------------------------------------------------
// Existence check
// ---------------------------------------------------------------------------

/**
 * Check if a pane exists. Attempts a no-op display-message; success means
 * the pane exists, failure means it does not.
 */
export function paneExists(paneId: string): Result<boolean> {
  if (!isValidPaneId(paneId)) {
    return Err(new Error(`Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source}`));
  }

  try {
    execFileSync('tmux', ['display-message', '-t', paneId, '-p', ''], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });

    return Ok(true);
  } catch {
    // tmux exits non-zero when the pane does not exist
    return Ok(false);
  }
}

// ---------------------------------------------------------------------------
// Pane command
// ---------------------------------------------------------------------------

/**
 * Get the running command in a pane.
 */
export function getPaneCommand(paneId: string): Result<string> {
  if (!isValidPaneId(paneId)) {
    return Err(new Error(`Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source}`));
  }

  try {
    const output = execFileSync('tmux', ['display-message', '-t', paneId, '-p', '#{pane_current_command}'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf-8',
    });

    return Ok(String(output).trim());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to get pane command for "${paneId}": ${msg}`));
  }
}
