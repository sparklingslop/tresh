/**
 * Tmux hook management for tmesh auto-registration.
 *
 * Installs/uninstalls global tmux hooks that automatically register
 * and deregister nodes when tmux sessions are created/destroyed.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Hook definitions
// ---------------------------------------------------------------------------

export const HOOK_NAMES = ['session-created', 'session-closed'] as const;
export type HookName = (typeof HOOK_NAMES)[number];

// ---------------------------------------------------------------------------
// Command builders
// ---------------------------------------------------------------------------

/**
 * Build tmux set-hook commands to install auto-registration hooks.
 *
 * - session-created: creates the node's inbox directory
 * - session-closed: cleans up the node directory
 */
export function buildInstallCommands(tmeshBin: string): readonly (readonly string[])[] {
  return [
    [
      'tmux', 'set-hook', '-g', 'session-created',
      `run-shell "${tmeshBin} register #{session_name}"`,
    ],
    [
      'tmux', 'set-hook', '-g', 'session-closed',
      `run-shell "${tmeshBin} deregister #{session_name}"`,
    ],
  ];
}

/**
 * Build tmux set-hook commands to uninstall auto-registration hooks.
 */
export function buildUninstallCommands(): readonly (readonly string[])[] {
  return HOOK_NAMES.map((name) => ['tmux', 'set-hook', '-gu', name] as const);
}

// ---------------------------------------------------------------------------
// Install / uninstall
// ---------------------------------------------------------------------------

/**
 * Install tmux hooks for auto-registration.
 */
export function installHooks(tmeshBin: string): Result<void> {
  const commands = buildInstallCommands(tmeshBin);

  for (const cmd of commands) {
    try {
      execFileSync(cmd[0]!, cmd.slice(1) as string[], {
        stdio: 'pipe',
        timeout: 5000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Err(new Error(`Failed to install hook: ${msg}`));
    }
  }

  return Ok(undefined);
}

/**
 * Uninstall tmux hooks.
 */
export function uninstallHooks(): Result<void> {
  const commands = buildUninstallCommands();

  for (const cmd of commands) {
    try {
      execFileSync(cmd[0]!, cmd.slice(1) as string[], {
        stdio: 'pipe',
        timeout: 5000,
      });
    } catch {
      // Ignore errors on uninstall (hook might not exist)
    }
  }

  return Ok(undefined);
}
