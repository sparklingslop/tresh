/**
 * Node directory listing for tmesh.
 *
 * Lists known peer nodes from the nodes/ subdirectory structure.
 * Zero dependencies -- only node:* built-ins.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * List all known node identities from the nodes/ directory.
 * Returns directory names under {home}/nodes/.
 */
export async function listNodes(home: string): Promise<string[]> {
  const nodesDir = join(home, 'nodes');

  try {
    const entries = await readdir(nodesDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
