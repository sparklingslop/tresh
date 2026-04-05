/**
 * Identity management for tmesh nodes.
 *
 * Handles reading, writing, and resolving node identity.
 * Zero dependencies -- only node:* built-ins.
 */

import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

import { Identity, Ok, Err, resolveHome } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// ensureHome
// ---------------------------------------------------------------------------

/**
 * Ensure the tmesh home directory exists.
 * Creates it (and parents) if missing.
 */
export async function ensureHome(home?: string): Promise<Result<string>> {
  const dir = home ?? resolveHome();
  try {
    await mkdir(dir, { recursive: true });
    return Ok(dir);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------------------------------------------------------------------------
// writeIdentity
// ---------------------------------------------------------------------------

/**
 * Write an identity string to the identity file atomically.
 * The home directory must already exist -- this function will NOT create it.
 */
export async function writeIdentity(
  identity: string,
  home?: string,
): Promise<Result<Identity>> {
  const dir = home ?? resolveHome();

  // Validate identity via branded constructor
  let branded: Identity;
  try {
    branded = Identity(identity);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }

  // Verify home directory exists
  try {
    await access(dir);
  } catch {
    return Err(new Error(`Home directory does not exist: ${dir}`));
  }

  // Atomic write: temp file + rename
  const tmpName = `.identity.${randomBytes(8).toString('hex')}.tmp`;
  const tmpPath = join(dir, tmpName);
  const targetPath = join(dir, 'identity');

  try {
    await writeFile(tmpPath, branded + '\n', 'utf-8');
    await rename(tmpPath, targetPath);
    return Ok(branded);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------------------------------------------------------------------------
// readIdentity
// ---------------------------------------------------------------------------

/**
 * Read the identity from the identity file in the tmesh home directory.
 */
export async function readIdentity(home?: string): Promise<Result<Identity>> {
  const dir = home ?? resolveHome();
  const filePath = join(dir, 'identity');

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return Err(new Error(`Identity file not found: ${filePath}`));
    }
    return Err(err instanceof Error ? err : new Error(String(err)));
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return Err(new Error('Identity file is empty'));
  }

  try {
    return Ok(Identity(trimmed));
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------------------------------------------------------------------------
// resolveSessionIdentity
// ---------------------------------------------------------------------------

/**
 * Resolve the effective identity for this session.
 * Pure function -- no side effects.
 *
 * Priority: TMESH_IDENTITY env var > fileIdentity > null
 */
export function resolveSessionIdentity(
  envVars: ReadonlyMap<string, string>,
  fileIdentity: string | null,
): string | null {
  const envValue = envVars.get('TMESH_IDENTITY');
  if (envValue !== undefined && envValue.trim().length > 0) {
    return envValue;
  }
  return fileIdentity;
}

// ---------------------------------------------------------------------------
// setTmuxEnvIdentity
// ---------------------------------------------------------------------------

/**
 * Set the TMESH_IDENTITY environment variable in the current tmux session.
 */
export function setTmuxEnvIdentity(identity: Identity): Result<void> {
  try {
    execSync(`tmux set-environment TMESH_IDENTITY ${String(identity)}`, {
      stdio: 'pipe',
    });
    return Ok(undefined);
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------------------------------------------------------------------------
// identify
// ---------------------------------------------------------------------------

/**
 * Full identification workflow: validate, write identity file, set tmux env.
 */
export async function identify(
  name: string,
  home?: string,
): Promise<Result<Identity>> {
  const writeResult = await writeIdentity(name, home);
  if (!writeResult.ok) {
    return writeResult;
  }

  const tmuxResult = setTmuxEnvIdentity(writeResult.value);
  if (!tmuxResult.ok) {
    // Non-fatal: identity was written but tmux env couldn't be set
    // Still return success since the identity file is the primary store
  }

  return writeResult;
}
