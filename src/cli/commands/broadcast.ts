/**
 * tmesh broadcast -- send a signal to all known nodes.
 *
 * Usage: tmesh broadcast "message" [--type message|command|event]
 */

import { registerCommand } from '../registry';
import { resolveEffectiveIdentity } from '../../core/identity';
import { createSignal } from '../../core/signal';
import { deliverSignal } from '../../core/transport';
import { resolveHome } from '../../types';
import { listNodes } from '../../core/nodes';
import type { SignalType } from '../../types';

registerCommand('broadcast', async (args, flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh broadcast "message" [--type message|command|event]\n');
    return 1;
  }

  const content = args[0]!;
  const home = resolveHome();

  const identityResult = await resolveEffectiveIdentity(home);
  if (!identityResult.ok) {
    process.stderr.write(`Error: ${identityResult.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const signalType = (flags.get('type') as SignalType) ?? 'event';

  const signalResult = createSignal({
    sender: identityResult.value,
    target: '*',
    type: signalType,
    content,
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

  process.stdout.write(`Broadcast ${signalResult.value.id} to ${delivered} node(s)\n`);
  return 0;
});
