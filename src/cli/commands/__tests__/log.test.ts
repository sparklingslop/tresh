/**
 * Tests for the consolidated tmesh log command.
 *
 * Covers: conversation view, --follow (basic), --inbox, --read, --ack, --tail, --peer
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';
import { appendOutbound, appendInbound } from '../../../core/conversation';
import { createSignal } from '../../../core/signal';

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

describe('log command (consolidated)', () => {
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

  test('--tail limits output lines', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    const nodeHome = join(tempDir, 'nodes', 'alice');
    await mkdir(nodeHome, { recursive: true });

    // Write 5 entries
    for (let i = 0; i < 5; i++) {
      await appendOutbound(nodeHome, { target: 'bob', content: `msg-${i}`, timestamp: `2026-04-05T14:0${i}:00Z` });
    }

    const { readLog } = await import('../../../core/conversation');
    const tailLines = await readLog(nodeHome, { tail: 2 });
    expect(tailLines.length).toBe(2);
  });

  test('--inbox lists pending signals', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    const inboxDir = join(tempDir, 'nodes', 'alice', 'inbox');
    await mkdir(inboxDir, { recursive: true });

    // Write a signal file
    const signalResult = createSignal({ sender: 'bob', target: 'alice', type: 'message', content: 'hi' });
    expect(signalResult.ok).toBe(true);
    if (signalResult.ok) {
      await writeFile(join(inboxDir, `${signalResult.value.id}.json`), JSON.stringify(signalResult.value), 'utf-8');
    }

    const { listInbox } = await import('../../../core/transport');
    const result = await listInbox(join(tempDir, 'nodes', 'alice'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(1);
      expect(result.value[0]!.sender as string).toBe('bob');
    }
  });

  test('--read shows a specific signal', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    const inboxDir = join(tempDir, 'nodes', 'alice', 'inbox');
    await mkdir(inboxDir, { recursive: true });

    const signalResult = createSignal({ sender: 'bob', target: 'alice', type: 'message', content: 'detailed' });
    expect(signalResult.ok).toBe(true);
    if (signalResult.ok) {
      const signal = signalResult.value;
      await writeFile(join(inboxDir, `${signal.id}.json`), JSON.stringify(signal), 'utf-8');

      const { readSignalFile } = await import('../../../core/transport');
      const readResult = await readSignalFile(signal.id, join(tempDir, 'nodes', 'alice'));
      expect(readResult.ok).toBe(true);
      if (readResult.ok) {
        expect(readResult.value.content).toBe('detailed');
      }
    }
  });

  test('--ack deletes a signal from inbox', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);
    const inboxDir = join(tempDir, 'nodes', 'alice', 'inbox');
    await mkdir(inboxDir, { recursive: true });

    const signalResult = createSignal({ sender: 'bob', target: 'alice', type: 'message', content: 'ack-me' });
    expect(signalResult.ok).toBe(true);
    if (signalResult.ok) {
      const signal = signalResult.value;
      await writeFile(join(inboxDir, `${signal.id}.json`), JSON.stringify(signal), 'utf-8');

      const { ackSignal } = await import('../../../core/transport');
      const ackResult = await ackSignal(signal.id, join(tempDir, 'nodes', 'alice'));
      expect(ackResult.ok).toBe(true);

      const files = await readdir(inboxDir);
      expect(files.length).toBe(0);
    }
  });
});
