/**
 * Tests for tmesh identify command argument validation.
 */

import { describe, expect, it } from 'bun:test';
import { validateIdentifyArgs } from '../../src/cli/commands/identify';

describe('validateIdentifyArgs', () => {
  it('accepts a valid identity name', () => {
    const result = validateIdentifyArgs(['my-agent']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('my-agent');
    }
  });

  it('rejects empty args', () => {
    const result = validateIdentifyArgs([]);
    expect(result.ok).toBe(false);
  });

  it('rejects identity with spaces', () => {
    const result = validateIdentifyArgs(['bad name']);
    expect(result.ok).toBe(false);
  });

  it('accepts dots, hyphens, underscores', () => {
    const result = validateIdentifyArgs(['my.agent-v2_test']);
    expect(result.ok).toBe(true);
  });

  it('rejects identity starting with dot', () => {
    const result = validateIdentifyArgs(['.hidden']);
    expect(result.ok).toBe(false);
  });

  it('rejects identity starting with hyphen', () => {
    const result = validateIdentifyArgs(['-bad']);
    expect(result.ok).toBe(false);
  });

  it('rejects special characters', () => {
    const result = validateIdentifyArgs(['foo@bar']);
    expect(result.ok).toBe(false);
  });
});
