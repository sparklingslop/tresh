/**
 * Tests for the tmesh inject CLI command.
 *
 * Since inject calls tmux which may not be available in CI,
 * we test argument validation and error handling.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-inject-cmd-'));
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
// inject command
// ---------------------------------------------------------------------------

describe('inject command', () => {
  test('fails without enough arguments', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'inject']);
    expect(exitCode).toBe(1);
  });

  test('fails with only session argument (no message)', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'inject', 'my-session']);
    expect(exitCode).toBe(1);
  });

  test('fails with invalid session name', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'inject', 'bad;session', 'hello']);
    expect(exitCode).toBe(1);
  });

  test('fails with session name containing backticks', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'inject', '`evil`', 'hello']);
    expect(exitCode).toBe(1);
  });

  test('fails gracefully when tmux is not available or session missing', async () => {
    const { run } = await import('../../index');
    // This will fail because the session doesn't exist, but should not crash
    const exitCode = await run(['node', 'tmesh', 'inject', 'nonexistent-session-xyz', 'hello']);
    expect(exitCode).toBe(1);
  });
});
