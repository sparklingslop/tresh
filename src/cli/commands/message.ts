/**
 * tmesh message <target> "content" -- send with injection (hidden, delegates to `send`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('message', async (args, flags) => {
  const sendHandler = getCommand('send');
  if (sendHandler === undefined) return 1;
  return sendHandler(args, flags);
});
