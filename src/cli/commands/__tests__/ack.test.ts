/**
 * Tests for the tmesh ack CLI command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
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

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-ack-'));
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
// ack command
// ---------------------------------------------------------------------------

describe('ack command', () => {
  test('removes signal from inbox', async () => {
    await ensureHome(tempDir);
    await writeIdentity('bob', tempDir);

    const signalResult = createSignal({
      sender: 'alice',
      target: 'bob',
      type: 'message',
      content: 'ack me',
    });
    if (!signalResult.ok) throw new Error(signalResult.error.message);
    await deliverSignal(signalResult.value, tempDir);

    // Verify signal is in inbox
    let files = await readdir(join(tempDir, 'inbox'));
    expect(files.length).toBe(1);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'ack', signalResult.value.id]);
    expect(exitCode).toBe(0);

    // Verify signal is removed
    files = await readdir(join(tempDir, 'inbox'));
    expect(files.length).toBe(0);
  });

  test('fails for nonexistent signal', async () => {
    await ensureHome(tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'ack', '00000000000000000000000000']);
    expect(exitCode).toBe(1);
  });

  test('fails without signal ID argument', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'ack']);
    expect(exitCode).toBe(1);
  });
});
