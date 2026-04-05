/**
 * tmesh ack <signal-id> -- acknowledge a signal (hidden, delegates to `log --ack`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('ack', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh ack <signal-id>\n');
    return 1;
  }
  const logHandler = getCommand('log');
  if (logHandler === undefined) { process.stderr.write('Error: log command not registered.\n'); return 1; }
  return logHandler([], new Map([['ack', args[0]!]]));
});
