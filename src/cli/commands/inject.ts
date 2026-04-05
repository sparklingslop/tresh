/**
 * tmesh inject -- raw tmux send-keys injection into a session.
 *
 * Usage: tmesh inject <session> "text" [--no-enter]
 *
 * SECURITY: Session target is validated. Message is escaped to prevent
 * command injection. Uses execFileSync (no shell) for execution.
 */

import { registerCommand } from '../registry';
import { validateSessionTarget, inject } from '../../core/inject';

registerCommand('inject', async (args, flags) => {
  if (args.length < 2) {
    process.stderr.write('Usage: tmesh inject <session> "text" [--no-enter]\n');
    return 1;
  }

  const session = args[0]!;
  const message = args[1]!;

  // Validate session target before any execution
  if (!validateSessionTarget(session)) {
    process.stderr.write(`Error: Invalid session target: "${session}"\n`);
    process.stderr.write('Session names must be alphanumeric with hyphens, underscores, dots, or colons.\n');
    return 1;
  }

  const noEnter = flags.get('no-enter') === true;

  const result = inject(session, message, { noEnter });
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  process.stdout.write(`Injected ${result.value.messageLength} chars into ${session}\n`);
  return 0;
});
