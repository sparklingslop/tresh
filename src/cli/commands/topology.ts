/**
 * tmesh topology -- show mesh topology (hidden, delegates to `who --topology`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('topology', async (_args, _flags) => {
  const whoHandler = getCommand('who');
  if (whoHandler === undefined) return 1;
  return whoHandler([], new Map([['topology', true]]));
});
