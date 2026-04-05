/**
 * tmesh who -- show online mesh nodes with identities.
 *
 * Thin CLI wrapper over discovery SDK, filtered to identified nodes only.
 */

import type { TmeshNode } from '../../types';
import { discover } from '../../core/discovery';
import { formatNodeTable, formatNodeJson } from './ls';
import { registerCommand } from '../registry';

// ---------------------------------------------------------------------------
// Filtering (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Filter to nodes that have an assigned mesh identity.
 */
export function filterIdentifiedNodes(nodes: readonly TmeshNode[]): TmeshNode[] {
  return nodes.filter((n): n is TmeshNode & { readonly identity: NonNullable<TmeshNode['identity']> } =>
    n.identity !== null,
  );
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

registerCommand('who', async (_args, flags) => {
  const result = discover();
  if (!result.ok) {
    process.stderr.write(`Discovery failed: ${result.error.message}\n`);
    return 1;
  }

  const identified = filterIdentifiedNodes(result.value);

  if (identified.length === 0) {
    process.stdout.write('No identified mesh nodes. Use `tmesh identify <name>` to set an identity.\n');
    return 0;
  }

  const output = flags.has('json')
    ? formatNodeJson(identified)
    : formatNodeTable(identified);

  process.stdout.write(output + '\n');
  return 0;
});
