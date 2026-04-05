/**
 * tmesh send -- send a signal to a specific node.
 *
 * Usage: tmesh send <target> "message" [--type message|command|event] [--channel <name>] [--ttl <seconds>]
 *
 * Delivers a signal file to the target's inbox AND sends a tmux
 * display-message notification to the target session.
 */

import { registerCommand } from '../registry';
import { resolveEffectiveIdentity } from '../../core/identity';
import { createSignal } from '../../core/signal';
import { deliverSignal } from '../../core/transport';
import { notifyNode } from '../../core/notify';
import { resolveHome } from '../../types';
import type { SignalType } from '../../types';

registerCommand('send', async (args, flags) => {
  if (args.length < 2) {
    process.stderr.write('Usage: tmesh send <target> "message" [--type message|command|event] [--channel <name>]\n');
    return 1;
  }

  const target = args[0]!;
  const content = args[1]!;
  const home = resolveHome();

  const identityResult = await resolveEffectiveIdentity(home);
  if (!identityResult.ok) {
    process.stderr.write(`Error: ${identityResult.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const sender = identityResult.value;
  const signalType = (flags.get('type') as SignalType) ?? 'message';
  const channel = flags.get('channel') as string | undefined;
  const ttlRaw = flags.get('ttl');
  const ttl = typeof ttlRaw === 'string' ? parseInt(ttlRaw, 10) : undefined;

  const signalResult = createSignal({
    sender,
    target,
    type: signalType,
    content,
    ...(channel !== undefined ? { channel } : {}),
    ...(ttl !== undefined && !isNaN(ttl) ? { ttl } : {}),
  });

  if (!signalResult.ok) {
    process.stderr.write(`Error: ${signalResult.error.message}\n`);
    return 1;
  }

  // Deliver to filesystem
  const targetHome = `${home}/nodes/${target}`;
  const deliverResult = await deliverSignal(signalResult.value, targetHome, {
    senderHome: home,
  });

  if (!deliverResult.ok) {
    process.stderr.write(`Error: ${deliverResult.error.message}\n`);
    return 1;
  }

  // Notify target session via tmux display-message (best-effort)
  await notifyNode(target, sender, signalType, content);

  process.stdout.write(`Sent ${signalResult.value.id} to ${target}\n`);
  return 0;
});
