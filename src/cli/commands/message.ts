/**
 * tmesh message -- the primary agent-to-agent communication command.
 *
 * Usage: tmesh message <target> "content" [--type message|command|event] [--channel <name>]
 *
 * This is the unified command that:
 * 1. Creates a signal with ULID and metadata
 * 2. Delivers it to the target's filesystem inbox (durable)
 * 3. Formats a wire message with reply instructions
 * 4. Injects the wire message into the target's tmux session (live)
 * 5. Sends a tmux display-message notification (toast)
 *
 * The wire format tells the receiving agent:
 * - This is a tmesh signal (not user input)
 * - Who sent it
 * - How to reply (exact tmesh command)
 *
 * Harness-agnostic. Works with Claude Code, Cursor, Aider, or any agent.
 */

import { registerCommand } from '../registry';
import { resolveEffectiveIdentity } from '../../core/identity';
import { createSignal } from '../../core/signal';
import { deliverSignal } from '../../core/transport';
import { formatWireMessage } from '../../core/wire';
import { inject } from '../../core/inject';
import { findSessionForIdentity, formatSignalNotification, buildNotifyCommand } from '../../core/notify';
import { execFileSync } from 'node:child_process';
import { resolveHome } from '../../types';
import type { SignalType } from '../../types';

registerCommand('message', async (args, flags) => {
  if (args.length < 2) {
    process.stderr.write('Usage: tmesh message <target> "content" [--type message|command|event] [--channel <name>]\n');
    return 1;
  }

  const target = args[0]!;
  const content = args[1]!;
  const home = resolveHome();

  // Resolve sender identity
  const identityResult = await resolveEffectiveIdentity(home);
  if (!identityResult.ok) {
    process.stderr.write(`Error: ${identityResult.error.message}\nRun "tmesh identify <name>" first.\n`);
    return 1;
  }

  const sender = identityResult.value;
  const signalType = (flags.get('type') as SignalType) ?? 'message';
  const channel = (flags.get('channel') as string) ?? 'default';

  // 1. Create signal
  const signalResult = createSignal({
    sender,
    target,
    type: signalType,
    content,
    channel,
  });

  if (!signalResult.ok) {
    process.stderr.write(`Error: ${signalResult.error.message}\n`);
    return 1;
  }

  const signal = signalResult.value;

  // 2. Deliver to filesystem (durable)
  const targetHome = `${home}/nodes/${target}`;
  const deliverResult = await deliverSignal(signal, targetHome);
  if (!deliverResult.ok) {
    process.stderr.write(`Error: ${deliverResult.error.message}\n`);
    return 1;
  }

  // 3. Format wire message
  // Use short "tmesh" — if not in PATH, the reply instruction still shows intent
  const tmeshBin = 'tmesh';
  const wire = formatWireMessage({
    id: signal.id,
    from: sender,
    to: target,
    type: signalType,
    channel,
    content,
  }, { bin: tmeshBin });

  // 4. Inject into live session (best-effort)
  const session = await findSessionForIdentity(target);
  let injected = false;

  if (session !== null) {
    const injectResult = inject(session, wire);
    injected = injectResult.ok;

    // 5. tmux display-message notification (best-effort)
    const notification = formatSignalNotification(sender, signalType, content);
    const notifyCmd = buildNotifyCommand(session, notification);
    try {
      execFileSync(notifyCmd[0]!, notifyCmd.slice(1) as string[], { stdio: 'pipe', timeout: 3000 });
    } catch { /* best-effort */ }
  }

  // Output
  const status = injected ? 'delivered + injected' : 'delivered (offline)';
  process.stdout.write(`${signal.id} -> ${target} [${status}]\n`);
  return 0;
});
