/**
 * tmesh join -- join the mesh.
 *
 * Usage:
 *   tmesh join <identity>                 Set this session's identity and join
 *   tmesh join <identity> --no-watch      Join without auto-watch pane
 *   tmesh join <session> <identity>       Hot-bootstrap a remote tmux session
 *
 * Single-arg form: calls identify() then opens a watch pane (opt-out: --no-watch).
 * Two-arg form: calls initSession() (sets env var, creates inbox, injects alias + protocol).
 */

import { registerCommand } from '../registry';
import { identify } from '../../core/identity';
import { initSession } from '../../core/init';
import { validateSessionTarget } from '../../core/inject';
import { openWatchPane } from '../../core/watchpane';
import { resolveTmeshBin, isValidIdentity } from '../util';

registerCommand('join', async (args, flags) => {
  if (args.length === 0) {
    process.stderr.write('Usage: tmesh join <identity>\n');
    process.stderr.write('       tmesh join <session> <identity>   (bootstrap remote session)\n');
    process.stderr.write('       tmesh join <identity> --no-watch  (skip auto-watch pane)\n');
    return 1;
  }

  const noWatch = flags.get('no-watch') === true;

  // Two-arg form: init a remote session (no watch pane for remote)
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

  // Auto-open watch pane (unless --no-watch)
  if (!noWatch) {
    const bin = resolveTmeshBin();
    const paneResult = openWatchPane(name, bin);
    if (paneResult.ok) {
      if (paneResult.value === 'already-open') {
        process.stdout.write('Watch pane: already open\n');
      } else {
        process.stdout.write(`Watch pane: opened (${paneResult.value})\n`);
      }
    } else {
      process.stdout.write('Watch pane: skipped (not in tmux, or tmux error)\n');
    }
  }

  return 0;
});
