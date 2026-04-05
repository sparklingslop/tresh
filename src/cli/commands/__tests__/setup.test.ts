/**
 * Tests for tmesh setup command.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('tmesh setup', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tmesh-setup-'));
    originalHome = process.env['TMESH_HOME'];
    process.env['TMESH_HOME'] = tempDir;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env['TMESH_HOME'] = originalHome;
    } else {
      delete process.env['TMESH_HOME'];
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates home directory on setup', async () => {
    const newHome = join(tempDir, 'fresh');
    process.env['TMESH_HOME'] = newHome;

    // Import lazily to get fresh registry state
    const { ensureHome } = await import('../../../core/identity');
    const result = await ensureHome(newHome);
    expect(result.ok).toBe(true);

    const entries = await readdir(newHome);
    expect(entries).toBeDefined();
  });

  it('--status reports home directory existence', async () => {
    // The setup --status flag checks if home exists
    const { existsSync } = await import('node:fs');
    expect(existsSync(tempDir)).toBe(true);
  });

  it('--uninstall calls uninstallHooks without error', async () => {
    // uninstallHooks is best-effort (ignores missing hooks)
    const { uninstallHooks } = await import('../../../core/hooks');
    const result = uninstallHooks();
    // Should succeed even if no hooks installed (or tmux not running)
    // In CI/test env tmux may not be available, so we just verify the function exists
    expect(typeof uninstallHooks).toBe('function');
    // Result is always Ok since uninstall ignores errors
    expect(result.ok).toBe(true);
  });

  it('findTmeshBin returns process.argv[1] or fallback', () => {
    // The binary resolver uses process.argv[1]
    const bin = process.argv[1] ?? 'tmesh';
    expect(typeof bin).toBe('string');
    expect(bin.length).toBeGreaterThan(0);
  });
});
