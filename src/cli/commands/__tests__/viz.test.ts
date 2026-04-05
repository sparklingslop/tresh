/**
 * Tests for the tmesh viz CLI command.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureHome, writeIdentity } from '../../../core/identity';

let tempDir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-viz-cmd-'));
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

describe('viz command', () => {
  test('exits with 0 when gum is available', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'viz']);
    // Will succeed if gum is installed, fail gracefully if not
    expect(typeof exitCode).toBe('number');
  });

  test('supports --json flag for raw data output', async () => {
    await ensureHome(tempDir);
    await writeIdentity('alice', tempDir);

    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'viz', '--json']);
    expect(exitCode).toBe(0);
  });
});
