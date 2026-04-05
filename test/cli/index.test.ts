/**
 * Tests for src/cli/index.ts
 *
 * Arg parser and command dispatch.
 */

import { describe, expect, test } from 'bun:test';
import { parseArgs, run, registerCommand } from '../../src/cli/index';
import type { CommandHandler } from '../../src/cli/index';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  test('returns Err when no command provided', () => {
    const result = parseArgs(['bun', 'script.ts']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('No command');
    }
  });

  test('parses bare command', () => {
    const result = parseArgs(['bun', 'script.ts', 'ls']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.command).toBe('ls');
      expect(result.value.args).toEqual([]);
      expect(result.value.flags.size).toBe(0);
    }
  });

  test('parses command with positional args', () => {
    const result = parseArgs(['bun', 'script.ts', 'identify', 'agent-1']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.command).toBe('identify');
      expect(result.value.args).toEqual(['agent-1']);
    }
  });

  test('parses --flag value as string', () => {
    const result = parseArgs(['bun', 'script.ts', 'ls', '--format', 'json']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags.get('format')).toBe('json');
    }
  });

  test('parses --flag without value as boolean true', () => {
    const result = parseArgs(['bun', 'script.ts', 'ls', '--verbose']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags.get('verbose')).toBe(true);
    }
  });

  test('parses mixed positional args and flags', () => {
    const result = parseArgs([
      'bun', 'script.ts', 'identify', 'my-agent', '--force', '--format', 'json',
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.command).toBe('identify');
      expect(result.value.args).toEqual(['my-agent']);
      expect(result.value.flags.get('force')).toBe(true);
      expect(result.value.flags.get('format')).toBe('json');
    }
  });

  test('two consecutive boolean flags', () => {
    const result = parseArgs(['bun', 'script.ts', 'ls', '--all', '--verbose']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags.get('all')).toBe(true);
      expect(result.value.flags.get('verbose')).toBe(true);
    }
  });

  test('skips first 2 elements of argv', () => {
    const result = parseArgs(['/usr/bin/bun', '/path/to/cli/index.ts', 'who']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.command).toBe('who');
    }
  });
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

describe('run', () => {
  test('returns 1 for empty argv', async () => {
    const code = await run(['bun', 'script.ts']);
    expect(code).toBe(1);
  });

  test('returns 0 for help command', async () => {
    const code = await run(['bun', 'script.ts', 'help']);
    expect(code).toBe(0);
  });

  test('returns 0 for --help flag', async () => {
    const code = await run(['bun', 'script.ts', 'anything', '--help']);
    expect(code).toBe(0);
  });

  test('returns 1 for unknown command', async () => {
    const code = await run(['bun', 'script.ts', 'nonexistent']);
    expect(code).toBe(1);
  });

  test('dispatches to registered command handler', async () => {
    const handler: CommandHandler = async (args, _flags) => {
      return args.length > 0 ? 0 : 42;
    };
    registerCommand('test-cmd', handler);

    const code = await run(['bun', 'script.ts', 'test-cmd']);
    expect(code).toBe(42);

    const code2 = await run(['bun', 'script.ts', 'test-cmd', 'arg1']);
    expect(code2).toBe(0);
  });
});
