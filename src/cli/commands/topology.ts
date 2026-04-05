/**
 * tmesh topology -- show all known nodes and their connections.
 *
 * Usage: tmesh topology
 */

import { registerCommand } from '../registry';
import { resolveEffectiveIdentity, resolveNodeHome } from '../../core/identity';
import { listNodes } from '../../core/nodes';
import { listInbox } from '../../core/transport';
import { resolveHome } from '../../types';

registerCommand('topology', async (_args, _flags) => {
  const home = resolveHome();

  const identityResult = await resolveEffectiveIdentity(home);
  const selfIdentity = identityResult.ok ? identityResult.value : '(unidentified)';

  const nodes = await listNodes(home);

  // Own inbox is at nodes/{myIdentity}/inbox
  const myNodeHome = identityResult.ok ? resolveNodeHome(selfIdentity, home) : home;
  const inboxResult = await listInbox(myNodeHome);
  const inboxCount = inboxResult.ok ? inboxResult.value.length : 0;

  process.stdout.write(`Topology:\n\n`);
  process.stdout.write(`  * ${selfIdentity} (this node) [${inboxCount} signal(s) in inbox]\n`);

  if (nodes.length === 0) {
    process.stdout.write(`\n  No known peers.\n`);
  } else {
    process.stdout.write(`\n  Known peers:\n`);
    for (const node of nodes.sort()) {
      if (node === selfIdentity) continue; // skip self in peer list
      const peerInbox = await listInbox(`${home}/nodes/${node}`);
      const peerCount = peerInbox.ok ? peerInbox.value.length : 0;
      process.stdout.write(`    - ${node} [${peerCount} signal(s) pending]\n`);
    }
  }

  const peerCount = nodes.filter((n) => n !== selfIdentity).length;
  process.stdout.write(`\n  Total: ${peerCount + 1} node(s)\n`);
  return 0;
});
