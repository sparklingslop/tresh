/**
 * Auto-watch pane management for tmesh.
 *
 * Creates, detects, and closes the tmux watch pane that tails
 * the conversation log. Used by `tmesh join` for auto-watch.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { Ok, Err } from '../types';
import type { Result } from '../types';

const WATCH_PANE_TITLE = 'tmesh-watch';
const WATCH_PANE_HEIGHT = 6;

// ---------------------------------------------------------------------------
// Command builders (pure, testable)
// ---------------------------------------------------------------------------

/**
 * Build the tmux command to create a watch pane.
 * Splits vertically at the bottom, runs `tmesh log --follow`.
 */
export function buildWatchPaneCommand(identity: string, tmeshBin: string): readonly string[] {
  const shellCmd = `TMESH_IDENTITY=${identity} ${tmeshBin} log --follow`;
  return [
    'tmux', 'split-window', '-v', '-l', String(WATCH_PANE_HEIGHT),
    '-d', // don't switch focus to the new pane
    '-P', '-F', '#{pane_id}', // print the new pane ID
    `printf '\\033]2;${WATCH_PANE_TITLE}\\033\\\\' && ${shellCmd}`,
  ];
}

/**
 * Build the tmux command to check if a watch pane already exists.
 * Lists panes with their titles; caller checks for WATCH_PANE_TITLE.
 */
export function buildCheckWatchPaneCommand(): readonly string[] {
  return ['tmux', 'list-panes', '-F', `#{pane_title}`];
}

/**
 * Build the tmux command to close watch panes with our title.
 */
export function buildCloseWatchPaneCommand(): readonly string[] {
  return ['tmux', 'list-panes', '-F', '#{pane_id} #{pane_title}'];
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Check if a watch pane already exists in the current tmux window.
 */
export function hasWatchPane(): boolean {
  try {
    const output = execFileSync(
      buildCheckWatchPaneCommand()[0]!,
      buildCheckWatchPaneCommand().slice(1) as string[],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 },
    );
    return String(output).split('\n').some((line) => line.trim() === WATCH_PANE_TITLE);
  } catch {
    return false;
  }
}

/**
 * Open a watch pane that tails the conversation log.
 * Returns the pane ID on success.
 */
export function openWatchPane(identity: string, tmeshBin: string): Result<string> {
  if (hasWatchPane()) {
    return Ok('already-open');
  }

  const cmd = buildWatchPaneCommand(identity, tmeshBin);
  try {
    const output = execFileSync(cmd[0]!, cmd.slice(1) as string[], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return Ok(String(output).trim());
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Close any watch panes in the current tmux window.
 */
export function closeWatchPane(): Result<void> {
  const cmd = buildCloseWatchPaneCommand();
  try {
    const output = execFileSync(cmd[0]!, cmd.slice(1) as string[], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    });

    for (const line of String(output).split('\n')) {
      if (line.includes(WATCH_PANE_TITLE)) {
        const paneId = line.split(' ')[0];
        if (paneId) {
          execFileSync('tmux', ['kill-pane', '-t', paneId], {
            stdio: 'pipe',
            timeout: 3000,
          });
        }
      }
    }

    return Ok(undefined);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}
