/**
 * Session initialization for tmesh.
 *
 * Hot-bootstraps any tmux session onto the mesh from the outside.
 * No restart needed. No manual setup inside the session.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

import { Ok, Err, resolveHome } from '../types';
import type { Result } from '../types';
import { PROTOCOL_MD } from './wire';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InitStep {
  readonly description: string;
  readonly command: readonly string[];
}

// ---------------------------------------------------------------------------
// Step builder
// ---------------------------------------------------------------------------

/**
 * Build the sequence of tmux commands to bootstrap a session.
 */
export function buildInitSteps(
  session: string,
  identity: string,
  tmeshBin: string,
): readonly InitStep[] {
  const primer = [
    'echo ""',
    `echo "--- tmesh mesh protocol ---"`,
    `echo "You are ${identity} on the tmesh mesh."`,
    `echo "Signals arrive as: [tmesh YYYY-MM-DD HH:MM:SS] sender: message"`,
    `echo "To reply:  tmesh send {sender} your-message"`,
    `echo "To check:  tmesh inbox"`,
    `echo "To see mesh: tmesh who"`,
    `echo "---"`,
    'echo ""',
  ].join(' && ');

  return [
    {
      description: 'Set session identity via tmux env',
      command: ['tmux', 'set-environment', '-t', session, 'TMESH_IDENTITY', identity],
    },
    {
      description: 'Create shell alias for tmesh binary',
      command: ['tmux', 'send-keys', '-t', session, `alias tmesh='TMESH_IDENTITY=${identity} bun run ${tmeshBin}'`, 'Enter'],
    },
    {
      description: 'Export TMESH_IDENTITY in session shell',
      command: ['tmux', 'send-keys', '-t', session, `export TMESH_IDENTITY=${identity}`, 'Enter'],
    },
    {
      description: 'Inject protocol primer into session',
      command: ['tmux', 'send-keys', '-t', session, primer, 'Enter'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

/**
 * Initialize a tmux session onto the mesh.
 *
 * 1. Sets TMESH_IDENTITY tmux env var
 * 2. Creates node inbox directory
 * 3. Injects shell alias + protocol primer
 * 4. Writes PROTOCOL.md to mesh home
 */
export async function initSession(
  session: string,
  identity: string,
  tmeshBin: string,
  home?: string,
): Promise<Result<void>> {
  const meshHome = home ?? resolveHome();

  // Create node inbox
  const inboxDir = join(meshHome, 'nodes', identity, 'inbox');
  try {
    await mkdir(inboxDir, { recursive: true });
  } catch (err: unknown) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }

  // Write PROTOCOL.md if missing
  const protocolPath = join(meshHome, 'PROTOCOL.md');
  try {
    await access(protocolPath);
  } catch {
    await writeFile(protocolPath, PROTOCOL_MD, 'utf-8');
  }

  // Execute tmux commands
  const steps = buildInitSteps(session, identity, tmeshBin);
  for (const step of steps) {
    try {
      execFileSync(step.command[0]!, step.command.slice(1) as string[], {
        stdio: 'pipe',
        timeout: 5000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Err(new Error(`${step.description}: ${msg}`));
    }
  }

  return Ok(undefined);
}
