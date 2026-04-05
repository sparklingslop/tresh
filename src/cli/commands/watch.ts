/**
 * tmesh watch -- tail incoming signals (like `tail -f`).
 *
 * Usage: tmesh watch [--channel <name>]
 */

import { registerCommand } from '../registry';
import { watchInbox } from '../../core/watch';
import { resolveHome } from '../../types';

registerCommand('watch', async (_args, flags) => {
  const home = resolveHome();
  const channelFilter = flags.get('channel') as string | undefined;

  process.stdout.write('Watching inbox... (Ctrl+C to stop)\n');

  const ac = new AbortController();

  // Handle SIGINT gracefully
  const onSigint = () => {
    ac.abort();
    process.stdout.write('\nStopped.\n');
  };
  process.on('SIGINT', onSigint);

  try {
    for await (const signal of watchInbox(home, { signal: ac.signal })) {
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
