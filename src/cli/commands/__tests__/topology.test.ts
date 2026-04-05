/**
 * Tests for the tmesh topology CLI command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-topology-'));
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
// topology command
// ---------------------------------------------------------------------------

describe('topology command', () => {
  test('shows current node when no peers exist', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'topology']);
    expect(exitCode).toBe(0);
  });

  test('shows known nodes from nodes/ directory', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    // Create peer node directories
    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });
    await mkdir(join(tempDir, 'nodes', 'charlie', 'inbox'), { recursive: true });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'topology']);
    expect(exitCode).toBe(0);
  });

  test('works without identity (shows warning)', async () => {
    await ensureHome(tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'topology']);
    expect(exitCode).toBe(0);
  });
});
