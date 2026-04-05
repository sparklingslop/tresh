/**
 * tmesh inbox -- list pending signals (hidden, delegates to `log --inbox`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('inbox', async (_args, _flags) => {
  const logHandler = getCommand('log');
  if (logHandler === undefined) { process.stderr.write('Error: log command not registered.\n'); return 1; }
  return logHandler([], new Map([['inbox', true]]));
});
