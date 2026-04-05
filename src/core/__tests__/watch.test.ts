/**
 * Tests for the inbox watcher.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createSignal } from '../signal';
import { deliverSignal } from '../transport';
import { watchInbox } from '../watch';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;

function makeTestSignal(content: string) {
  const result = createSignal({
    sender: 'alice',
    target: 'bob',
    type: 'message',
    content,
  });
  if (!result.ok) throw new Error(`Failed to create test signal: ${result.error.message}`);
  return result.value;
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-watch-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// watchInbox
// ---------------------------------------------------------------------------

describe('watchInbox', () => {
  test('yields signals delivered after watch starts', async () => {
    const home = join(tempDir, 'bob');
    await mkdir(join(home, 'inbox'), { recursive: true });

    const watcher = watchInbox(home);
    const received: string[] = [];

    // Deliver a signal after a short delay
    setTimeout(async () => {
      const signal = makeTestSignal('watch-test-1');
      await deliverSignal(signal, home);
    }, 50);

    // Read one signal from the async iterator
    for await (const signal of watcher) {
      received.push(signal.content);
      if (received.length >= 1) break;
    }

    expect(received).toEqual(['watch-test-1']);
  });

  test('yields multiple signals in order', async () => {
    const home = join(tempDir, 'bob');
    await mkdir(join(home, 'inbox'), { recursive: true });

    const watcher = watchInbox(home);
    const received: string[] = [];

    setTimeout(async () => {
      const s1 = makeTestSignal('first');
      await deliverSignal(s1, home);
      await new Promise((r) => setTimeout(r, 20));
      const s2 = makeTestSignal('second');
      await deliverSignal(s2, home);
    }, 50);

    for await (const signal of watcher) {
      received.push(signal.content);
      if (received.length >= 2) break;
    }

    expect(received).toEqual(['first', 'second']);
  });

  test('AbortSignal stops the watcher', async () => {
    const home = join(tempDir, 'bob');
    await mkdir(join(home, 'inbox'), { recursive: true });

    const ac = new AbortController();
    const watcher = watchInbox(home, { signal: ac.signal });
    const received: string[] = [];

    // Abort after 100ms
    setTimeout(() => ac.abort(), 100);

    for await (const signal of watcher) {
      received.push(signal.content);
    }

    // Should exit cleanly with no signals (none were delivered)
    expect(received).toEqual([]);
  });

  test('creates inbox directory if missing', async () => {
    const home = join(tempDir, 'new-node');

    const ac = new AbortController();
    const watcher = watchInbox(home, { signal: ac.signal });

    // Deliver after watcher creates the inbox
    setTimeout(async () => {
      const signal = makeTestSignal('auto-created');
      await deliverSignal(signal, home);
    }, 50);

    setTimeout(() => ac.abort(), 200);

    const received: string[] = [];
    for await (const signal of watcher) {
      received.push(signal.content);
    }

    expect(received).toEqual(['auto-created']);
  });
});
