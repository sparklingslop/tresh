/**
 * tmesh inbox -- list pending signals in the inbox.
 *
 * Usage: tmesh inbox
 */

import { registerCommand } from '../registry';
import { listInbox } from '../../core/transport';
import { resolveMyNodeHome } from '../../core/identity';
import { resolveHome } from '../../types';
import { formatInbound } from '../../core/display';

registerCommand('inbox', async (_args, _flags) => {
  const home = resolveHome();

  const nodeHome = await resolveMyNodeHome(home);
  if (!nodeHome.ok) {
    process.stderr.write(`Error: ${nodeHome.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const result = await listInbox(nodeHome.value);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  const signals = result.value;
  if (signals.length === 0) {
    process.stdout.write('Inbox empty.\n');
    return 0;
  }

  for (const signal of signals) {
    process.stdout.write(formatInbound({
      sender: signal.sender,
      content: signal.content,
      timestamp: signal.timestamp,
      type: signal.type,
    }) + '\n');
  }

  return 0;
});
