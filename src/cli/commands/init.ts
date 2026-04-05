/**
 * tmesh init -- hot-bootstrap a tmux session onto the mesh.
 *
 * Usage: tmesh init <session> <identity>
 *
 * From outside, makes any tmux session mesh-ready:
 * - Sets TMESH_IDENTITY env var
 * - Creates node inbox
 * - Injects shell alias (tmesh command works inside the session)
 * - Injects protocol primer (agent knows how to send/receive)
 */

import { registerCommand } from '../registry';
import { initSession } from '../../core/init';
import { validateSessionTarget } from '../../core/inject';

registerCommand('init', async (args, _flags) => {
  if (args.length < 2) {
    process.stderr.write('Usage: tmesh init <session> <identity>\n');
    return 1;
  }

  const session = args[0]!;
  const identity = args[1]!;

  if (!validateSessionTarget(session)) {
    process.stderr.write(`Error: Invalid session target: "${session}"\n`);
    return 1;
  }

  // Use the current script as the tmesh binary for the alias
  const tmeshBin = process.argv[1] ?? 'tmesh';

  const result = await initSession(session, identity, tmeshBin);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  process.stdout.write(`Initialized ${session} as ${identity}\n`);
  process.stdout.write(`  - TMESH_IDENTITY set\n`);
  process.stdout.write(`  - Inbox created\n`);
  process.stdout.write(`  - Shell alias injected\n`);
  process.stdout.write(`  - Protocol primer injected\n`);
  return 0;
});
