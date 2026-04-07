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
import { PROTOCOL_MD } from './wire';
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
// resolveEffectiveIdentity
// ---------------------------------------------------------------------------

/**
 * Resolve the effective identity for the current session.
 *
 * Priority:
 * 1. TMESH_IDENTITY process env var (inherited from shell)
 * 2. TMESH_IDENTITY tmux session env var (set by tmesh join via tmux set-environment)
 * 3. Identity file at {home}/identity (shared, last-writer-wins)
 *
 * Step 2 is critical: when Claude Code runs tmesh commands as subprocesses,
 * the process env may NOT have TMESH_IDENTITY (it's not inherited from the
 * tmux session's shell). Reading the tmux session env ensures per-session
 * identity even when the process env is empty.
 */
export async function resolveEffectiveIdentity(home?: string): Promise<Result<Identity>> {
  // 1. Check process env var first (fastest, works when shell exports it)
  const envIdentity = process.env['TMESH_IDENTITY'];
  if (envIdentity !== undefined && envIdentity.trim().length > 0) {
    try {
      return Ok(Identity(envIdentity.trim()));
    } catch (err: unknown) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // 2. Check current tmux session's environment (per-session, set by tmesh join)
  // This bridges the gap when process.env doesn't have TMESH_IDENTITY
  // (e.g., Claude Code subprocesses don't inherit tmux session shell vars).
  // Skipped when TMESH_SKIP_TMUX_ENV=1 (used by tests to isolate identity).
  if (process.env['TMESH_SKIP_TMUX_ENV'] !== '1') {
    const tmuxIdentity = readCurrentTmuxSessionIdentity();
    if (tmuxIdentity !== null) {
      try {
        return Ok(Identity(tmuxIdentity));
      } catch {
        // Invalid identity in tmux env, fall through
      }
    }
  }

  // 3. Fall back to identity file (shared across sessions)
  return readIdentity(home);
}

/**
 * Read TMESH_IDENTITY from the current tmux session's environment.
 * Uses `tmux display-message -p '#{session_name}'` to find which session
 * we're in, then reads its environment.
 */
function readCurrentTmuxSessionIdentity(): string | null {
  try {
    // Get current session name
    const sessionName = execSync(
      "tmux display-message -p '#{session_name}' 2>/dev/null",
      { encoding: 'utf-8' },
    ).trim();

    if (sessionName.length === 0) return null;

    // Read TMESH_IDENTITY from that session's environment
    const output = execSync(
      `tmux show-environment -t ${sessionName} TMESH_IDENTITY 2>/dev/null`,
      { encoding: 'utf-8' },
    ).trim();

    if (output.startsWith('-') || !output.includes('=')) return null;
    const value = output.split('=').slice(1).join('=');
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// resolveNodeHome
// ---------------------------------------------------------------------------

/**
 * Resolve the home directory for a specific node identity.
 *
 * In the shared-home model, each node's inbox is at:
 *   {home}/nodes/{identity}/
 *
 * This is where `send` writes signals to, and where the
 * node should read its inbox from.
 */
export function resolveNodeHome(identity: string, home?: string): string {
  const dir = home ?? resolveHome();
  return join(dir, 'nodes', identity);
}

/**
 * Resolve this session's node home by reading its identity.
 * Returns the path where this node's inbox lives.
 * Uses resolveEffectiveIdentity (env var > file) for per-session correctness.
 */
export async function resolveMyNodeHome(home?: string): Promise<Result<string>> {
  const dir = home ?? resolveHome();
  const identityResult = await resolveEffectiveIdentity(dir);
  if (!identityResult.ok) {
    return identityResult as Result<string>;
  }
  return Ok(resolveNodeHome(identityResult.value, dir));
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
  // Ensure home directory exists before writing
  const homeResult = await ensureHome(home);
  if (!homeResult.ok) {
    return homeResult as Result<Identity>;
  }

  const writeResult = await writeIdentity(name, homeResult.value);
  if (!writeResult.ok) {
    return writeResult;
  }

  const tmuxResult = setTmuxEnvIdentity(writeResult.value);
  if (!tmuxResult.ok) {
    // Non-fatal: identity was written but tmux env couldn't be set
  }

  // Ensure node inbox exists
  const nodeDir = join(homeResult.value, 'nodes', name, 'inbox');
  await mkdir(nodeDir, { recursive: true });

  // Drop PROTOCOL.md (idempotent -- agents read this to learn tmesh conventions)
  const protocolPath = join(homeResult.value, 'PROTOCOL.md');
  try {
    await access(protocolPath);
  } catch {
    await writeFile(protocolPath, PROTOCOL_MD, 'utf-8');
  }

  return writeResult;
}
