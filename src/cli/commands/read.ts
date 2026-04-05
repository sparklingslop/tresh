/**
 * tmesh read -- read a specific signal by ID.
 *
 * Usage: tmesh read <signal-id>
 */

import { registerCommand } from '../registry';
import { readSignalFile } from '../../core/transport';
import { resolveHome } from '../../types';

registerCommand('read', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh read <signal-id>\n');
    return 1;
  }

  const signalId = args[0]!;
  const home = resolveHome();

  const result = await readSignalFile(signalId, home);
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
});
