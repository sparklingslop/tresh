/**
 * tmesh log -- show the conversation history.
 *
 * Usage: tmesh log [--tail <n>]
 *
 * Shows both --> and <-- in chronological order.
 * The definitive view of all mesh communication for this node.
 */

import { registerCommand } from '../registry';
import { resolveMyNodeHome } from '../../core/identity';
import { readLog } from '../../core/conversation';
import { resolveHome } from '../../types';

registerCommand('log', async (_args, flags) => {
  const home = resolveHome();

  const nodeHome = await resolveMyNodeHome(home);
  if (!nodeHome.ok) {
    process.stderr.write(`Error: ${nodeHome.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const tailRaw = flags.get('tail');
  const tail = typeof tailRaw === 'string' ? parseInt(tailRaw, 10) : undefined;

  const lines = await readLog(nodeHome.value, tail !== undefined ? { tail } : undefined);

  if (lines.length === 0) {
    process.stdout.write('No conversation history.\n');
    return 0;
  }

  for (const line of lines) {
    process.stdout.write(line + '\n');
  }

  return 0;
});
