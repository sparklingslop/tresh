/**
 * tmesh join -- join the mesh.
 *
 * Usage:
 *   tmesh join <identity>                 Set this session's identity and join
 *   tmesh join <session> <identity>       Hot-bootstrap a remote tmux session
 *
 * Single-arg form: calls identify() (home + identity file + inbox + tmux env).
 * Two-arg form: calls initSession() (sets env var, creates inbox, injects alias + protocol).
 */

import { registerCommand } from '../registry';
import { identify } from '../../core/identity';
import { initSession } from '../../core/init';
import { validateSessionTarget } from '../../core/inject';
import { resolveTmeshBin, isValidIdentity } from '../util';

registerCommand('join', async (args, _flags) => {
  if (args.length === 0) {
    process.stderr.write('Usage: tmesh join <identity>\n');
    process.stderr.write('       tmesh join <session> <identity>   (bootstrap remote session)\n');
    return 1;
  }

  // Two-arg form: init a remote session
  if (args.length >= 2) {
    const session = args[0]!;
    const identity = args[1]!;

    if (!validateSessionTarget(session)) {
      process.stderr.write(`Error: Invalid session target: "${session}"\n`);
      return 1;
    }

    if (!isValidIdentity(identity)) {
      process.stderr.write(`Error: Invalid identity: "${identity}"\n`);
      return 1;
    }

    const result = await initSession(session, identity, resolveTmeshBin());
    if (!result.ok) {
      process.stderr.write(`Error: ${result.error.message}\n`);
      return 1;
    }

    process.stdout.write(`Joined ${session} as ${identity}\n`);
    return 0;
  }

  // Single-arg form: identify this session
  const name = args[0]!;

  if (!isValidIdentity(name)) {
    process.stderr.write(
      `Error: Invalid identity: "${name}". Must start with alphanumeric, contain only alphanumeric, dots, hyphens, underscores.\n`,
    );
    return 1;
  }

  const result = await identify(name);
  if (!result.ok) {
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }

  process.stdout.write(`Joined mesh as: ${result.value}\n`);
  return 0;
});
