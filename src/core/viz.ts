/**
 * Viz data collector for tmesh.
 *
 * Collects all mesh state into a single JSON-serializable blob
 * that feeds the gum-powered visualization.
 * Zero dependencies -- only internal tmesh modules.
 */

import { resolveEffectiveIdentity, resolveNodeHome } from './identity';
import { listNodes } from './nodes';
import { listInbox } from './transport';
import type { TmeshSignal } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VizNode {
  readonly identity: string;
  readonly inboxCount: number;
}

export interface VizData {
  readonly identity: string;
  readonly nodes: readonly VizNode[];
  readonly inboxCount: number;
  readonly recentSignals: readonly TmeshSignal[];
  readonly totalNodes: number;
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

/**
 * Collect all mesh state for visualization.
 */
export async function collectVizData(home: string): Promise<VizData> {
  // Own identity
  const identityResult = await resolveEffectiveIdentity(home);
  const identity = identityResult.ok ? identityResult.value : '(unidentified)';

  // Own inbox: at nodes/{myIdentity}/inbox
  const myNodeHome = identityResult.ok ? resolveNodeHome(identity, home) : home;
  const inboxResult = await listInbox(myNodeHome);
  const ownSignals = inboxResult.ok ? inboxResult.value : [];

  // Known peers (excluding self)
  const nodeNames = await listNodes(home);
  const nodes: VizNode[] = [];

  for (const name of nodeNames) {
    if (name === identity) continue; // skip self
    const peerInbox = await listInbox(`${home}/nodes/${name}`);
    const count = peerInbox.ok ? peerInbox.value.length : 0;
    nodes.push({ identity: name, inboxCount: count });
  }

  // Recent signals (last 5 from own inbox)
  const recentSignals = ownSignals.slice(-5);

  return {
    identity,
    nodes,
    inboxCount: ownSignals.length,
    recentSignals,
    totalNodes: 1 + nodes.length,
    timestamp: new Date().toISOString(),
  };
}
