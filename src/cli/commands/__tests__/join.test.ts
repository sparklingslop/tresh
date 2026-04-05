/**
 * Tests for tmesh join command.
 *
 * `tmesh join <identity>` -- set identity for current session
 * `tmesh join <session> <identity>` -- init a remote session
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

describe('tmesh join', () => {
  let tempDir: string;
  let originalHome: string | undefined;
  let originalIdentity: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tmesh-join-'));
    originalHome = process.env['TMESH_HOME'];
    originalIdentity = process.env['TMESH_IDENTITY'];
    process.env['TMESH_HOME'] = tempDir;
    delete process.env['TMESH_IDENTITY'];
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env['TMESH_HOME'] = originalHome;
    } else {
      delete process.env['TMESH_HOME'];
    }
    if (originalIdentity !== undefined) {
      process.env['TMESH_IDENTITY'] = originalIdentity;
    } else {
      delete process.env['TMESH_IDENTITY'];
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('validates identity name format', () => {
    const { Identity } = require('../../../types');
    // Valid names
    expect(() => Identity('my-agent')).not.toThrow();
    expect(() => Identity('nano.cortex')).not.toThrow();
    expect(() => Identity('agent_1')).not.toThrow();

    // Invalid names
    expect(() => Identity('-bad')).toThrow();
    expect(() => Identity('.bad')).toThrow();
    expect(() => Identity('')).toThrow();
  });

  it('identify() creates home, writes identity file, creates inbox', async () => {
    const { identify } = await import('../../../core/identity');
    const result = await identify('test-node', tempDir);
    expect(result.ok).toBe(true);

    // Identity file written
    const identityContent = await readFile(join(tempDir, 'identity'), 'utf-8');
    expect(identityContent.trim()).toBe('test-node');

    // Inbox directory created
    expect(existsSync(join(tempDir, 'nodes', 'test-node', 'inbox'))).toBe(true);
  });

  it('rejects invalid identity characters', () => {
    const { Identity } = require('../../../types');
    expect(() => Identity('has space')).toThrow();
    expect(() => Identity('has;semicolon')).toThrow();
    expect(() => Identity('has$dollar')).toThrow();
  });
});
