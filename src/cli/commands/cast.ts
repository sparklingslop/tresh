/**
 * tmesh cast -- send a signal to a channel (broadcast with channel).
 *
 * Usage: tmesh cast <channel> "message"
 */

import { registerCommand } from '../registry';
import { readIdentity } from '../../core/identity';
import { createSignal } from '../../core/signal';
import { deliverSignal } from '../../core/transport';
import { resolveHome } from '../../types';
import { listNodes } from '../../core/nodes';

registerCommand('cast', async (args, _flags) => {
  if (args.length < 2) {
    process.stderr.write('Usage: tmesh cast <channel> "message"\n');
    return 1;
  }

  const channel = args[0]!;
  const content = args[1]!;
  const home = resolveHome();

  const identityResult = await readIdentity(home);
  if (!identityResult.ok) {
    process.stderr.write(`Error: ${identityResult.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const signalResult = createSignal({
    sender: identityResult.value,
    target: '*',
    type: 'event',
    content,
    channel,
  });

  if (!signalResult.ok) {
    process.stderr.write(`Error: ${signalResult.error.message}\n`);
    return 1;
  }

  const nodes = await listNodes(home);
  let delivered = 0;

  for (const node of nodes) {
    const targetHome = `${home}/nodes/${node}`;
    const result = await deliverSignal(signalResult.value, targetHome);
    if (result.ok) delivered++;
  }

  process.stdout.write(`Cast ${signalResult.value.id} to ${delivered} node(s) on channel "${channel}"\n`);
  return 0;
});
