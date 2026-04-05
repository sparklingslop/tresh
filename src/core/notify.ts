/**
 * Tmux notification module for tmesh.
 *
 * Sends non-invasive notifications to tmux sessions via display-message.
 * This makes signals VISIBLE in the target session without interrupting
 * whatever process is running (Claude Code, vim, zsh, anything).
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { Ok } from '../types';
import type { Result } from '../types';
import { discover } from './discovery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotifyOptions {
  /** Duration in ms to show the message (default: 5000). */
  readonly durationMs?: number;
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/**
 * Format a signal into a short notification string for tmux display-message.
 */
export function formatSignalNotification(
  sender: string,
  type: string,
  content: string,
): string {
  const maxContent = 60;
  const truncated = content.length > maxContent
    ? content.slice(0, maxContent - 3) + '...'
    : content;
  return `[tmesh] ${sender} [${type}]: ${truncated}`;
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the tmux display-message command array.
 */
export function buildNotifyCommand(
  session: string,
  message: string,
  options?: NotifyOptions,
): readonly string[] {
  const duration = options?.durationMs ?? 5000;
  return ['tmux', 'display-message', '-t', session, '-d', String(duration), message];
}

// ---------------------------------------------------------------------------
// Session lookup
// ---------------------------------------------------------------------------

/**
 * Find the tmux session name for a given mesh identity.
 * Scans tmux sessions for TMESH_IDENTITY env var match.
 */
export function findSessionForIdentity(identity: string): string | null {
  const sessions = discover();
  if (!sessions.ok) return null;

  for (const session of sessions.value) {
    if (session.identity === identity) {
      return session.sessionName;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Send notification
// ---------------------------------------------------------------------------

/**
 * Send a tmux display-message notification to a mesh node.
 *
 * Looks up the node's tmux session, then sends a non-invasive
 * status bar notification. Best-effort -- silently fails if
 * session not found or tmux command fails.
 */
export function notifyNode(
  targetIdentity: string,
  sender: string,
  type: string,
  content: string,
  options?: NotifyOptions,
): Result<void> {
  const session = findSessionForIdentity(targetIdentity);
  if (session === null) {
    // Node not found in tmux -- signal was still delivered to filesystem
    return Ok(undefined);
  }

  const message = formatSignalNotification(sender, type, content);
  const cmd = buildNotifyCommand(session, message, options);

  try {
    execFileSync(cmd[0]!, cmd.slice(1), {
      stdio: 'pipe',
      timeout: 3000,
    });
    return Ok(undefined);
  } catch {
    // Best-effort notification -- don't fail the send
    return Ok(undefined);
  }
}
