/**
 * tmesh register/deregister -- called by tmux hooks for auto-registration.
 *
 * These are internal commands triggered by tmux session-created/session-closed
 * hooks. They create/clean up node directories in the shared mesh home.
 *
 * Usage (called by tmux hooks, not users):
 *   tmesh register <session-name>
 *   tmesh deregister <session-name>
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { registerCommand } from '../registry';
import { resolveHome } from '../../types';

registerCommand('register', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh register <session-name>\n');
    return 1;
  }

  const sessionName = args[0]!;
  const home = resolveHome();
  const nodeDir = join(home, 'nodes', sessionName, 'inbox');

  try {
    await mkdir(nodeDir, { recursive: true });
    process.stdout.write(`Registered ${sessionName}\n`);
    return 0;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Failed to register ${sessionName}: ${msg}\n`);
    return 1;
  }
});

registerCommand('deregister', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh deregister <session-name>\n');
    return 1;
  }

  const sessionName = args[0]!;
  const home = resolveHome();
  const nodeDir = join(home, 'nodes', sessionName);

  try {
    await rm(nodeDir, { recursive: true, force: true });
    process.stdout.write(`Deregistered ${sessionName}\n`);
    return 0;
  } catch {
    // Silent -- node might not exist
  }
  return 0;
});
