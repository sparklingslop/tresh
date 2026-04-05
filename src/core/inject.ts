/**
 * Direct injection module for tmesh (Layer 1: raw tmux).
 *
 * Provides shell-safe command builders for tmux send-keys (inject)
 * and tmux capture-pane (peek). All user input is escaped to prevent
 * command injection. Commands are returned as string arrays for use
 * with execFileSync (no shell interpolation).
 *
 * SECURITY: This module is the boundary between user/agent input and
 * shell execution. Every public function validates its inputs strictly.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InjectOptions {
  /** If true, do not append Enter after the message. */
  readonly noEnter?: boolean;
}

export interface PeekOptions {
  /** Number of lines to capture from the bottom of the pane. */
  readonly lines?: number;
  /** Start line (negative = from bottom). Overrides lines if set. */
  readonly startLine?: number;
}

export interface InjectResult {
  readonly session: string;
  readonly messageLength: number;
}

export interface PeekResult {
  readonly session: string;
  readonly content: string;
  readonly lineCount: number;
}

// ---------------------------------------------------------------------------
// Session target validation
// ---------------------------------------------------------------------------

/**
 * Allowed characters in tmux session targets.
 * Permits: alphanumeric, hyphen, underscore, dot, colon (for pane targets like sess:0.1)
 * Rejects: spaces, quotes, semicolons, pipes, ampersands, backticks, dollar signs,
 *          parentheses, newlines, and any other shell metacharacter.
 */
const SESSION_TARGET_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

/**
 * Validate a tmux session/pane target string.
 * Returns true if safe to use in a tmux command.
 */
export function validateSessionTarget(target: string): boolean {
  if (target.length === 0) return false;
  if (target.length > 256) return false;
  return SESSION_TARGET_PATTERN.test(target);
}

// ---------------------------------------------------------------------------
// Shell escaping
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe use as a tmux send-keys argument.
 *
 * This escapes all shell metacharacters to prevent:
 * - Command injection via ; | & etc.
 * - Variable expansion via $
 * - Command substitution via ` or $()
 * - History expansion via !
 * - Quote breaking via ' or "
 * - Control characters via \n, \r, \t
 *
 * The escaped string is safe to pass as an argument to execFileSync
 * (which does NOT use a shell), but we escape defensively anyway
 * in case the string is ever used in a shell context.
 */
export function escapeForTmux(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    switch (char) {
      case '\\': result += '\\\\'; break;
      case "'":  result += "'\\''"; break;
      case '"':  result += '\\"'; break;
      case '$':  result += '\\$'; break;
      case '`':  result += '\\`'; break;
      case '!':  result += '\\!'; break;
      case ';':  result += '\\;'; break;
      case '|':  result += '\\|'; break;
      case '&':  result += '\\&'; break;
      case '(':  result += '\\('; break;
      case ')':  result += '\\)'; break;
      case '\n': result += '\\n'; break;
      case '\r': result += '\\r'; break;
      case '\t': result += '\\t'; break;
      default:   result += char; break;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Command builders (return string arrays for execFileSync)
// ---------------------------------------------------------------------------

/**
 * Build the argument array for a tmux send-keys command.
 *
 * Returns: ['tmux', 'send-keys', '-t', session, escapedMessage, 'Enter']
 *
 * @throws TypeError if session target is invalid or message is empty
 */
export function buildInjectCommand(
  session: string,
  message: string,
  options?: InjectOptions,
): readonly string[] {
  if (!validateSessionTarget(session)) {
    throw new TypeError(
      `Invalid session target: "${session}". Must match ${SESSION_TARGET_PATTERN.source}`,
    );
  }
  if (message.length === 0) {
    throw new TypeError('Message cannot be empty');
  }

  const escaped = escapeForTmux(message);
  const args: string[] = ['tmux', 'send-keys', '-t', session, escaped];

  if (options?.noEnter !== true) {
    args.push('Enter');
  }

  return args;
}

/**
 * Build the argument array for a tmux capture-pane command.
 *
 * Returns: ['tmux', 'capture-pane', '-t', session, '-p', ...]
 *
 * @throws TypeError if session target is invalid or lines is not a positive integer
 */
export function buildPeekCommand(
  session: string,
  options?: PeekOptions,
): readonly string[] {
  if (!validateSessionTarget(session)) {
    throw new TypeError(
      `Invalid session target: "${session}". Must match ${SESSION_TARGET_PATTERN.source}`,
    );
  }

  const args: string[] = ['tmux', 'capture-pane', '-t', session, '-p'];

  if (options?.startLine !== undefined) {
    args.push('-S', String(options.startLine));
  } else if (options?.lines !== undefined) {
    if (!Number.isInteger(options.lines) || options.lines <= 0) {
      throw new TypeError('lines must be a positive integer');
    }
    args.push('-S', String(-options.lines));
  }

  return args;
}

// ---------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------

/**
 * Inject text into a tmux session via send-keys.
 *
 * Uses execFileSync (NOT execSync) to avoid shell interpolation.
 * The message is escaped but execFileSync provides an additional
 * layer of safety by not invoking a shell.
 */
export function inject(
  session: string,
  message: string,
  options?: InjectOptions,
): Result<InjectResult> {
  const args = buildInjectCommand(session, message, options);

  try {
    execFileSync(args[0]!, args.slice(1), {
      stdio: 'pipe',
      timeout: 5000,
    });

    return Ok({
      session,
      messageLength: message.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to inject into session "${session}": ${msg}`));
  }
}

/**
 * Peek at a tmux session's screen content via capture-pane.
 *
 * Uses execFileSync (NOT execSync) to avoid shell interpolation.
 */
export function peek(
  session: string,
  options?: PeekOptions,
): Result<PeekResult> {
  const args = buildPeekCommand(session, options);

  try {
    const output = execFileSync(args[0]!, args.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf-8',
    });

    const content = String(output);
    const lines = content.split('\n');

    return Ok({
      session,
      content,
      lineCount: lines.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to peek session "${session}": ${msg}`));
  }
}
