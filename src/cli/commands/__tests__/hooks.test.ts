/**
 * Tests for the tmesh hooks CLI command.
 */

import { describe, test, expect } from 'bun:test';

describe('hooks command', () => {
  test('fails without subcommand', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'hooks']);
    expect(exitCode).toBe(1);
  });

  test('rejects unknown subcommand', async () => {
    const { run } = await import('../../index');
    const exitCode = await run(['node', 'tmesh', 'hooks', 'bogus']);
    expect(exitCode).toBe(1);
  });
});
