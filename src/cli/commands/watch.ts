/**
 * tmesh watch -- tail conversation log (hidden, delegates to `log --follow`).
 */

import { registerCommand, getCommand } from '../registry';

registerCommand('watch', async (_args, flags) => {
  const logHandler = getCommand('log');
  if (logHandler === undefined) { process.stderr.write('Error: log command not registered.\n'); return 1; }
  const logFlags = new Map<string, string | boolean>([['follow', true]]);
  const channel = flags.get('channel');
  if (typeof channel === 'string') {
    logFlags.set('peer', channel);
  }
  return logHandler([], logFlags);
});
