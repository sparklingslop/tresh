/**
 * tmesh ping -- send a ping signal to a node.
 *
 * Usage: tmesh ping <target>
 */

import { registerCommand } from '../registry';
import { readIdentity } from '../../core/identity';
import { createSignal } from '../../core/signal';
import { deliverSignal } from '../../core/transport';
import { resolveHome } from '../../types';

registerCommand('ping', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh ping <target>\n');
    return 1;
  }

  const target = args[0]!;
  const home = resolveHome();

  const identityResult = await readIdentity(home);
  if (!identityResult.ok) {
    process.stderr.write(`Error: ${identityResult.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const signalResult = createSignal({
    sender: identityResult.value,
    target,
    type: 'command',
    content: 'ping',
    ttl: 30,
  });

  if (!signalResult.ok) {
    process.stderr.write(`Error: ${signalResult.error.message}\n`);
    return 1;
  }

  const targetHome = `${home}/nodes/${target}`;
  const start = Date.now();

  const deliverResult = await deliverSignal(signalResult.value, targetHome);
  if (!deliverResult.ok) {
    process.stderr.write(`Error: ${deliverResult.error.message}\n`);
    return 1;
  }

  const elapsed = Date.now() - start;
  process.stdout.write(`PING ${target}: signal=${signalResult.value.id} time=${elapsed}ms (delivery only, no ack roundtrip)\n`);
  return 0;
});
