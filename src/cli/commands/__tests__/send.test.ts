/**
 * Tests for the consolidated tmesh send CLI command.
 *
 * Covers: direct send, broadcast (*), --channel, --type, --ping, --ttl
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
// send command (consolidated)
// ---------------------------------------------------------------------------

describe('send command', () => {
  test('delivers signal to target node inbox', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');

    const exitCode = await run(['node', 'tmesh', 'send', 'bob', 'hello world']);
    expect(exitCode).toBe(0);

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

  test('broadcast via * target delivers to all nodes', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    // Create two peer node inboxes
    await mkdir(join(tempDir, 'nodes', 'bob', 'inbox'), { recursive: true });
    await mkdir(join(tempDir, 'nodes', 'carol', 'inbox'), { recursive: true });

    const { run } = await import('../../index');

    const exitCode = await run(['node', 'tmesh', 'send', '*', 'hello everyone']);
    expect(exitCode).toBe(0);

    // Both nodes should have the signal
    const bobFiles = await readdir(join(tempDir, 'nodes', 'bob', 'inbox'));
    const carolFiles = await readdir(join(tempDir, 'nodes', 'carol', 'inbox'));
    expect(bobFiles.length).toBeGreaterThanOrEqual(1);
    expect(carolFiles.length).toBeGreaterThanOrEqual(1);
  });

  test('--ping sends a command-type ping with TTL 30', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');

    const exitCode = await run(['node', 'tmesh', 'send', 'bob', '--ping']);
    expect(exitCode).toBe(0);

    const targetInbox = join(tempDir, 'nodes', 'bob', 'inbox');
    const files = await readdir(targetInbox);
    expect(files.length).toBe(1);

    const content = JSON.parse(await readFile(join(targetInbox, files[0]!), 'utf-8'));
    expect(content.type).toBe('command');
    expect(content.content).toBe('ping');
    expect(content.ttl).toBe(30);
  });

  test('appends to sender conversation log', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    await mkdir(join(tempDir, 'nodes', 'alice', 'inbox'), { recursive: true });

    const { run } = await import('../../index');
    await run(['node', 'tmesh', 'send', 'bob', 'logged-msg']);

    const logPath = join(tempDir, 'nodes', 'alice', 'conversation.log');
    const logContent = await readFile(logPath, 'utf-8');
    expect(logContent).toContain('-->');
    expect(logContent).toContain('bob');
    expect(logContent).toContain('logged-msg');
  });
});
