/**
 * tmesh hooks -- manage tmux auto-registration hooks.
 *
 * Usage:
 *   tmesh hooks install    Install tmux hooks for auto-registration
 *   tmesh hooks uninstall  Remove tmux hooks
 *   tmesh hooks status     Show current hook status
 */

import { execFileSync } from 'node:child_process';
import { registerCommand } from '../registry';
import { installHooks, uninstallHooks } from '../../core/hooks';

function findTmeshBin(): string {
  // Use the currently running script as the binary path
  return process.argv[1] ?? 'tmesh';
}

registerCommand('hooks', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh hooks <install|uninstall|status>\n');
    return 1;
  }

  const subcommand = args[0]!;

  switch (subcommand) {
    case 'install': {
      const bin = findTmeshBin();
      const result = installHooks(bin);
      if (!result.ok) {
        process.stderr.write(`Error: ${result.error.message}\n`);
        return 1;
      }
      process.stdout.write(`Hooks installed. New tmux sessions will auto-register on the mesh.\n`);
      process.stdout.write(`Binary: ${bin}\n`);
      return 0;
    }

    case 'uninstall': {
      const result = uninstallHooks();
      if (!result.ok) {
        process.stderr.write(`Error: ${result.error.message}\n`);
        return 1;
      }
      process.stdout.write('Hooks uninstalled.\n');
      return 0;
    }

    case 'status': {
      try {
        const output = execFileSync('tmux', ['show-hooks', '-g'], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000,
        });
        const tmeshHooks = String(output).split('\n').filter((l) => l.includes('tmesh'));
        if (tmeshHooks.length === 0) {
          process.stdout.write('No tmesh hooks installed.\n');
        } else {
          process.stdout.write('Active tmesh hooks:\n');
          for (const hook of tmeshHooks) {
            process.stdout.write(`  ${hook}\n`);
          }
        }
      } catch {
        process.stderr.write('Could not read tmux hooks (is tmux running?).\n');
      }
      return 0;
    }

    default:
      process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
      process.stderr.write('Usage: tmesh hooks <install|uninstall|status>\n');
      return 1;
  }
});
