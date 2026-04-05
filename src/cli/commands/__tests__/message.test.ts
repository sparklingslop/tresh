/**
 * Tests for the tmesh message CLI command (unified send + inject + notify).
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
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-message-'));
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

describe('message command', () => {
  test('delivers signal to target inbox', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'message', 'bob', 'Hello from alice']);
    expect(exitCode).toBe(0);

    const files = await readdir(join(tempDir, 'nodes', 'bob', 'inbox'));
    expect(files.length).toBe(1);

    const signal = JSON.parse(await readFile(join(tempDir, 'nodes', 'bob', 'inbox', files[0]!), 'utf-8'));
    expect(signal.sender).toBe('alice');
    expect(signal.target).toBe('bob');
    expect(signal.content).toBe('Hello from alice');
  });

  test('fails without enough arguments', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'message', 'bob']);
    expect(exitCode).toBe(1);
  });

  test('fails without identity', async () => {
    delete process.env['TMESH_IDENTITY'];
    await ensureHome(tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'message', 'bob', 'hello']);
    expect(exitCode).toBe(1);
  });
});
