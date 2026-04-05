/**
 * tmesh @ -- send a message to all @mentioned nodes.
 *
 * Usage: tmesh @ "Hey @nano-cortex and @nano-mesh, deploy ready"
 *
 * Parses @mentions from the message, delivers a signal to each
 * mentioned node, and sends tmux notifications. Skips self-mentions.
 * Harness-agnostic -- works from any shell or agent.
 */

import { registerCommand } from '../registry';
import { resolveEffectiveIdentity } from '../../core/identity';
import { parseMentions } from '../../core/mention';
import { createSignal } from '../../core/signal';
import { deliverSignal } from '../../core/transport';
import { notifyNode } from '../../core/notify';
import { resolveHome } from '../../types';

registerCommand('@', async (args, _flags) => {
  if (args.length < 1) {
    process.stderr.write('Usage: tmesh @ "Hey @target1 and @target2, message here"\n');
    return 1;
  }

  const content = args[0]!;
  const home = resolveHome();

  const identityResult = await resolveEffectiveIdentity(home);
  if (!identityResult.ok) {
    process.stderr.write(`Error: ${identityResult.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const sender = identityResult.value;
  const mentions = parseMentions(content);

  // Filter out self-mentions
  const targets = mentions.filter((m) => m !== sender);

  if (targets.length === 0) {
    process.stderr.write('No @mentions found in message (or only self-mention).\n');
    process.stderr.write('Usage: tmesh @ "Hey @target, message here"\n');
    return 1;
  }

  // Create one signal per target (each gets their own copy with correct target field)
  let delivered = 0;
  for (const target of targets) {
    const signalResult = createSignal({
      sender,
      target,
      type: 'message',
      content,
    });

    if (!signalResult.ok) {
      process.stderr.write(`Error creating signal for ${target}: ${signalResult.error.message}\n`);
      continue;
    }

    const targetHome = `${home}/nodes/${target}`;
    const deliverResult = await deliverSignal(signalResult.value, targetHome);

    if (deliverResult.ok) {
      delivered++;
      // Best-effort tmux notification
      notifyNode(target, sender, 'message', content);
    }
  }

  const targetList = targets.join(', ');
  process.stdout.write(`@ ${targetList} (${delivered}/${targets.length} delivered)\n`);
  return 0;
});
