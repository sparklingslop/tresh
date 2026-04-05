/**
 * tmesh read <signal-id> -- read a specific signal (hidden, delegates to `log --read`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('read', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh read <signal-id>\n');
    return 1;
  }
  const logHandler = getCommand('log');
  if (logHandler === undefined) { process.stderr.write('Error: log command not registered.\n'); return 1; }
  return logHandler([], new Map([['read', args[0]!]]));
});
