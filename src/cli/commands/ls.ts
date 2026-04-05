/**
 * tmesh ls -- list all tmux sessions with mesh metadata.
 *
 * Thin CLI wrapper over the discovery SDK.
 */

import type { TmeshNode } from '../../types';
import { discover } from '../../core/discovery';
import { registerCommand } from '../registry';

// ---------------------------------------------------------------------------
// Formatters (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Format nodes as a human-readable aligned table.
 */
export function formatNodeTable(nodes: readonly TmeshNode[]): string {
  if (nodes.length === 0) {
    return 'No tmux sessions found.';
  }

  const headers = ['SESSION', 'IDENTITY', 'PID', 'COMMAND', 'STATUS', 'STARTED'];
  const rows = nodes.map((n) => [
    String(n.sessionName),
    n.identity ?? '-',
    String(n.pid),
    n.command,
    n.status,
    n.startedAt,
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i]!.length)),
  );

  const pad = (s: string, w: number) => s.padEnd(w);
  const divider = widths.map((w) => '-'.repeat(w)).join('  ');

  return [
    headers.map((h, i) => pad(h, widths[i]!)).join('  '),
    divider,
    ...rows.map((r) => r.map((c, i) => pad(c, widths[i]!)).join('  ')),
  ].join('\n');
}

/**
 * Format nodes as JSON (for agent/SDK consumption).
 */
export function formatNodeJson(nodes: readonly TmeshNode[]): string {
  return JSON.stringify(nodes, null, 2);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

registerCommand('ls', async (_args, flags) => {
  const result = discover();
  if (!result.ok) {
    process.stderr.write(`Discovery failed: ${result.error.message}\n`);
    return 1;
  }

  const output = flags.has('json')
    ? formatNodeJson(result.value)
    : formatNodeTable(result.value);

  process.stdout.write(output + '\n');
  return 0;
});
