/**
 * Tests for the tmesh send CLI command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-send-'));
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
// send command
// ---------------------------------------------------------------------------

describe('send command', () => {
  test('delivers signal to target node inbox', async () => {
    // Setup sender identity
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    // Import run after env is set
    const { run } = await import('../../index');

    const exitCode = await run(['node', 'tmesh', 'send', 'bob', 'hello world']);
    expect(exitCode).toBe(0);

    // Check target inbox
    const targetInbox = join(tempDir, 'nodes', 'bob', 'inbox');
    const files = await readdir(targetInbox);
    expect(files.length).toBe(1);

    const content = JSON.parse(await readFile(join(targetInbox, files[0]!), 'utf-8'));
    expect(content.sender).toBe('alice');
    expect(content.target).toBe('bob');
    expect(content.content).toBe('hello world');
    expect(content.type).toBe('message');
  });

  test('fails without identity', async () => {
    await ensureHome(tempDir);
    // No identity set

    const { run } = await import('../../index');

    const exitCode = await run(['node', 'tmesh', 'send', 'bob', 'hello']);
    expect(exitCode).toBe(1);
  });

  test('fails without enough arguments', async () => {
    const { run } = await import('../../index');

    const exitCode = await run(['node', 'tmesh', 'send', 'bob']);
    expect(exitCode).toBe(1);
  });

  test('supports --type flag', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');

    const exitCode = await run(['node', 'tmesh', 'send', 'bob', 'do-it', '--type', 'command']);
    expect(exitCode).toBe(0);

    const targetInbox = join(tempDir, 'nodes', 'bob', 'inbox');
    const files = await readdir(targetInbox);
    const content = JSON.parse(await readFile(join(targetInbox, files[0]!), 'utf-8'));
    expect(content.type).toBe('command');
  });

  test('supports --channel flag', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');

    const exitCode = await run(['node', 'tmesh', 'send', 'bob', 'deploy done', '--channel', 'deploys']);
    expect(exitCode).toBe(0);

    const targetInbox = join(tempDir, 'nodes', 'bob', 'inbox');
    const files = await readdir(targetInbox);
    const content = JSON.parse(await readFile(join(targetInbox, files[0]!), 'utf-8'));
    expect(content.channel).toBe('deploys');
  });

  test('writes copy to sender outbox', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');

    await run(['node', 'tmesh', 'send', 'bob', 'outbox-test']);

    const outboxFiles = await readdir(join(tempDir, 'outbox'));
    expect(outboxFiles.length).toBe(1);
  });
});
