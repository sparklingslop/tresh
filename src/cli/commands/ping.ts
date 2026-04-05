/**
 * tmesh ping <target> -- ping a node (hidden, delegates to `send <target> --ping`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('ping', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh ping <target>\n');
    return 1;
  }
  const sendHandler = getCommand('send');
  if (sendHandler === undefined) { process.stderr.write('Error: send command not registered.\n'); return 1; }
  return sendHandler([args[0]!], new Map([['ping', true]]));
});
