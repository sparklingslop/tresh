/**
 * Tests for tmesh register/deregister commands.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome } from '../../../core/identity';

let tempDir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-register-'));
  originalEnv = process.env['TMESH_HOME'];
  process.env['TMESH_HOME'] = tempDir;
});

afterEach(async () => {
  if (originalEnv !== undefined) process.env['TMESH_HOME'] = originalEnv;
  else delete process.env['TMESH_HOME'];
  await rm(tempDir, { recursive: true, force: true });
});

describe('register command', () => {
  test('creates node directory with inbox', async () => {
    await ensureHome(tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'register', 'new-session']);
    expect(exitCode).toBe(0);

    const inboxExists = await access(join(tempDir, 'nodes', 'new-session', 'inbox')).then(() => true).catch(() => false);
    expect(inboxExists).toBe(true);
  });

  test('fails without session name', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'register']);
    expect(exitCode).toBe(1);
  });
});

describe('deregister command', () => {
  test('succeeds even if node directory does not exist', async () => {
    await ensureHome(tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'deregister', 'nonexistent']);
    expect(exitCode).toBe(0);
  });

  test('fails without session name', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'deregister']);
    expect(exitCode).toBe(1);
  });
});
