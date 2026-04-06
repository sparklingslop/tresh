/**
 * Safety guards for send-keys injection.
 *
 * Checks pane health and state before injecting text to prevent data loss
 * and interference. Orchestrates: dead check -> copy mode wait -> human
 * typing detection -> inject.
 *
 * SECURITY: All pane IDs are validated strictly. All tmux calls use
 * execFileSync (no shell interpolation).
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { Ok, Err } from '../types';
import type { Result } from '../types';
import { escapeForTmux } from './inject';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SafeSendOptions {
  /** Check if human is typing before sending (default: true) */
  readonly checkHumanTyping?: boolean;
  /** Check if pane is in copy mode before sending (default: true) */
  readonly checkCopyMode?: boolean;
  /** Check if pane is dead before sending (default: true) */
  readonly checkDead?: boolean;
  /** Max time to wait for copy mode to exit (ms, default: 10000) */
  readonly copyModeTimeout?: number;
  /** Don't append Enter after the message */
  readonly noEnter?: boolean;
}

export interface SafeSendResult {
  readonly paneId: string;
  readonly messageLength: number;
  readonly guardsChecked: string[];
}

export type SafeSendError =
  | { readonly kind: 'dead_pane'; readonly paneId: string }
  | { readonly kind: 'copy_mode_timeout'; readonly paneId: string; readonly timeoutMs: number }
  | { readonly kind: 'human_typing'; readonly paneId: string; readonly inputContent: string }
  | { readonly kind: 'injection_failed'; readonly paneId: string; readonly error: string };

// ---------------------------------------------------------------------------
// Pane ID validation
// ---------------------------------------------------------------------------

const PANE_ID_PATTERN = /^%\d+$/;

function isValidPaneId(paneId: string): boolean {
  return PANE_ID_PATTERN.test(paneId);
}

// ---------------------------------------------------------------------------
// Prompt patterns for human typing detection
// ---------------------------------------------------------------------------

/**
 * Common shell/REPL prompt patterns. Ordered longest-first so that
 * ">>> " matches before "> ".
 */
const PROMPT_PATTERNS: readonly string[] = [
  '>>> ',
  '> ',
  '$ ',
  '% ',
];

// ---------------------------------------------------------------------------
// detectHumanTyping
// ---------------------------------------------------------------------------

/**
 * Detect if there's human input in a pane's input line.
 * Uses capture-pane and checks the last non-empty line for content after
 * common prompts ($ , % , > , >>> ).
 *
 * This is heuristic and best-effort.
 */
export function detectHumanTyping(paneId: string): Result<{ typing: boolean; content: string }> {
  if (!isValidPaneId(paneId)) {
    return Err(new Error(`Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source}`));
  }

  try {
    const output = execFileSync('tmux', ['capture-pane', '-t', paneId, '-p'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf-8',
    });

    const lines = String(output).split('\n');

    // Find the last non-empty line
    let lastLine = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i]!.trim();
      if (trimmed.length > 0) {
        lastLine = lines[i]!;
        break;
      }
    }

    if (lastLine.trim().length === 0) {
      return Ok({ typing: false, content: '' });
    }

    // Check if the line starts with a known prompt and has content after it
    for (const prompt of PROMPT_PATTERNS) {
      if (lastLine.startsWith(prompt)) {
        const afterPrompt = lastLine.slice(prompt.length).trim();
        if (afterPrompt.length > 0) {
          return Ok({ typing: true, content: afterPrompt });
        }
        // Prompt with no content after it -- not typing
        return Ok({ typing: false, content: '' });
      }
    }

    // No recognized prompt -- assume not typing (could be program output)
    return Ok({ typing: false, content: '' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to detect human typing in pane "${paneId}": ${msg}`));
  }
}

// ---------------------------------------------------------------------------
// waitForCopyModeExit
// ---------------------------------------------------------------------------

/**
 * Wait for a pane to exit copy mode, with timeout.
 * Polls pane_in_mode at ~100ms intervals.
 *
 * Returns true if copy mode exited, false if timeout expired.
 */
export function waitForCopyModeExit(paneId: string, timeoutMs?: number): Result<boolean> {
  if (!isValidPaneId(paneId)) {
    return Err(new Error(`Invalid pane ID: "${paneId}". Must match ${PANE_ID_PATTERN.source}`));
  }

  const deadline = Date.now() + (timeoutMs ?? 10000);
  const pollIntervalMs = 100;

  while (true) {
    try {
      const output = execFileSync('tmux', ['display-message', '-t', paneId, '-p', '#{pane_in_mode}'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
        encoding: 'utf-8',
      });

      if (String(output).trim() !== '1') {
        return Ok(true);
      }

      // Still in copy mode -- check timeout
      if (Date.now() >= deadline) {
        return Ok(false);
      }

      // Busy-wait for the poll interval (synchronous -- no async available)
      const waitUntil = Date.now() + pollIntervalMs;
      while (Date.now() < waitUntil) {
        // spin
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Err(new Error(`Failed to check copy mode for pane "${paneId}": ${msg}`));
    }
  }
}

// ---------------------------------------------------------------------------
// safeSend
// ---------------------------------------------------------------------------

/**
 * Safe send-keys with pre-flight guards.
 * Checks pane state before injecting to prevent interference.
 *
 * Guard order: validate -> dead check -> copy mode wait -> human typing -> inject
 */
export function safeSend(
  paneId: string,
  message: string,
  options?: SafeSendOptions,
): Result<SafeSendResult, SafeSendError> {
  // --- Input validation ---
  if (!isValidPaneId(paneId) || message.length === 0) {
    return Err({
      kind: 'injection_failed',
      paneId,
      error: `Invalid pane ID "${paneId}" or empty message`,
    });
  }

  const checkDead = options?.checkDead !== false;
  const checkCopyMode = options?.checkCopyMode !== false;
  const checkHumanTyping = options?.checkHumanTyping !== false;
  const copyModeTimeout = options?.copyModeTimeout ?? 10000;
  const noEnter = options?.noEnter === true;

  const guardsChecked: string[] = [];

  // --- Guard 1: Dead pane ---
  if (checkDead) {
    guardsChecked.push('dead');
    try {
      const output = execFileSync('tmux', ['display-message', '-t', paneId, '-p', '#{pane_dead}'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
        encoding: 'utf-8',
      });

      if (String(output).trim() === '1') {
        return Err({ kind: 'dead_pane', paneId });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Err({ kind: 'injection_failed', paneId, error: msg });
    }
  }

  // --- Guard 2: Copy mode ---
  if (checkCopyMode) {
    guardsChecked.push('copy_mode');
    const waitResult = waitForCopyModeExit(paneId, copyModeTimeout);
    if (!waitResult.ok) {
      return Err({
        kind: 'injection_failed',
        paneId,
        error: waitResult.error.message,
      });
    }
    if (waitResult.value === false) {
      return Err({ kind: 'copy_mode_timeout', paneId, timeoutMs: copyModeTimeout });
    }
  }

  // --- Guard 3: Human typing ---
  if (checkHumanTyping) {
    guardsChecked.push('human_typing');
    const typingResult = detectHumanTyping(paneId);
    if (!typingResult.ok) {
      return Err({
        kind: 'injection_failed',
        paneId,
        error: typingResult.error.message,
      });
    }
    if (typingResult.value.typing) {
      return Err({
        kind: 'human_typing',
        paneId,
        inputContent: typingResult.value.content,
      });
    }
  }

  // --- Inject ---
  const escaped = escapeForTmux(message);
  const args: string[] = ['send-keys', '-t', paneId, escaped];
  if (!noEnter) {
    args.push('Enter');
  }

  try {
    execFileSync('tmux', args, {
      stdio: 'pipe',
      timeout: 5000,
    });

    return Ok({
      paneId,
      messageLength: message.length,
      guardsChecked,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err({
      kind: 'injection_failed',
      paneId,
      error: msg,
    });
  }
}
