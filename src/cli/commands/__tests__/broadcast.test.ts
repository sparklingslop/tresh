/**
 * Tests for the tmesh broadcast CLI command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-broadcast-'));
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
// broadcast command
// ---------------------------------------------------------------------------

describe('broadcast command', () => {
  test('delivers signal to all known nodes', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    // Create node directories for bob and charlie (simulating known peers)
    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });
    await mkdir(join(tempDir, 'nodes', 'charlie', 'inbox'), { recursive: true });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'broadcast', 'hello everyone']);
    expect(exitCode).toBe(0);

    // Check both inboxes received the signal
    const bobFiles = await readdir(join(tempDir, 'nodes', 'bob', 'inbox'));
    expect(bobFiles.length).toBe(1);

    const charlieFiles = await readdir(join(tempDir, 'nodes', 'charlie', 'inbox'));
    expect(charlieFiles.length).toBe(1);

    // Verify content
    const bobSignal = JSON.parse(await readFile(join(tempDir, 'nodes', 'bob', 'inbox', bobFiles[0]!), 'utf-8'));
    expect(bobSignal.target).toBe('*');
    expect(bobSignal.content).toBe('hello everyone');
  });

  test('fails without message argument', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'broadcast']);
    expect(exitCode).toBe(1);
  });

  test('fails without identity', async () => {
    await ensureHome(tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'broadcast', 'hello']);
    expect(exitCode).toBe(1);
  });

  test('succeeds even with no known nodes', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    // No nodes directory at all

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'broadcast', 'hello void']);
    expect(exitCode).toBe(0);
  });
});
