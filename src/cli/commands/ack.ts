/**
 * tmesh ack -- acknowledge (delete) a signal from the inbox.
 *
 * Usage: tmesh ack <signal-id>
 */

import { registerCommand } from '../registry';
import { ackSignal } from '../../core/transport';
import { resolveMyNodeHome } from '../../core/identity';
import { resolveHome } from '../../types';

registerCommand('ack', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh ack <signal-id>\n');
    return 1;
  }

  const signalId = args[0]!;
  const home = resolveHome();

  const nodeHome = await resolveMyNodeHome(home);
  if (!nodeHome.ok) {
    process.stderr.write(`Error: ${nodeHome.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const result = await ackSignal(signalId, nodeHome.value);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  process.stdout.write(`Acked ${signalId}\n`);
  return 0;
});
