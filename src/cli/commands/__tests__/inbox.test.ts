/**
 * Tests for the tmesh inbox CLI command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';
import { createSignal } from '../../../core/signal';
import { deliverSignal } from '../../../core/transport';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let originalEnv: string | undefined;

function makeAndDeliver(sender: string, content: string, home: string) {
  const result = createSignal({
    sender,
    target: 'bob',
    type: 'message',
    content,
  });
  if (!result.ok) throw new Error(result.error.message);
  // Deliver to bob's node-local inbox (same as the home for testing)
  return deliverSignal(result.value, home);
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-inbox-'));
  originalEnv = process.env['TMESH_HOME'];
  process.env['TMESH_HOME'] = tempDir;
});

afterEach(async () => {
  if (originalEnv !== undefined) {
    process.env['TMESH_HOME'] = originalEnv;
  } else {
    delete process.env['TMESH_HOME'];
  }
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// inbox command
// ---------------------------------------------------------------------------

describe('inbox command', () => {
  test('shows empty inbox message when no signals', async () => {
    await ensureHome(tempDir);
    await writeIdentity('bob', tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'inbox']);
    expect(exitCode).toBe(0);
  });

  test('lists signals in inbox', async () => {
    await ensureHome(tempDir);
    await writeIdentity('bob', tempDir);

    // Deliver signals to this node's own home (simulating received signals)
    await makeAndDeliver('alice', 'hello bob', tempDir);
    await makeAndDeliver('charlie', 'hey bob', tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'inbox']);
    expect(exitCode).toBe(0);
  });
});
