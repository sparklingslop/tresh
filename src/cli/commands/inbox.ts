/**
 * tmesh inbox -- list pending signals in the inbox.
 *
 * Usage: tmesh inbox
 *
 * Reads from {home}/nodes/{myIdentity}/inbox/ — where other
 * nodes' `send` commands deliver signals to.
 */

import { registerCommand } from '../registry';
import { listInbox } from '../../core/transport';
import { resolveMyNodeHome } from '../../core/identity';
import { resolveHome } from '../../types';

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
    const time = signal.timestamp.slice(11, 19); // HH:MM:SS
    const preview = signal.content.length > 60
      ? signal.content.slice(0, 57) + '...'
      : signal.content;
    process.stdout.write(`${signal.id}  ${time}  ${signal.sender} [${signal.type}]  ${preview}\n`);
  }

  return 0;
});
