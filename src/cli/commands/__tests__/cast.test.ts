/**
 * Tests for the tmesh cast CLI command (channel-targeted broadcast).
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
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-cast-'));
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
// cast command
// ---------------------------------------------------------------------------

describe('cast command', () => {
  test('delivers signal with channel to all known nodes', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'cast', 'deploys', 'v1.0 released']);
    expect(exitCode).toBe(0);

    const bobFiles = await readdir(join(tempDir, 'nodes', 'bob', 'inbox'));
    expect(bobFiles.length).toBe(1);

    const signal = JSON.parse(await readFile(join(tempDir, 'nodes', 'bob', 'inbox', bobFiles[0]!), 'utf-8'));
    expect(signal.channel).toBe('deploys');
    expect(signal.content).toBe('v1.0 released');
    expect(signal.target).toBe('*');
  });

  test('fails without enough arguments', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'cast', 'deploys']);
    expect(exitCode).toBe(1);
  });
});
