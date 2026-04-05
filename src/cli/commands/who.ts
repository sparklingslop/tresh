/**
 * tmesh who -- unified mesh status view (consolidated).
 *
 * Usage:
 *   tmesh who                    Show identified mesh nodes
 *   tmesh who --all              Show all tmux sessions (including unidentified)
 *   tmesh who --viz              Visual dashboard (requires gum)
 *   tmesh who --json             JSON output
 *   tmesh who --topology         Show topology with inbox counts
 *
 * Replaces: who, ls, topology, viz
 */

import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TmeshNode } from '../../types';
import { resolveHome } from '../../types';
import { discover } from '../../core/discovery';
import { resolveEffectiveIdentity, resolveNodeHome } from '../../core/identity';
import { listNodes } from '../../core/nodes';
import { listInbox } from '../../core/transport';
import { collectVizData } from '../../core/viz';
import { formatNodeTable, formatNodeJson } from './ls';
import { registerCommand } from '../registry';

// ---------------------------------------------------------------------------
// Filtering (exported for testing, used by old who.test.ts)
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
  const home = resolveHome();

  // --viz: visual dashboard
  if (flags.get('viz') === true) {
    return await showViz(home, flags);
  }

  // --topology: show topology with inbox counts
  if (flags.get('topology') === true) {
    return await showTopology(home);
  }

  // Discovery
  const result = discover();
  if (!result.ok) {
    process.stderr.write(`Discovery failed: ${result.error.message}\n`);
    return 1;
  }

  const showAll = flags.get('all') === true;
  const nodes = showAll ? result.value : filterIdentifiedNodes(result.value);

  if (nodes.length === 0) {
    if (showAll) {
      process.stdout.write('No tmux sessions found.\n');
    } else {
      process.stdout.write('No identified mesh nodes. Use `tmesh join <name>` to join.\n');
    }
    return 0;
  }

  const output = flags.has('json')
    ? formatNodeJson(nodes)
    : formatNodeTable(nodes);

  process.stdout.write(output + '\n');
  return 0;
});

// ---------------------------------------------------------------------------
// Topology view
// ---------------------------------------------------------------------------

async function showTopology(home: string): Promise<number> {
  const identityResult = await resolveEffectiveIdentity(home);
  const selfIdentity = identityResult.ok ? identityResult.value : '(unidentified)';

  const nodes = await listNodes(home);

  const myNodeHome = identityResult.ok ? resolveNodeHome(selfIdentity, home) : home;
  const inboxResult = await listInbox(myNodeHome);
  const inboxCount = inboxResult.ok ? inboxResult.value.length : 0;

  process.stdout.write(`Topology:\n\n`);
  process.stdout.write(`  * ${selfIdentity} (this node) [${inboxCount} signal(s) in inbox]\n`);

  const peers = nodes.filter((n) => n !== selfIdentity).sort();

  if (peers.length === 0) {
    process.stdout.write(`\n  No known peers.\n`);
  } else {
    const peerData = await Promise.all(
      peers.map(async (node) => {
        const peerInbox = await listInbox(`${home}/nodes/${node}`);
        return { node, count: peerInbox.ok ? peerInbox.value.length : 0 };
      }),
    );

    process.stdout.write(`\n  Known peers:\n`);
    for (const { node, count } of peerData) {
      process.stdout.write(`    - ${node} [${count} signal(s) pending]\n`);
    }
  }

  const peerCount = peers.length;
  process.stdout.write(`\n  Total: ${peerCount + 1} node(s)\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// Viz dashboard
// ---------------------------------------------------------------------------

function whichSync(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function findVizScript(): string | null {
  const candidates = [
    join(process.cwd(), 'src', 'cli', 'viz.sh'),
    join(new URL('.', import.meta.url).pathname, '..', 'viz.sh'),
    join(new URL('.', import.meta.url).pathname, '..', '..', 'cli', 'viz.sh'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function showViz(home: string, flags: ReadonlyMap<string, string | boolean>): Promise<number> {
  const data = await collectVizData(home);
  const json = JSON.stringify(data, null, 2);

  if (flags.get('json') === true) {
    process.stdout.write(json + '\n');
    return 0;
  }

  if (!whichSync('gum') || !whichSync('jq')) {
    if (!whichSync('gum')) process.stderr.write('gum not found. Install: brew install gum\n');
    if (!whichSync('jq')) process.stderr.write('jq not found. Install: brew install jq\n');
    process.stderr.write('Falling back to JSON output:\n\n');
    process.stdout.write(json + '\n');
    return 0;
  }

  const scriptPath = findVizScript();
  if (scriptPath === null) {
    process.stderr.write('viz.sh not found. Falling back to JSON output:\n\n');
    process.stdout.write(json + '\n');
    return 0;
  }

  try {
    const output = execFileSync('bash', [scriptPath], {
      input: json,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });
    process.stdout.write(output);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`viz render failed: ${msg}\n`);
    process.stderr.write('Falling back to JSON output:\n\n');
    process.stdout.write(json + '\n');
  }

  return 0;
}
