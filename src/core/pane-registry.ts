/**
 * Pane registry module for tmesh.
 *
 * Name-based pane addressing: maps human-readable names (like "worker",
 * "reviewer") to tmux pane IDs (like "%42"). Names are stored as tmux
 * session environment variables (TMESH_PANE_{NAME}) and cross-indexed
 * in a global filesystem directory (/tmp/tmesh/panes/).
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaneRegistryOptions {
  /** tmux session to scope the registry to (default: current session) */
  readonly session?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const PANE_NAME_MAX_LENGTH = 64;
const ENV_PREFIX = 'TMESH_PANE_';
const GLOBAL_INDEX_DIR = '/tmp/tmesh/panes';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a pane name.
 *
 * Rules:
 * - Must start with a letter (a-zA-Z)
 * - May contain alphanumeric, hyphens, underscores
 * - Max 64 characters
 */
export function isValidPaneName(name: string): boolean {
  if (name.length === 0) return false;
  if (name.length > PANE_NAME_MAX_LENGTH) return false;
  return PANE_NAME_PATTERN.test(name);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a pane name to its tmux environment variable name.
 * Names are uppercased: "worker" -> "TMESH_PANE_WORKER"
 */
function toEnvVar(name: string): string {
  return `${ENV_PREFIX}${name.toUpperCase()}`;
}

/**
 * Resolve the tmux session target.
 * If no session provided, asks tmux for the current session name.
 */
function resolveSession(options?: PaneRegistryOptions): string {
  if (options?.session) {
    return options.session;
  }

  try {
    const output = execFileSync('tmux', ['display-message', '-p', '#{session_name}'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return output.trim();
  } catch {
    // Fallback: if we can't determine the session, use a default
    return '0';
  }
}

/**
 * Write the global cross-session index entry.
 * Creates /tmp/tmesh/panes/{name} containing "{session}:{paneId}".
 */
function writeGlobalIndex(name: string, session: string, paneId: string): void {
  try {
    mkdirSync(GLOBAL_INDEX_DIR, { recursive: true });
    writeFileSync(`${GLOBAL_INDEX_DIR}/${name.toLowerCase()}`, `${session}:${paneId}`);
  } catch {
    // Best-effort: global index is supplementary
  }
}

/**
 * Remove the global cross-session index entry.
 */
function removeGlobalIndex(name: string): void {
  try {
    const path = `${GLOBAL_INDEX_DIR}/${name.toLowerCase()}`;
    if (existsSync(path)) {
      rmSync(path);
    }
  } catch {
    // Best-effort: global index is supplementary
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a pane by name.
 *
 * Stores the mapping in the tmux session environment as TMESH_PANE_{NAME}.
 * Also writes a global cross-session index entry at /tmp/tmesh/panes/{name}.
 */
export function registerPane(
  name: string,
  paneId: string,
  options?: PaneRegistryOptions,
): Result<void> {
  if (!isValidPaneName(name)) {
    return Err(new Error(`Invalid pane name: "${name}". Must match ${PANE_NAME_PATTERN.source} and be at most ${PANE_NAME_MAX_LENGTH} chars`));
  }

  const session = resolveSession(options);
  const envVar = toEnvVar(name);

  try {
    execFileSync('tmux', ['set-environment', '-t', session, envVar, paneId], {
      stdio: 'pipe',
      timeout: 5000,
    });

    writeGlobalIndex(name, session, paneId);

    return Ok(undefined);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to register pane "${name}": ${msg}`));
  }
}

/**
 * Resolve a name to a pane ID.
 *
 * Returns the pane ID if found, null if the name is not registered.
 */
export function resolvePane(
  name: string,
  options?: PaneRegistryOptions,
): Result<string | null> {
  if (!isValidPaneName(name)) {
    return Err(new Error(`Invalid pane name: "${name}". Must match ${PANE_NAME_PATTERN.source} and be at most ${PANE_NAME_MAX_LENGTH} chars`));
  }

  const session = resolveSession(options);
  const envVar = toEnvVar(name);

  try {
    const output = execFileSync('tmux', ['show-environment', '-t', session, envVar], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });

    // tmux show-environment output format: "VAR_NAME=value\n"
    const line = output.trim();
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      return Ok(null);
    }

    return Ok(line.slice(eqIdx + 1));
  } catch {
    // tmux exits non-zero when the variable is not set
    return Ok(null);
  }
}

/**
 * List all registered pane names and their IDs in the given session.
 *
 * Queries tmux show-environment and filters for TMESH_PANE_ prefix.
 */
export function listRegisteredPanes(
  options?: PaneRegistryOptions,
): Result<Map<string, string>> {
  const session = resolveSession(options);

  try {
    const output = execFileSync('tmux', ['show-environment', '-t', session], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });

    const panes = new Map<string, string>();
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.startsWith(ENV_PREFIX)) continue;

      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;

      const varName = line.slice(ENV_PREFIX.length, eqIdx);
      const value = line.slice(eqIdx + 1);
      panes.set(varName, value);
    }

    return Ok(panes);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to list registered panes: ${msg}`));
  }
}

/**
 * Unregister a pane by name.
 *
 * Removes the tmux session environment variable and the global index entry.
 */
export function unregisterPane(
  name: string,
  options?: PaneRegistryOptions,
): Result<void> {
  if (!isValidPaneName(name)) {
    return Err(new Error(`Invalid pane name: "${name}". Must match ${PANE_NAME_PATTERN.source} and be at most ${PANE_NAME_MAX_LENGTH} chars`));
  }

  const session = resolveSession(options);
  const envVar = toEnvVar(name);

  try {
    execFileSync('tmux', ['set-environment', '-t', session, '-u', envVar], {
      stdio: 'pipe',
      timeout: 5000,
    });

    removeGlobalIndex(name);

    return Ok(undefined);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Err(new Error(`Failed to unregister pane "${name}": ${msg}`));
  }
}
