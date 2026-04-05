/**
 * Tests for the tmesh @ CLI command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';

let tempDir: string;
let originalEnv: string | undefined;
let originalIdentity: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-at-'));
  originalEnv = process.env['TMESH_HOME'];
  originalIdentity = process.env['TMESH_IDENTITY'];
  process.env['TMESH_HOME'] = tempDir;
  process.env['TMESH_IDENTITY'] = 'alice';
});

afterEach(async () => {
  if (originalEnv !== undefined) process.env['TMESH_HOME'] = originalEnv;
  else delete process.env['TMESH_HOME'];
  if (originalIdentity !== undefined) process.env['TMESH_IDENTITY'] = originalIdentity;
  else delete process.env['TMESH_IDENTITY'];
  await rm(tempDir, { recursive: true, force: true });
});

describe('@ command', () => {
  test('delivers to all @mentioned nodes', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });
    await mkdir(join(tempDir, 'nodes', 'charlie', 'inbox'), { recursive: true });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', '@', 'Hey @bob and @charlie, mesh is live']);
    expect(exitCode).toBe(0);

    const bobFiles = await readdir(join(tempDir, 'nodes', 'bob', 'inbox'));
    expect(bobFiles.length).toBe(1);

    const charlieFiles = await readdir(join(tempDir, 'nodes', 'charlie', 'inbox'));
    expect(charlieFiles.length).toBe(1);

    const signal = JSON.parse(await readFile(join(tempDir, 'nodes', 'bob', 'inbox', bobFiles[0]!), 'utf-8'));
    expect(signal.sender).toBe('alice');
    expect(signal.content).toContain('@bob');
    expect(signal.content).toContain('@charlie');
  });

  test('fails without message argument', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', '@']);
    expect(exitCode).toBe(1);
  });

  test('fails when no @mentions found in message', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', '@', 'no mentions here']);
    expect(exitCode).toBe(1);
  });

  test('skips self-mention', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', '@', 'Hey @alice and @bob']);
    expect(exitCode).toBe(0);

    // alice shouldn't get her own message
    const aliceInbox = join(tempDir, 'nodes', 'alice', 'inbox');
    try {
      const files = await readdir(aliceInbox);
      expect(files.length).toBe(0);
    } catch {
      // directory doesn't exist = no self-delivery, correct
    }

    const bobFiles = await readdir(join(tempDir, 'nodes', 'bob', 'inbox'));
    expect(bobFiles.length).toBe(1);
  });
});
