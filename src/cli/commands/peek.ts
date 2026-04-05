/**
 * tmesh peek -- capture-pane snapshot of a tmux session.
 *
 * Usage: tmesh peek <session> [--lines <n>]
 *
 * SECURITY: Session target is validated to prevent injection.
 * Uses execFileSync (no shell) for execution.
 */

import { registerCommand } from '../registry';
import { validateSessionTarget, peek } from '../../core/inject';

registerCommand('peek', async (args, flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh peek <session> [--lines <n>]\n');
    return 1;
  }

  const session = args[0]!;

  // Validate session target before any execution
  if (!validateSessionTarget(session)) {
    process.stderr.write(`Error: Invalid session target: "${session}"\n`);
    process.stderr.write('Session names must be alphanumeric with hyphens, underscores, dots, or colons.\n');
    return 1;
  }

  const linesRaw = flags.get('lines');
  let lines: number | undefined;

  if (typeof linesRaw === 'string') {
    lines = parseInt(linesRaw, 10);
    if (!Number.isInteger(lines) || lines <= 0) {
      process.stderr.write('Error: --lines must be a positive integer\n');
      return 1;
    }
  }

  const result = peek(session, lines !== undefined ? { lines } : undefined);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  process.stdout.write(result.value.content);
  return 0;
});
