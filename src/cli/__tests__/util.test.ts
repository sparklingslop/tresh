/**
 * Tests for shared CLI utilities.
 */

import { describe, it, expect } from 'bun:test';
import { resolveTmeshBin, isValidIdentity } from '../util';

describe('resolveTmeshBin', () => {
  it('returns a non-empty string', () => {
    const bin = resolveTmeshBin();
    expect(typeof bin).toBe('string');
    expect(bin.length).toBeGreaterThan(0);
  });
});

describe('isValidIdentity', () => {
  it('accepts valid identities', () => {
    expect(isValidIdentity('my-agent')).toBe(true);
    expect(isValidIdentity('nano.cortex')).toBe(true);
    expect(isValidIdentity('agent_1')).toBe(true);
    expect(isValidIdentity('a')).toBe(true);
  });

  it('rejects invalid identities', () => {
    expect(isValidIdentity('')).toBe(false);
    expect(isValidIdentity('-bad')).toBe(false);
    expect(isValidIdentity('.bad')).toBe(false);
    expect(isValidIdentity('has space')).toBe(false);
    expect(isValidIdentity('has;semicolon')).toBe(false);
  });
});
