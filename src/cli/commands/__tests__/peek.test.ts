/**
 * Tests for the tmesh peek CLI command.
 *
 * Since peek calls tmux which may not be available in CI,
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
  tempDir = await mkdtemp(join(tmpdir(), 'tmesh-peek-cmd-'));
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
// peek command
// ---------------------------------------------------------------------------

describe('peek command', () => {
  test('fails without session argument', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'peek']);
    expect(exitCode).toBe(1);
  });

  test('fails with invalid session name', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'peek', 'bad;session']);
    expect(exitCode).toBe(1);
  });

  test('fails with session name containing dollar signs', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'peek', '$evil']);
    expect(exitCode).toBe(1);
  });

  test('fails gracefully when tmux is not available or session missing', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'peek', 'nonexistent-session-xyz']);
    expect(exitCode).toBe(1);
  });

  test('validates --lines flag is a positive number', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'peek', 'nonexistent-session-xyz', '--lines', '0']);
    expect(exitCode).toBe(1);
  });
});
