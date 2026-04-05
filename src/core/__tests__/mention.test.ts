/**
 * Tests for the @-mention parser.
 */

import { describe, test, expect } from 'bun:test';
import { parseMentions } from '../mention';

describe('parseMentions', () => {
  test('extracts single @mention', () => {
    expect(parseMentions('Hey @nano-cortex')).toEqual(['nano-cortex']);
  });

  test('extracts multiple @mentions', () => {
    const result = parseMentions('Hey @nano-cortex and @nano-mesh, deploy ready');
    expect(result).toEqual(['nano-cortex', 'nano-mesh']);
  });

  test('extracts @mention at start of string', () => {
    expect(parseMentions('@alice hello')).toEqual(['alice']);
  });

  test('extracts @mention at end of string', () => {
    expect(parseMentions('hello @bob')).toEqual(['bob']);
  });

  test('returns empty array when no mentions', () => {
    expect(parseMentions('no mentions here')).toEqual([]);
  });

  test('handles identity with dots', () => {
    expect(parseMentions('ping @agent.alpha')).toEqual(['agent.alpha']);
  });

  test('handles identity with underscores', () => {
    expect(parseMentions('ping @my_agent')).toEqual(['my_agent']);
  });

  test('handles identity with hyphens', () => {
    expect(parseMentions('ping @nano-cortex-2')).toEqual(['nano-cortex-2']);
  });

  test('deduplicates repeated mentions', () => {
    expect(parseMentions('@alice hey @alice')).toEqual(['alice']);
  });

  test('does not match email addresses', () => {
    expect(parseMentions('email me at user@example.com')).toEqual([]);
  });

  test('handles @mention after punctuation', () => {
    expect(parseMentions('done. @nano-mesh check this')).toEqual(['nano-mesh']);
  });

  test('handles @mention after newline', () => {
    expect(parseMentions('line1\n@alice line2')).toEqual(['alice']);
  });

  test('handles @mention in parentheses', () => {
    expect(parseMentions('(cc @bob)')).toEqual(['bob']);
  });

  test('does not match bare @ symbol', () => {
    expect(parseMentions('@ alone')).toEqual([]);
  });

  test('handles mixed valid and invalid', () => {
    expect(parseMentions('@valid and user@email.com and @also-valid')).toEqual(['valid', 'also-valid']);
  });

  test('respects identity pattern (must start with alphanumeric)', () => {
    expect(parseMentions('@-invalid')).toEqual([]);
    expect(parseMentions('@.invalid')).toEqual([]);
    expect(parseMentions('@_invalid')).toEqual([]);
  });
});
