/**
 * Tests for CLI command registry.
 */
import { describe, expect, test } from 'bun:test';
import { registerCommand, getCommand } from '../registry';

describe('registry', () => {
  test('registers and retrieves a command', () => {
    const handler = async () => 0;
    registerCommand('test-registry', handler);
    expect(getCommand('test-registry')).toBe(handler);
  });

  test('returns undefined for unregistered command', () => {
    expect(getCommand('nonexistent-cmd')).toBeUndefined();
  });
});
