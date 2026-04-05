/**
 * tmesh send -- unified messaging command (consolidated).
 *
 * Usage:
 *   tmesh send <target> "message"              Send to one node
 *   tmesh send * "message"                     Broadcast to all nodes
 *   tmesh send <target> --ping                 Ping a node
 *   tmesh send <target> "msg" --channel <ch>   Send on a channel
 *   tmesh send <target> "msg" --type command   Set signal type
 *   tmesh send <target> "msg" --ttl 60         Set TTL in seconds
 *
 * Replaces: send, message, broadcast, cast, @, ping
 *
 * Full pipeline: signal creation -> filesystem delivery -> wire injection
 * -> tmux notification -> conversation log.
 */

import { registerCommand } from '../registry';
import { resolveEffectiveIdentity, resolveNodeHome } from '../../core/identity';
import { createSignal } from '../../core/signal';
import { deliverSignal } from '../../core/transport';
import { formatWireMessage } from '../../core/wire';
import { inject } from '../../core/inject';
import { findSessionForIdentity, formatSignalNotification, buildNotifyCommand } from '../../core/notify';
import { notifyNode } from '../../core/notify';
import { parseMentions } from '../../core/mention';
import { listNodes } from '../../core/nodes';
import { execFileSync } from 'node:child_process';
import { resolveHome } from '../../types';
import type { SignalType } from '../../types';
import { formatOutbound } from '../../core/display';
import { appendOutbound } from '../../core/conversation';

registerCommand('send', async (args, flags) => {
  const isPing = flags.get('ping') === true;

  if (!isPing && args.length < 2) {
    process.stderr.write('Usage: tmesh send <target> "message" [--type TYPE] [--channel CH] [--ttl N]\n');
    process.stderr.write('       tmesh send <target> --ping\n');
    process.stderr.write('       tmesh send * "message"          (broadcast)\n');
    return 1;
  }

  const target = args[0]!;
  const home = resolveHome();

  // Resolve sender identity
  const identityResult = await resolveEffectiveIdentity(home);
  if (!identityResult.ok) {
    process.stderr.write(`Error: ${identityResult.error.message}\nRun "tmesh join <name>" first.\n`);
    return 1;
  }

  const sender = identityResult.value;

  // --ping: hardcoded command signal
  if (isPing) {
    return await sendPing(sender, target, home);
  }

  const content = args[1]!;
  const signalType = (flags.get('type') as SignalType) ?? 'message';
  const channel = (flags.get('channel') as string) ?? 'default';
  const ttlRaw = flags.get('ttl');
  const ttl = typeof ttlRaw === 'string' ? parseInt(ttlRaw, 10) : undefined;

  // Broadcast: target = *
  if (target === '*') {
    return await sendBroadcast(sender, content, signalType, channel, home);
  }

  // Direct send (full pipeline)
  return await sendDirect(sender, target, content, signalType, channel, ttl, home);
});

// ---------------------------------------------------------------------------
// Direct send (full pipeline: signal + deliver + inject + notify + log)
// ---------------------------------------------------------------------------

async function sendDirect(
  sender: string,
  target: string,
  content: string,
  signalType: SignalType,
  channel: string,
  ttl: number | undefined,
  home: string,
): Promise<number> {
  const signalResult = createSignal({
    sender,
    target,
    type: signalType,
    content,
    channel,
    ...(ttl !== undefined && !isNaN(ttl) ? { ttl } : {}),
  });

  if (!signalResult.ok) {
    process.stderr.write(`Error: ${signalResult.error.message}\n`);
    return 1;
  }

  const signal = signalResult.value;

  // Deliver to filesystem
  const targetHome = `${home}/nodes/${target}`;
  const deliverResult = await deliverSignal(signal, targetHome);
  if (!deliverResult.ok) {
    process.stderr.write(`Error: ${deliverResult.error.message}\n`);
    return 1;
  }

  // Wire injection into live session (best-effort)
  const session = findSessionForIdentity(target);
  let injected = false;

  if (session !== null) {
    const wire = formatWireMessage({
      id: signal.id,
      from: sender,
      to: target,
      type: signalType,
      channel,
      content,
      timestamp: signal.timestamp,
    });

    const injectResult = inject(session, wire);
    injected = injectResult.ok;

    // tmux display-message notification (best-effort)
    const notification = formatSignalNotification(sender, signalType, content);
    const notifyCmd = buildNotifyCommand(session, notification);
    try {
      execFileSync(notifyCmd[0]!, notifyCmd.slice(1) as string[], { stdio: 'pipe', timeout: 3000 });
    } catch { /* best-effort */ }
  }

  // Append to sender's conversation log
  const senderNodeHome = resolveNodeHome(sender, home);
  await appendOutbound(senderNodeHome, {
    target, content, timestamp: signal.timestamp,
    channel: channel !== 'default' ? channel : undefined,
  });

  // Also handle @-mentions in content (deliver to mentioned nodes too)
  const mentions = parseMentions(content);
  const extraTargets = mentions.filter((m) => m !== sender && m !== target);
  for (const mentioned of extraTargets) {
    const mentionSignal = createSignal({
      sender,
      target: mentioned,
      type: signalType,
      content,
      channel,
    });
    if (mentionSignal.ok) {
      await deliverSignal(mentionSignal.value, `${home}/nodes/${mentioned}`);
      notifyNode(mentioned, sender, signalType, content);
    }
  }

  const status = injected ? 'delivered + injected' : 'delivered';
  const outboundDisplay = formatOutbound({ target, content, timestamp: signal.timestamp, status });
  process.stdout.write(outboundDisplay + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// Broadcast (deliver to all known nodes)
// ---------------------------------------------------------------------------

async function sendBroadcast(
  sender: string,
  content: string,
  signalType: SignalType,
  channel: string,
  home: string,
): Promise<number> {
  const signalResult = createSignal({
    sender,
    target: '*',
    type: signalType,
    content,
    channel,
  });

  if (!signalResult.ok) {
    process.stderr.write(`Error: ${signalResult.error.message}\n`);
    return 1;
  }

  const nodes = await listNodes(home);
  const targets = nodes.filter((n) => n !== sender);

  const results = await Promise.all(
    targets.map(async (node) => {
      const result = await deliverSignal(signalResult.value, `${home}/nodes/${node}`);
      return Number(result.ok);
    }),
  );
  const delivered = results.reduce((a, b) => a + b, 0);

  // Append to sender's conversation log
  const senderNodeHome = resolveNodeHome(sender, home);
  await appendOutbound(senderNodeHome, {
    target: '*',
    content,
    timestamp: signalResult.value.timestamp,
    channel: channel !== 'default' ? channel : undefined,
  });

  const outbound = formatOutbound({
    target: `* (${delivered} node${delivered !== 1 ? 's' : ''})`,
    content,
    timestamp: signalResult.value.timestamp,
    status: 'delivered',
  });
  process.stdout.write(outbound + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// Ping (command signal with TTL 30)
// ---------------------------------------------------------------------------

async function sendPing(
  sender: string,
  target: string,
  home: string,
): Promise<number> {
  const signalResult = createSignal({
    sender,
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
  process.stdout.write(`PING ${target}: signal=${signalResult.value.id} time=${elapsed}ms\n`);
  return 0;
}
