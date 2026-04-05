/**
 * tmesh watch -- tail the conversation log.
 *
 * Shows both --> and <-- in one stream. The definitive conversation view.
 *
 * Usage: tmesh watch [--channel <name>]
 */

import { watch as fsWatch } from 'node:fs';
import { registerCommand } from '../registry';
import { resolveMyNodeHome } from '../../core/identity';
import { readLog } from '../../core/conversation';
import { resolveHome } from '../../types';

registerCommand('watch', async (_args, flags) => {
  const home = resolveHome();

  const nodeHome = await resolveMyNodeHome(home);
  if (!nodeHome.ok) {
    process.stderr.write(`Error: ${nodeHome.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const channelFilter = flags.get('channel') as string | undefined;
  // Print existing log first
  const existing = await readLog(nodeHome.value, { tail: 20 });
  for (const line of existing) {
    if (channelFilter !== undefined && !line.includes(channelFilter)) continue;
    process.stdout.write(line + '\n');
  }

  process.stdout.write('--- watching ---\n');

  const ac = new AbortController();
  const onSigint = () => {
    ac.abort();
    process.stdout.write('\n');
  };
  process.on('SIGINT', onSigint);

  let lastLineCount = existing.length;

  // Watch the log file for new lines
  try {
    const dir = nodeHome.value;
    let watcher: ReturnType<typeof fsWatch> | null = null;

    try {
      watcher = fsWatch(dir, { persistent: false }, () => {
        // File changed -- read new lines
        readLog(nodeHome.value).then((allLines) => {
          const newLines = allLines.slice(lastLineCount);
          for (const line of newLines) {
            if (channelFilter !== undefined && !line.includes(channelFilter)) continue;
            process.stdout.write(line + '\n');
          }
          lastLineCount = allLines.length;
        }).catch(() => {});
      });
    } catch {
      // fs.watch not available
    }

    if (ac.signal.aborted) return 0;

    // Poll as fallback
    while (!ac.signal.aborted) {
      await new Promise<void>((r) => {
        const t = setTimeout(r, 1000);
        ac.signal.addEventListener('abort', () => { clearTimeout(t); r(); }, { once: true });
      });

      if (ac.signal.aborted) break;

      try {
        const allLines = await readLog(nodeHome.value);
        const newLines = allLines.slice(lastLineCount);
        for (const line of newLines) {
          if (channelFilter !== undefined && !line.includes(channelFilter)) continue;
          process.stdout.write(line + '\n');
        }
        lastLineCount = allLines.length;
      } catch {
        // continue
      }
    }

    watcher?.close();
  } finally {
    process.removeListener('SIGINT', onSigint);
  }

  return 0;
});
