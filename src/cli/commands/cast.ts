/**
 * tmesh cast <channel> "message" -- channel broadcast (hidden, delegates to `send * "msg" --channel`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('cast', async (args, _flags) => {
  if (args.length < 2) {
    process.stderr.write('Usage: tmesh cast <channel> "message"\n');
    return 1;
  }
  const channel = args[0]!;
  const content = args[1]!;
  const sendHandler = getCommand('send');
  if (sendHandler === undefined) return 1;
  return sendHandler(['*', content], new Map([['channel', channel], ['type', 'event']]));
});
