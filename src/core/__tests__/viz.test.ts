/**
 * Tests for the viz data collector.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { collectVizData } from '../viz';
import { ensureHome, writeIdentity } from '../identity';
import { createSignal } from '../signal';
import { deliverSignal } from '../transport';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-viz-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// collectVizData
// ---------------------------------------------------------------------------

describe('collectVizData', () => {
  test('returns data for node with no peers', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const data = await collectVizData(tempDir);

    expect(data.identity).toBe('alice');
    expect(data.nodes).toEqual([]);
    expect(data.inboxCount).toBe(0);
    expect(data.totalNodes).toBe(1);
  });

  test('includes known peers with inbox counts', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    // Create peer nodes
    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });
    await mkdir(join(tempDir, 'nodes', 'charlie', 'inbox'), { recursive: true });

    // Deliver a signal to bob
    const sig = createSignal({ sender: 'alice', target: 'bob', type: 'message', content: 'hi' });
    if (!sig.ok) throw new Error(sig.error.message);
    await deliverSignal(sig.value, join(tempDir, 'nodes', 'bob'));

    const data = await collectVizData(tempDir);

    expect(data.identity).toBe('alice');
    expect(data.totalNodes).toBe(3);
    expect(data.nodes.length).toBe(2);

    const bob = data.nodes.find((n) => n.identity === 'bob');
    expect(bob).toBeDefined();
    expect(bob!.inboxCount).toBe(1);

    const charlie = data.nodes.find((n) => n.identity === 'charlie');
    expect(charlie).toBeDefined();
    expect(charlie!.inboxCount).toBe(0);
  });

  test('counts own inbox signals', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    // Deliver signals to alice's node inbox (where send writes to)
    const aliceNodeHome = join(tempDir, 'nodes', 'alice');
    const s1 = createSignal({ sender: 'bob', target: 'alice', type: 'message', content: 'hey' });
    if (!s1.ok) throw new Error(s1.error.message);
    await deliverSignal(s1.value, aliceNodeHome);

    const s2 = createSignal({ sender: 'charlie', target: 'alice', type: 'event', content: 'ping' });
    if (!s2.ok) throw new Error(s2.error.message);
    await deliverSignal(s2.value, aliceNodeHome);

    const data = await collectVizData(tempDir);
    expect(data.inboxCount).toBe(2);
  });

  test('includes recent signals in inbox', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const aliceNodeHome = join(tempDir, 'nodes', 'alice');
    const sig = createSignal({ sender: 'bob', target: 'alice', type: 'message', content: 'hello alice' });
    if (!sig.ok) throw new Error(sig.error.message);
    await deliverSignal(sig.value, aliceNodeHome);

    const data = await collectVizData(tempDir);
    expect(data.recentSignals.length).toBe(1);
    expect(data.recentSignals[0]!.sender).toBe('bob');
    expect(data.recentSignals[0]!.content).toBe('hello alice');
  });

  test('handles missing identity gracefully', async () => {
    await ensureHome(tempDir);
    // No identity set

    const data = await collectVizData(tempDir);
    expect(data.identity).toBe('(unidentified)');
  });

  test('outputs valid JSON when serialized', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const data = await collectVizData(tempDir);
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);

    expect(parsed.identity).toBe('alice');
    expect(typeof parsed.totalNodes).toBe('number');
  });
});
