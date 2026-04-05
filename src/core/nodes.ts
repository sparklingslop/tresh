/**
 * Node directory listing for tmesh.
 *
 * Lists known peer nodes from the nodes/ subdirectory structure.
 * Zero dependencies -- only node:* built-ins.
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * List all known node identities from the nodes/ directory.
 * Returns directory names under {home}/nodes/.
 */
export async function listNodes(home: string): Promise<string[]> {
  const nodesDir = join(home, 'nodes');

  let entries: string[];
  try {
    entries = await readdir(nodesDir);
  } catch {
    return [];
  }

  const nodes: string[] = [];
  for (const entry of entries) {
    try {
      const s = await stat(join(nodesDir, entry));
      if (s.isDirectory()) {
        nodes.push(entry);
      }
    } catch {
      // skip
    }
  }

  return nodes;
}
