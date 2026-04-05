/**
 * tmesh log -- unified conversation and inbox view (consolidated).
 *
 * Usage:
 *   tmesh log                          Show conversation history
 *   tmesh log --follow                 Live tail (like watch)
 *   tmesh log -f                       Alias for --follow
 *   tmesh log --tail <n>               Last N lines
 *   tmesh log --peer <name>            Filter by peer
 *   tmesh log --inbox                  List pending signals
 *   tmesh log --read <signal-id>       Read a specific signal
 *   tmesh log --ack <signal-id>        Acknowledge (delete) a signal
 *
 * Replaces: log, watch, inbox, read, ack
 */

import { watch as fsWatch } from 'node:fs';
import { registerCommand } from '../registry';
import { resolveMyNodeHome } from '../../core/identity';
import { readLog } from '../../core/conversation';
import { listInbox, readSignalFile, ackSignal } from '../../core/transport';
import { formatInbound } from '../../core/display';
import { parseLogLine } from '../../core/display';
import { resolveHome } from '../../types';

registerCommand('log', async (_args, flags) => {
  const home = resolveHome();

  const nodeHome = await resolveMyNodeHome(home);
  if (!nodeHome.ok) {
    process.stderr.write(`Error: ${nodeHome.error.message}\nRun "tmesh join <name>" first.\n`);
    return 1;
  }

  // --inbox: list pending signals
  if (flags.get('inbox') === true) {
    return await showInbox(nodeHome.value);
  }

  // --read <signal-id>: read a specific signal
  const readId = flags.get('read');
  if (typeof readId === 'string') {
    return await showSignal(readId, nodeHome.value);
  }

  // --ack <signal-id>: acknowledge (delete) a signal
  const ackId = flags.get('ack');
  if (typeof ackId === 'string') {
    return await acknowledgeSignal(ackId, nodeHome.value);
  }

  // --follow / -f: live tail
  const follow = flags.get('follow') === true || flags.get('f') === true;

  const tailRaw = flags.get('tail');
  const tail = typeof tailRaw === 'string' ? parseInt(tailRaw, 10) : undefined;
  const peerFilter = flags.get('peer') as string | undefined;
  const channelFilter = flags.get('channel') as string | undefined;

  // Show existing log
  const lines = await readLog(nodeHome.value, tail !== undefined ? { tail } : (follow ? { tail: 20 } : undefined));

  if (!follow && lines.length === 0) {
    process.stdout.write('No conversation history.\n');
    return 0;
  }

  for (const line of lines) {
    if (!matchesFilter(line, peerFilter, channelFilter)) continue;
    process.stdout.write(line + '\n');
  }

  if (!follow) return 0;

  // Live tail mode
  process.stdout.write('--- watching ---\n');

  const ac = new AbortController();
  const onSigint = () => {
    ac.abort();
    process.stdout.write('\n');
  };
  process.on('SIGINT', onSigint);

  let lastLineCount = lines.length;

  try {
    const dir = nodeHome.value;
    let watcher: ReturnType<typeof fsWatch> | null = null;

    try {
      watcher = fsWatch(dir, { persistent: false }, () => {
        readLog(nodeHome.value).then((allLines) => {
          const newLines = allLines.slice(lastLineCount);
          for (const line of newLines) {
            if (!matchesFilter(line, peerFilter, channelFilter)) continue;
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
          if (peerFilter !== undefined && !line.includes(peerFilter)) continue;
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

// ---------------------------------------------------------------------------
// Inbox listing
// ---------------------------------------------------------------------------

async function showInbox(nodeHome: string): Promise<number> {
  const result = await listInbox(nodeHome);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  const signals = result.value;
  if (signals.length === 0) {
    process.stdout.write('Inbox empty.\n');
    return 0;
  }

  for (const signal of signals) {
    process.stdout.write(formatInbound({
      sender: signal.sender,
      content: signal.content,
      timestamp: signal.timestamp,
      type: signal.type,
    }) + '\n');
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Read single signal
// ---------------------------------------------------------------------------

async function showSignal(signalId: string, nodeHome: string): Promise<number> {
  const result = await readSignalFile(signalId, nodeHome);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  const signal = result.value;
  process.stdout.write(`ID:        ${signal.id}\n`);
  process.stdout.write(`From:      ${signal.sender}\n`);
  process.stdout.write(`To:        ${signal.target}\n`);
  process.stdout.write(`Type:      ${signal.type}\n`);
  process.stdout.write(`Channel:   ${signal.channel}\n`);
  process.stdout.write(`Time:      ${signal.timestamp}\n`);
  if (signal.ttl !== undefined) {
    process.stdout.write(`TTL:       ${signal.ttl}s\n`);
  }
  if (signal.replyTo !== undefined) {
    process.stdout.write(`Reply-To:  ${signal.replyTo}\n`);
  }
  process.stdout.write(`\n${signal.content}\n`);

  return 0;
}

// ---------------------------------------------------------------------------
// Acknowledge signal
// ---------------------------------------------------------------------------

async function acknowledgeSignal(signalId: string, nodeHome: string): Promise<number> {
  const result = await ackSignal(signalId, nodeHome);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  process.stdout.write(`Acked ${signalId}\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// Structured filter
// ---------------------------------------------------------------------------

function matchesFilter(line: string, peer?: string, channel?: string): boolean {
  if (peer === undefined && channel === undefined) return true;

  const parsed = parseLogLine(line);
  if (parsed === null) return false;

  if (peer !== undefined && parsed.peer !== peer) return false;
  if (channel !== undefined && parsed.channel !== channel) return false;

  return true;
}
