/**
 * tmesh topology -- show all known nodes and their connections.
 *
 * Usage: tmesh topology
 */

import { registerCommand } from '../registry';
import { readIdentity } from '../../core/identity';
import { listNodes } from '../../core/nodes';
import { listInbox } from '../../core/transport';
import { resolveHome } from '../../types';

registerCommand('topology', async (_args, _flags) => {
  const home = resolveHome();

  // Read own identity
  const identityResult = await readIdentity(home);
  const selfIdentity = identityResult.ok ? identityResult.value : '(unidentified)';

  // List known nodes
  const nodes = await listNodes(home);

  // Read own inbox count
  const inboxResult = await listInbox(home);
  const inboxCount = inboxResult.ok ? inboxResult.value.length : 0;

  process.stdout.write(`Topology:\n\n`);
  process.stdout.write(`  * ${selfIdentity} (this node) [${inboxCount} signal(s) in inbox]\n`);

  if (nodes.length === 0) {
    process.stdout.write(`\n  No known peers.\n`);
  } else {
    process.stdout.write(`\n  Known peers:\n`);
    for (const node of nodes.sort()) {
      // Check peer inbox size
      const peerInbox = await listInbox(`${home}/nodes/${node}`);
      const peerCount = peerInbox.ok ? peerInbox.value.length : 0;
      process.stdout.write(`    - ${node} [${peerCount} signal(s) pending]\n`);
    }
  }

  process.stdout.write(`\n  Total: ${nodes.length + 1} node(s)\n`);
  return 0;
});
