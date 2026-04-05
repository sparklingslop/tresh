/**
 * tmesh viz -- visual dashboard (hidden, delegates to `who --viz`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('viz', async (_args, flags) => {
  const whoHandler = getCommand('who');
  if (whoHandler === undefined) return 1;
  const whoFlags = new Map<string, string | boolean>([['viz', true]]);
  if (flags.get('json') === true) {
    whoFlags.set('json', true);
  }
  return whoHandler([], whoFlags);
});
