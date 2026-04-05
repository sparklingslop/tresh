/**
 * tmesh inbox -- list pending signals (hidden, delegates to `log --inbox`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('inbox', async (_args, _flags) => {
  const logHandler = getCommand('log');
  if (logHandler === undefined) return 1;
  return logHandler([], new Map([['inbox', true]]));
});
