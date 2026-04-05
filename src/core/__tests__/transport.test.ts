/**
 * Tests for the file-based signal transport layer.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createSignal } from '../signal';
import {
  deliverSignal,
  listInbox,
  readSignalFile,
  ackSignal,
  cleanExpired,
  ensureInbox,
} from '../transport';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;

function makeTestSignal(overrides?: {
  sender?: string;
  target?: string;
  type?: 'message' | 'command' | 'event';
  content?: string;
  ttl?: number;
}) {
  const result = createSignal({
    sender: overrides?.sender ?? 'alice',
    target: overrides?.target ?? 'bob',
    type: overrides?.type ?? 'message',
    content: overrides?.content ?? 'hello world',
    ...(overrides?.ttl !== undefined ? { ttl: overrides.ttl } : {}),
  });
  if (!result.ok) throw new Error(`Failed to create test signal: ${result.error.message}`);
  return result.value;
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-transport-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// ensureInbox
// ---------------------------------------------------------------------------

describe('ensureInbox', () => {
  test('creates inbox directory if missing', async () => {
    const home = join(tempDir, 'node-a');
    const result = await ensureInbox(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(join(home, 'inbox'));
    }
    const entries = await readdir(home);
    expect(entries).toContain('inbox');
  });

  test('succeeds if inbox already exists', async () => {
    const home = join(tempDir, 'node-b');
    await mkdir(join(home, 'inbox'), { recursive: true });
    const result = await ensureInbox(home);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deliverSignal
// ---------------------------------------------------------------------------

describe('deliverSignal', () => {
  test('writes signal JSON to target inbox', async () => {
    const targetHome = join(tempDir, 'bob');
    const signal = makeTestSignal();

    const result = await deliverSignal(signal, targetHome);
    expect(result.ok).toBe(true);

    const files = await readdir(join(targetHome, 'inbox'));
    expect(files.length).toBe(1);
    expect(files[0]!.endsWith('.json')).toBe(true);

    const content = await readFile(join(targetHome, 'inbox', files[0]!), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.id).toBe(signal.id);
    expect(parsed.sender).toBe('alice');
    expect(parsed.content).toBe('hello world');
  });

  test('filename contains signal ID', async () => {
    const targetHome = join(tempDir, 'bob');
    const signal = makeTestSignal();

    await deliverSignal(signal, targetHome);

    const files = await readdir(join(targetHome, 'inbox'));
    expect(files[0]!).toContain(signal.id);
  });

  test('delivers multiple signals without overwrite', async () => {
    const targetHome = join(tempDir, 'bob');
    const s1 = makeTestSignal({ content: 'first' });
    const s2 = makeTestSignal({ content: 'second' });

    await deliverSignal(s1, targetHome);
    await deliverSignal(s2, targetHome);

    const files = await readdir(join(targetHome, 'inbox'));
    expect(files.length).toBe(2);
  });

  test('atomic write -- no partial reads', async () => {
    const targetHome = join(tempDir, 'bob');
    const signal = makeTestSignal({ content: 'atomic-test' });

    await deliverSignal(signal, targetHome);

    const files = await readdir(join(targetHome, 'inbox'));
    // No temp files should remain
    const tempFiles = files.filter((f) => f.startsWith('.'));
    expect(tempFiles.length).toBe(0);
  });

  test('also writes to sender outbox when outbox option set', async () => {
    const targetHome = join(tempDir, 'bob');
    const senderHome = join(tempDir, 'alice');
    const signal = makeTestSignal();

    const result = await deliverSignal(signal, targetHome, { senderHome });
    expect(result.ok).toBe(true);

    // Signal in target inbox
    const inboxFiles = await readdir(join(targetHome, 'inbox'));
    expect(inboxFiles.length).toBe(1);

    // Copy in sender outbox
    const outboxFiles = await readdir(join(senderHome, 'outbox'));
    expect(outboxFiles.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// listInbox
// ---------------------------------------------------------------------------

describe('listInbox', () => {
  test('returns empty array for empty inbox', async () => {
    const home = join(tempDir, 'empty');
    await mkdir(join(home, 'inbox'), { recursive: true });

    const result = await listInbox(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  test('returns signals sorted by ULID (chronological)', async () => {
    const home = join(tempDir, 'bob');
    const s1 = makeTestSignal({ content: 'first' });

    // Small delay to ensure different ULID timestamps
    await new Promise((r) => setTimeout(r, 2));
    const s2 = makeTestSignal({ content: 'second' });

    await deliverSignal(s1, home);
    await deliverSignal(s2, home);

    const result = await listInbox(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(2);
      expect(result.value[0]!.content).toBe('first');
      expect(result.value[1]!.content).toBe('second');
    }
  });

  test('creates inbox dir if missing', async () => {
    const home = join(tempDir, 'missing');

    const result = await listInbox(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  test('ignores non-json files', async () => {
    const home = join(tempDir, 'bob');
    await mkdir(join(home, 'inbox'), { recursive: true });
    await writeFile(join(home, 'inbox', 'README.txt'), 'not a signal');

    const signal = makeTestSignal();
    await deliverSignal(signal, home);

    const result = await listInbox(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(1);
    }
  });

  test('skips malformed JSON files gracefully', async () => {
    const home = join(tempDir, 'bob');
    await mkdir(join(home, 'inbox'), { recursive: true });
    await writeFile(join(home, 'inbox', 'BAD-signal.json'), '{ broken json }}}');

    const signal = makeTestSignal();
    await deliverSignal(signal, home);

    const result = await listInbox(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// readSignalFile
// ---------------------------------------------------------------------------

describe('readSignalFile', () => {
  test('reads a signal by ID', async () => {
    const home = join(tempDir, 'bob');
    const signal = makeTestSignal({ content: 'read-me' });
    await deliverSignal(signal, home);

    const result = await readSignalFile(signal.id, home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe('read-me');
      expect(result.value.id).toBe(signal.id);
    }
  });

  test('returns error for nonexistent signal', async () => {
    const home = join(tempDir, 'bob');
    await mkdir(join(home, 'inbox'), { recursive: true });

    const result = await readSignalFile('00000000000000000000000000', home);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ackSignal
// ---------------------------------------------------------------------------

describe('ackSignal', () => {
  test('removes signal from inbox', async () => {
    const home = join(tempDir, 'bob');
    const signal = makeTestSignal();
    await deliverSignal(signal, home);

    const ack = await ackSignal(signal.id, home);
    expect(ack.ok).toBe(true);

    const files = await readdir(join(home, 'inbox'));
    expect(files.length).toBe(0);
  });

  test('returns error for nonexistent signal', async () => {
    const home = join(tempDir, 'bob');
    await mkdir(join(home, 'inbox'), { recursive: true });

    const result = await ackSignal('00000000000000000000000000', home);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cleanExpired
// ---------------------------------------------------------------------------

describe('cleanExpired', () => {
  test('removes signals past TTL', async () => {
    const home = join(tempDir, 'bob');
    // Create a signal with TTL of 0 (already expired)
    const signal = makeTestSignal({ ttl: 0 });

    await deliverSignal(signal, home);

    // Small delay to ensure it's expired
    await new Promise((r) => setTimeout(r, 10));

    const result = await cleanExpired(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(1); // 1 signal cleaned
    }

    const files = await readdir(join(home, 'inbox'));
    expect(files.length).toBe(0);
  });

  test('keeps signals without TTL', async () => {
    const home = join(tempDir, 'bob');
    const signal = makeTestSignal(); // no TTL
    await deliverSignal(signal, home);

    const result = await cleanExpired(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
    }

    const files = await readdir(join(home, 'inbox'));
    expect(files.length).toBe(1);
  });

  test('keeps signals within TTL', async () => {
    const home = join(tempDir, 'bob');
    const signal = makeTestSignal({ ttl: 3600 }); // 1 hour TTL
    await deliverSignal(signal, home);

    const result = await cleanExpired(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
    }
  });

  test('handles empty inbox', async () => {
    const home = join(tempDir, 'bob');
    await mkdir(join(home, 'inbox'), { recursive: true });

    const result = await cleanExpired(home);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
    }
  });
});
