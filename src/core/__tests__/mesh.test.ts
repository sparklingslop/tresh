/**
 * Tests for the createTmesh() factory API.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createTmesh } from '../mesh';
import { deliverSignal } from '../transport';
import { createSignal } from '../signal';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-mesh-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// createTmesh
// ---------------------------------------------------------------------------

describe('createTmesh', () => {
  test('initializes with identity and creates home directory', async () => {
    const mesh = await createTmesh({
      identity: 'alice',
      home: join(tempDir, 'alice'),
    });

    expect(mesh.identity).toBe('alice');
  });

  test('send() delivers signal to target node', async () => {
    const aliceHome = join(tempDir, 'alice');
    const mesh = await createTmesh({
      identity: 'alice',
      home: aliceHome,
    });

    // Create target node directory
    await mkdir(join(aliceHome, 'nodes', 'bob', 'inbox'), { recursive: true });

    const signalId = await mesh.send('bob', {
      type: 'message',
      content: 'hello bob',
    });

    expect(signalId).toBeTruthy();
    expect(typeof signalId).toBe('string');

    // Verify delivery
    const files = await readdir(join(aliceHome, 'nodes', 'bob', 'inbox'));
    expect(files.length).toBe(1);

    const content = JSON.parse(await readFile(join(aliceHome, 'nodes', 'bob', 'inbox', files[0]!), 'utf-8'));
    expect(content.sender).toBe('alice');
    expect(content.content).toBe('hello bob');
  });

  test('broadcast() delivers to all known nodes', async () => {
    const aliceHome = join(tempDir, 'alice');
    const mesh = await createTmesh({
      identity: 'alice',
      home: aliceHome,
    });

    await mkdir(join(aliceHome, 'nodes', 'bob', 'inbox'), { recursive: true });
    await mkdir(join(aliceHome, 'nodes', 'charlie', 'inbox'), { recursive: true });

    const signalId = await mesh.broadcast({
      type: 'event',
      channel: 'deploys',
      content: 'v1.0 shipped',
    });

    expect(signalId).toBeTruthy();

    const bobFiles = await readdir(join(aliceHome, 'nodes', 'bob', 'inbox'));
    const charlieFiles = await readdir(join(aliceHome, 'nodes', 'charlie', 'inbox'));
    expect(bobFiles.length).toBe(1);
    expect(charlieFiles.length).toBe(1);
  });

  test('discover() lists known nodes', async () => {
    const aliceHome = join(tempDir, 'alice');
    const mesh = await createTmesh({
      identity: 'alice',
      home: aliceHome,
    });

    await mkdir(join(aliceHome, 'nodes', 'bob'), { recursive: true });
    await mkdir(join(aliceHome, 'nodes', 'charlie'), { recursive: true });

    const nodes = await mesh.discover();
    expect(nodes.sort()).toEqual(['bob', 'charlie']);
  });

  test('inbox() lists received signals', async () => {
    const aliceHome = join(tempDir, 'alice');
    const mesh = await createTmesh({
      identity: 'alice',
      home: aliceHome,
    });

    // Deliver a signal to alice's inbox
    const sig = createSignal({
      sender: 'bob',
      target: 'alice',
      type: 'message',
      content: 'hi alice',
    });
    if (!sig.ok) throw new Error(sig.error.message);
    await deliverSignal(sig.value, aliceHome);

    const signals = await mesh.inbox();
    expect(signals.length).toBe(1);
    expect(signals[0]!.content).toBe('hi alice');
  });

  test('ack() removes signal from inbox', async () => {
    const aliceHome = join(tempDir, 'alice');
    const mesh = await createTmesh({
      identity: 'alice',
      home: aliceHome,
    });

    const sig = createSignal({
      sender: 'bob',
      target: 'alice',
      type: 'message',
      content: 'ack me',
    });
    if (!sig.ok) throw new Error(sig.error.message);
    await deliverSignal(sig.value, aliceHome);

    await mesh.ack(sig.value.id);

    const signals = await mesh.inbox();
    expect(signals.length).toBe(0);
  });

  test('watch() yields incoming signals', async () => {
    const aliceHome = join(tempDir, 'alice');
    const mesh = await createTmesh({
      identity: 'alice',
      home: aliceHome,
    });

    const received: string[] = [];

    // Deliver signal after short delay
    setTimeout(async () => {
      const sig = createSignal({
        sender: 'bob',
        target: 'alice',
        type: 'message',
        content: 'watch-test',
      });
      if (!sig.ok) return;
      await deliverSignal(sig.value, aliceHome);
    }, 50);

    const ac = new AbortController();
    for await (const signal of mesh.watch({ signal: ac.signal })) {
      received.push(signal.content);
      if (received.length >= 1) break;
    }

    expect(received).toEqual(['watch-test']);
  });

  test('send() with channel option', async () => {
    const aliceHome = join(tempDir, 'alice');
    const mesh = await createTmesh({
      identity: 'alice',
      home: aliceHome,
    });

    await mkdir(join(aliceHome, 'nodes', 'bob', 'inbox'), { recursive: true });

    await mesh.send('bob', {
      type: 'event',
      content: 'deploy complete',
      channel: 'ci',
    });

    const files = await readdir(join(aliceHome, 'nodes', 'bob', 'inbox'));
    const content = JSON.parse(await readFile(join(aliceHome, 'nodes', 'bob', 'inbox', files[0]!), 'utf-8'));
    expect(content.channel).toBe('ci');
  });

  test('send() with ttl option', async () => {
    const aliceHome = join(tempDir, 'alice');
    const mesh = await createTmesh({
      identity: 'alice',
      home: aliceHome,
    });

    await mkdir(join(aliceHome, 'nodes', 'bob', 'inbox'), { recursive: true });

    await mesh.send('bob', {
      type: 'message',
      content: 'ephemeral',
      ttl: 60,
    });

    const files = await readdir(join(aliceHome, 'nodes', 'bob', 'inbox'));
    const content = JSON.parse(await readFile(join(aliceHome, 'nodes', 'bob', 'inbox', files[0]!), 'utf-8'));
    expect(content.ttl).toBe(60);
  });
});
