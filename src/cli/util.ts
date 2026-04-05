/**
 * Shared CLI utilities for tmesh commands.
 *
 * Eliminates duplication across command files.
 */

import { Identity } from '../types';

/**
 * Resolve the tmesh binary path. Uses the currently running script.
 */
export function resolveTmeshBin(): string {
  return process.argv[1] ?? 'tmesh';
}

/**
 * Check if a string is a valid tmesh identity (non-throwing).
 * Uses the branded Identity() constructor internally.
 */
export function isValidIdentity(name: string): boolean {
  try {
    Identity(name);
    return true;
  } catch {
    return false;
  }
}
