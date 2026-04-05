/**
 * tmesh setup -- one-time global install.
 *
 * Usage: tmesh setup [--uninstall] [--status]
 *
 * Sets up the mesh:
 * - Creates ~/.tmesh/ home directory
 * - Installs tmux hooks for auto-registration on session create/destroy
 * - Writes PROTOCOL.md for agent discovery
 *
 * With --uninstall: removes hooks. With --status: shows current state.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { registerCommand } from '../registry';
import { ensureHome } from '../../core/identity';
import { installHooks, uninstallHooks } from '../../core/hooks';
import { resolveHome } from '../../types';

function findTmeshBin(): string {
  return process.argv[1] ?? 'tmesh';
}

registerCommand('setup', async (_args, flags) => {
  // --status: show current setup state
  if (flags.get('status') === true) {
    const home = resolveHome();
    const homeExists = existsSync(home);
    process.stdout.write(`Home: ${home} ${homeExists ? '(exists)' : '(missing)'}\n`);

    try {
      const output = execFileSync('tmux', ['show-hooks', '-g'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
      const tmeshHooks = String(output).split('\n').filter((l) => l.includes('tmesh'));
      if (tmeshHooks.length === 0) {
        process.stdout.write('Hooks: not installed\n');
      } else {
        process.stdout.write('Hooks: installed\n');
        for (const hook of tmeshHooks) {
          process.stdout.write(`  ${hook}\n`);
        }
      }
    } catch {
      process.stdout.write('Hooks: unknown (tmux not running?)\n');
    }

    return 0;
  }

  // --uninstall: tear down hooks
  if (flags.get('uninstall') === true) {
    const result = uninstallHooks();
    if (!result.ok) {
      process.stderr.write(`Error: ${result.error.message}\n`);
      return 1;
    }
    process.stdout.write('Hooks uninstalled.\n');
    return 0;
  }

  // Default: full setup
  const home = resolveHome();

  // 1. Create home directory
  const homeResult = await ensureHome(home);
  if (!homeResult.ok) {
    process.stderr.write(`Error creating ${home}: ${homeResult.error.message}\n`);
    return 1;
  }
  process.stdout.write(`Home: ${home}\n`);

  // 2. Install tmux hooks
  const bin = findTmeshBin();
  const hooksResult = installHooks(bin);
  if (!hooksResult.ok) {
    process.stderr.write(`Warning: hooks not installed (${hooksResult.error.message})\n`);
    process.stdout.write('tmesh home created. Install hooks manually with: tmesh setup (inside tmux)\n');
    return 0;
  }

  process.stdout.write(`Hooks: installed (binary: ${bin})\n`);
  process.stdout.write('\nSetup complete. New tmux sessions will auto-register on the mesh.\n');
  process.stdout.write('Next: tmesh join <identity> to join the mesh in this session.\n');
  return 0;
});
