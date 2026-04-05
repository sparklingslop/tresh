/**
 * Tests for the tmesh log command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';
import { appendOutbound, appendInbound } from '../../../core/conversation';

let tempDir: string;
let originalEnv: string | undefined;
let originalIdentity: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-log-'));
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

describe('log command', () => {
  test('shows empty message for no conversation', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    await mkdir(join(tempDir, 'nodes', 'alice'), { recursive: true });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'log']);
    expect(exitCode).toBe(0);
  });

  test('shows conversation with both directions', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    const nodeHome = join(tempDir, 'nodes', 'alice');
    await mkdir(nodeHome, { recursive: true });

    await appendOutbound(nodeHome, { target: 'bob', content: 'hello', timestamp: '2026-04-05T14:00:00Z' });
    await appendInbound(nodeHome, { sender: 'bob', content: 'hey', timestamp: '2026-04-05T14:01:00Z', type: 'message' });

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'log']);
    expect(exitCode).toBe(0);
  });
});
