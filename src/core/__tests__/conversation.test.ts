/**
 * Tests for the conversation log.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { appendOutbound, appendInbound, readLog } from '../conversation';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-convo-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('appendOutbound', () => {
  test('creates log file and appends --> line', async () => {
    const nodeHome = join(tempDir, 'nodes', 'alice');
    await mkdir(nodeHome, { recursive: true });

    await appendOutbound(nodeHome, {
      target: 'bob',
      content: 'hello bob',
      timestamp: '2026-04-05T14:30:00.000Z',
    });

    const log = await readFile(join(nodeHome, 'conversation.log'), 'utf-8');
    expect(log).toContain('-->');
    expect(log).toContain('bob');
    expect(log).toContain('hello bob');
    expect(log).toContain('2026-04-05 14:30:00');
  });

  test('appends multiple lines', async () => {
    const nodeHome = join(tempDir, 'nodes', 'alice');
    await mkdir(nodeHome, { recursive: true });

    await appendOutbound(nodeHome, {
      target: 'bob', content: 'first', timestamp: '2026-04-05T14:30:00.000Z',
    });
    await appendOutbound(nodeHome, {
      target: 'charlie', content: 'second', timestamp: '2026-04-05T14:31:00.000Z',
    });

    const log = await readFile(join(nodeHome, 'conversation.log'), 'utf-8');
    const lines = log.trim().split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('first');
    expect(lines[1]).toContain('second');
  });
});

describe('appendInbound', () => {
  test('appends <-- line', async () => {
    const nodeHome = join(tempDir, 'nodes', 'bob');
    await mkdir(nodeHome, { recursive: true });

    await appendInbound(nodeHome, {
      sender: 'alice',
      content: 'hello from alice',
      timestamp: '2026-04-05T14:30:00.000Z',
      type: 'message',
    });

    const log = await readFile(join(nodeHome, 'conversation.log'), 'utf-8');
    expect(log).toContain('<--');
    expect(log).toContain('alice');
    expect(log).toContain('hello from alice');
  });
});

describe('readLog', () => {
  test('returns all lines from log', async () => {
    const nodeHome = join(tempDir, 'nodes', 'alice');
    await mkdir(nodeHome, { recursive: true });

    await appendOutbound(nodeHome, {
      target: 'bob', content: 'outgoing', timestamp: '2026-04-05T14:30:00.000Z',
    });
    await appendInbound(nodeHome, {
      sender: 'bob', content: 'incoming', timestamp: '2026-04-05T14:31:00.000Z', type: 'message',
    });

    const lines = await readLog(nodeHome);
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('-->');
    expect(lines[1]).toContain('<--');
  });

  test('returns empty array for missing log', async () => {
    const nodeHome = join(tempDir, 'nodes', 'new');
    await mkdir(nodeHome, { recursive: true });

    const lines = await readLog(nodeHome);
    expect(lines).toEqual([]);
  });

  test('supports tail option', async () => {
    const nodeHome = join(tempDir, 'nodes', 'alice');
    await mkdir(nodeHome, { recursive: true });

    for (let i = 0; i < 10; i++) {
      await appendOutbound(nodeHome, {
        target: 'bob', content: `msg ${i}`, timestamp: `2026-04-05T14:${String(i).padStart(2, '0')}:00.000Z`,
      });
    }

    const last3 = await readLog(nodeHome, { tail: 3 });
    expect(last3.length).toBe(3);
    expect(last3[0]).toContain('msg 7');
    expect(last3[2]).toContain('msg 9');
  });
});
