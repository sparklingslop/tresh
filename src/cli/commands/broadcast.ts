/**
 * tmesh broadcast "message" -- broadcast to all (hidden, delegates to `send * "msg"`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('broadcast', async (args, flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh broadcast "message" [--type message|command|event]\n');
    return 1;
  }
  const sendHandler = getCommand('send');
  if (sendHandler === undefined) { process.stderr.write('Error: send command not registered.\n'); return 1; }
  return sendHandler(['*', args[0]!], flags);
});
