/**
 * Tests for the tmesh ping CLI command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-ping-'));
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
// ping command
// ---------------------------------------------------------------------------

describe('ping command', () => {
  test('sends a ping signal to target node', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'ping', 'bob']);
    expect(exitCode).toBe(0);

    // Verify ping signal landed in target inbox
    const files = await readdir(join(tempDir, 'nodes', 'bob', 'inbox'));
    expect(files.length).toBe(1);
  });

  test('fails without target argument', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'ping']);
    expect(exitCode).toBe(1);
  });

  test('fails without identity', async () => {
    await ensureHome(tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'ping', 'bob']);
    expect(exitCode).toBe(1);
  });
});
