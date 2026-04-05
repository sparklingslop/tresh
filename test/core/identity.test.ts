/**
 * Tests for src/core/identity.ts
 *
 * Covers: ensureHome, writeIdentity, readIdentity, resolveSessionIdentity.
 * TDD -- these tests are written before implementation.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  ensureHome,
  writeIdentity,
  readIdentity,
  resolveSessionIdentity,
} from '../../src/core/identity';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'tmesh-identity-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

/** Shorthand for the .tmesh directory inside tmpDir. */
function home(): string {
  return join(tmpDir, '.tmesh');
}

// ---------------------------------------------------------------------------
// ensureHome
// ---------------------------------------------------------------------------

describe('ensureHome', () => {
  it('creates the .tmesh directory when it does not exist', async () => {
    const h = home();
    expect(existsSync(h)).toBe(false);

    const result = await ensureHome(h);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(h);
    }
    expect(existsSync(h)).toBe(true);
  });

  it('succeeds when the directory already exists', async () => {
    const h = home();
    await mkdir(h, { recursive: true });

    const result = await ensureHome(h);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(h);
    }
  });

  it('creates nested parent directories as needed', async () => {
    const nested = join(tmpDir, 'deep', 'nested', '.tmesh');

    const result = await ensureHome(nested);

    expect(result.ok).toBe(true);
    expect(existsSync(nested)).toBe(true);
  });

  it('returns Err when path is on a read-only filesystem', async () => {
    // Use a path that cannot be created (null byte in path)
    const badPath = join('/dev/null', '.tmesh');

    const result = await ensureHome(badPath);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});

// ---------------------------------------------------------------------------
// writeIdentity
// ---------------------------------------------------------------------------

describe('writeIdentity', () => {
  beforeEach(async () => {
    await mkdir(home(), { recursive: true });
  });

  it('writes a valid identity to the identity file', async () => {
    const result = await writeIdentity('nano-mesh', home());

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The branded value should equal the input string
      expect(String(result.value)).toBe('nano-mesh');
    }

    const contents = await readFile(join(home(), 'identity'), 'utf-8');
    expect(contents.trim()).toBe('nano-mesh');
  });

  it('accepts identity with dots, hyphens, and underscores', async () => {
    const cases = [
      'agent.v2',
      'my-agent',
      'my_agent',
      'a',
      'A',
      '0',
      'Agent123.foo-bar_baz',
    ];

    for (const id of cases) {
      const result = await writeIdentity(id, home());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(String(result.value)).toBe(id);
      }
    }
  });

  it('returns Err for empty string', async () => {
    const result = await writeIdentity('', home());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toMatch(/empty/i);
    }
  });

  it('returns Err for identity starting with a dot', async () => {
    const result = await writeIdentity('.hidden', home());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('returns Err for identity starting with a hyphen', async () => {
    const result = await writeIdentity('-dashed', home());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('returns Err for identity starting with an underscore', async () => {
    const result = await writeIdentity('_under', home());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('returns Err for identity with spaces', async () => {
    const result = await writeIdentity('has space', home());

    expect(result.ok).toBe(false);
  });

  it('returns Err for identity with special characters', async () => {
    const invalid = ['foo@bar', 'a/b', 'x:y', 'hello!', 'a b', 'tab\there'];

    for (const id of invalid) {
      const result = await writeIdentity(id, home());
      expect(result.ok).toBe(false);
    }
  });

  it('overwrites an existing identity', async () => {
    await writeIdentity('first-identity', home());
    const result = await writeIdentity('second-identity', home());

    expect(result.ok).toBe(true);

    const contents = await readFile(join(home(), 'identity'), 'utf-8');
    expect(contents.trim()).toBe('second-identity');
  });

  it('writes atomically (temp file + rename)', async () => {
    // After a successful write, no temp files should remain in the home dir
    await writeIdentity('atomic-test', home());

    const { readdirSync } = await import('node:fs');
    const files = readdirSync(home());

    // Only the identity file should exist (no .tmp or partial files)
    const nonIdentityFiles = files.filter(
      (f) => f !== 'identity' && !f.startsWith('.'),
    );
    expect(nonIdentityFiles).toEqual([]);
  });

  it('returns Err when home directory does not exist', async () => {
    const nonExistent = join(tmpDir, 'does-not-exist');

    const result = await writeIdentity('test', nonExistent);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});

// ---------------------------------------------------------------------------
// readIdentity
// ---------------------------------------------------------------------------

describe('readIdentity', () => {
  beforeEach(async () => {
    await mkdir(home(), { recursive: true });
  });

  it('reads identity from file', async () => {
    await writeFile(join(home(), 'identity'), 'nano-cortex');

    const result = await readIdentity(home());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(String(result.value)).toBe('nano-cortex');
    }
  });

  it('trims whitespace from identity', async () => {
    await writeFile(join(home(), 'identity'), '  nano-cortex  \n');

    const result = await readIdentity(home());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(String(result.value)).toBe('nano-cortex');
    }
  });

  it('trims newlines from identity', async () => {
    await writeFile(join(home(), 'identity'), 'my-agent\n\n');

    const result = await readIdentity(home());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(String(result.value)).toBe('my-agent');
    }
  });

  it('returns Err when identity file does not exist', async () => {
    const result = await readIdentity(home());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toMatch(/not found|no such|does not exist/i);
    }
  });

  it('returns Err when home directory does not exist', async () => {
    const result = await readIdentity(join(tmpDir, 'nonexistent'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('returns Err when identity file is empty', async () => {
    await writeFile(join(home(), 'identity'), '');

    const result = await readIdentity(home());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('returns Err when identity file contains only whitespace', async () => {
    await writeFile(join(home(), 'identity'), '   \n\t  \n');

    const result = await readIdentity(home());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('returns Err when file contains invalid identity characters', async () => {
    await writeFile(join(home(), 'identity'), 'invalid identity!');

    const result = await readIdentity(home());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('handles identity written by writeIdentity round-trip', async () => {
    const writeResult = await writeIdentity('round-trip-test', home());
    expect(writeResult.ok).toBe(true);

    const readResult = await readIdentity(home());
    expect(readResult.ok).toBe(true);

    if (writeResult.ok && readResult.ok) {
      expect(String(readResult.value)).toBe(String(writeResult.value));
    }
  });
});

// ---------------------------------------------------------------------------
// resolveSessionIdentity
// ---------------------------------------------------------------------------

describe('resolveSessionIdentity', () => {
  it('returns TMESH_IDENTITY env var when set', () => {
    const env = new Map([['TMESH_IDENTITY', 'env-identity']]);

    const result = resolveSessionIdentity(env, 'file-identity');

    expect(result).toBe('env-identity');
  });

  it('returns file identity when TMESH_IDENTITY is not set', () => {
    const env = new Map<string, string>();

    const result = resolveSessionIdentity(env, 'file-identity');

    expect(result).toBe('file-identity');
  });

  it('returns null when neither env var nor file identity exists', () => {
    const env = new Map<string, string>();

    const result = resolveSessionIdentity(env, null);

    expect(result).toBeNull();
  });

  it('prefers TMESH_IDENTITY over file identity', () => {
    const env = new Map([['TMESH_IDENTITY', 'from-env']]);

    const result = resolveSessionIdentity(env, 'from-file');

    expect(result).toBe('from-env');
  });

  it('returns file identity when TMESH_IDENTITY is empty string', () => {
    const env = new Map([['TMESH_IDENTITY', '']]);

    const result = resolveSessionIdentity(env, 'file-identity');

    expect(result).toBe('file-identity');
  });

  it('returns null when TMESH_IDENTITY is empty and no file identity', () => {
    const env = new Map([['TMESH_IDENTITY', '']]);

    const result = resolveSessionIdentity(env, null);

    expect(result).toBeNull();
  });

  it('ignores other environment variables', () => {
    const env = new Map([
      ['HOME', '/home/user'],
      ['TMESH_HOME', '/custom/home'],
      ['PATH', '/usr/bin'],
    ]);

    const result = resolveSessionIdentity(env, 'file-id');

    expect(result).toBe('file-id');
  });

  it('is a pure function (no side effects)', () => {
    const env = new Map([['TMESH_IDENTITY', 'pure-test']]);
    const envCopy = new Map(env);

    resolveSessionIdentity(env, 'file');

    // Env map should not be mutated
    expect(env).toEqual(envCopy);
  });

  it('handles TMESH_IDENTITY with whitespace-only value', () => {
    const env = new Map([['TMESH_IDENTITY', '   ']]);

    const result = resolveSessionIdentity(env, 'fallback');

    // Whitespace-only should be treated as unset
    expect(result).toBe('fallback');
  });
});
