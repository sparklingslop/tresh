/**
 * tmesh watch -- tail incoming signals (like `tail -f`).
 *
 * Usage: tmesh watch [--channel <name>]
 */

import { registerCommand } from '../registry';
import { watchInbox } from '../../core/watch';
import { resolveMyNodeHome } from '../../core/identity';
import { resolveHome } from '../../types';

registerCommand('watch', async (_args, flags) => {
  const home = resolveHome();

  const nodeHome = await resolveMyNodeHome(home);
  if (!nodeHome.ok) {
    process.stderr.write(`Error: ${nodeHome.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const channelFilter = flags.get('channel') as string | undefined;

  process.stdout.write('Watching inbox... (Ctrl+C to stop)\n');

  const ac = new AbortController();

  const onSigint = () => {
    ac.abort();
    process.stdout.write('\nStopped.\n');
  };
  process.on('SIGINT', onSigint);

  try {
    for await (const signal of watchInbox(nodeHome.value, { signal: ac.signal })) {
      if (channelFilter !== undefined && signal.channel !== channelFilter) {
        continue;
      }

      const time = signal.timestamp.slice(11, 19);
      process.stdout.write(`${time}  ${signal.sender} [${signal.type}/${signal.channel}]  ${signal.content}\n`);
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
  }

  return 0;
});
