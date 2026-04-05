/**
 * Tests for the node directory listing utility.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { listNodes } from '../nodes';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-nodes-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('listNodes', () => {
  test('returns empty array when no nodes/ directory', async () => {
    const nodes = await listNodes(tempDir);
    expect(nodes).toEqual([]);
  });

  test('returns node names from nodes/ subdirectories', async () => {
    await mkdir(join(tempDir, 'nodes', 'bob'), { recursive: true });
    await mkdir(join(tempDir, 'nodes', 'charlie'), { recursive: true });

    const nodes = await listNodes(tempDir);
    expect(nodes.sort()).toEqual(['bob', 'charlie']);
  });

  test('returns empty when nodes/ exists but is empty', async () => {
    await mkdir(join(tempDir, 'nodes'), { recursive: true });

    const nodes = await listNodes(tempDir);
    expect(nodes).toEqual([]);
  });
});
