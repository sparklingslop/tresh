/**
 * tmesh ack -- acknowledge (delete) a signal from the inbox.
 *
 * Usage: tmesh ack <signal-id>
 */

import { registerCommand } from '../registry';
import { ackSignal } from '../../core/transport';
import { resolveHome } from '../../types';

registerCommand('ack', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh ack <signal-id>\n');
    return 1;
  }

  const signalId = args[0]!;
  const home = resolveHome();

  const result = await ackSignal(signalId, home);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  process.stdout.write(`Acked ${signalId}\n`);
  return 0;
});
