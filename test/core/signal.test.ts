/**
 * Tests for src/core/signal.ts
 *
 * ULID generation, validation, timestamp decoding, and signal factory.
 * TDD -- these tests are written before the implementation exists.
 */

import { describe, expect, it } from 'bun:test';
import {
  generateUlid,
  isValidUlid,
  decodeUlidTimestamp,
  createSignal,
} from '../../src/core/signal';
import { Identity } from '../../src/types';
import type { Ulid, TmeshSignal } from '../../src/types';

// ---------------------------------------------------------------------------
// generateUlid
// ---------------------------------------------------------------------------

describe('generateUlid', () => {
  it('returns a 26-character string', () => {
    const id = generateUlid();
    expect(id).toHaveLength(26);
  });

  it('matches the Crockford base32 character set', () => {
    const id = generateUlid();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('produces unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUlid()));
    expect(ids.size).toBe(100);
  });

  it('is monotonically increasing for same-millisecond calls', () => {
    // Generate a batch rapidly so some land in the same millisecond
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      ids.push(generateUlid());
    }
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]! > ids[i - 1]!).toBe(true);
    }
  });

  it('encodes the current timestamp in the first 10 characters', () => {
    const before = Date.now();
    const id = generateUlid();
    const after = Date.now();

    const encoded = decodeUlidTimestamp(id);
    expect(encoded).toBeGreaterThanOrEqual(before);
    expect(encoded).toBeLessThanOrEqual(after);
  });

  it('returns a branded Ulid type', () => {
    const id: Ulid = generateUlid();
    // Type-level check -- if this compiles, the return type is correct.
    expect(typeof id).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// isValidUlid
// ---------------------------------------------------------------------------

describe('isValidUlid', () => {
  it('returns true for a valid ULID', () => {
    const id = generateUlid();
    expect(isValidUlid(id)).toBe(true);
  });

  it('returns true for a known valid ULID string', () => {
    expect(isValidUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidUlid('')).toBe(false);
  });

  it('returns false for a string that is too short', () => {
    expect(isValidUlid('01ARZ3NDEKTSV4RRFFQ69G5FA')).toBe(false);
  });

  it('returns false for a string that is too long', () => {
    expect(isValidUlid('01ARZ3NDEKTSV4RRFFQ69G5FAVX')).toBe(false);
  });

  it('returns false for lowercase characters', () => {
    expect(isValidUlid('01arz3ndektsv4rrffq69g5fav')).toBe(false);
  });

  it('returns false when containing excluded letters (I, L, O, U)', () => {
    // I is excluded from Crockford base32
    expect(isValidUlid('01ARZ3NDIKTSV4RRFFQ69G5FAV')).toBe(false);
    // L is excluded
    expect(isValidUlid('01ARZ3NDLKTSV4RRFFQ69G5FAV')).toBe(false);
    // O is excluded
    expect(isValidUlid('01ARZ3NDOKTSV4RRFFQ69G5FAV')).toBe(false);
    // U is excluded
    expect(isValidUlid('01ARZ3NDUKTSV4RRFFQ69G5FAV')).toBe(false);
  });

  it('returns false for strings with special characters', () => {
    expect(isValidUlid('01ARZ3NDEKTSV4RRFFQ69G5FA!')).toBe(false);
    expect(isValidUlid('01ARZ3NDEKTSV4-RFFQ69G5FAV')).toBe(false);
  });

  it('returns false for whitespace-only input', () => {
    expect(isValidUlid('   ')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// decodeUlidTimestamp
// ---------------------------------------------------------------------------

describe('decodeUlidTimestamp', () => {
  it('returns a positive number for a valid ULID', () => {
    const id = generateUlid();
    const ts = decodeUlidTimestamp(id);
    expect(ts).toBeGreaterThan(0);
  });

  it('returns a millisecond-precision epoch timestamp', () => {
    const before = Date.now();
    const id = generateUlid();
    const after = Date.now();
    const ts = decodeUlidTimestamp(id);

    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('decodes the same timestamp for ULIDs generated in the same millisecond', () => {
    // Generate two ULIDs as fast as possible
    const a = generateUlid();
    const b = generateUlid();
    const tsA = decodeUlidTimestamp(a);
    const tsB = decodeUlidTimestamp(b);

    // They should be at most 1ms apart (could be same ms or adjacent)
    expect(Math.abs(tsA - tsB)).toBeLessThanOrEqual(1);
  });

  it('only uses the first 10 characters for timestamp', () => {
    const id = generateUlid();
    const fullTs = decodeUlidTimestamp(id);
    // Modifying randomness portion (chars 10-25) should not affect timestamp
    const prefix = (id as string).slice(0, 10);
    const fakeRandom = 'AAAAAAAAAAAAAAAA';
    const modified = prefix + fakeRandom;
    const modifiedTs = decodeUlidTimestamp(modified);

    expect(modifiedTs).toBe(fullTs);
  });

  it('returns 0 for the zero ULID', () => {
    const zeroUlid = '00000000000000000000000000';
    expect(decodeUlidTimestamp(zeroUlid)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// createSignal
// ---------------------------------------------------------------------------

describe('createSignal', () => {
  const validSender = Identity('agent-alpha');
  const validTarget = Identity('agent-beta');

  describe('happy path', () => {
    it('creates a signal with all required fields', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'message',
        content: 'hello from alpha',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const signal = result.value;
      expect(signal.sender).toBe(validSender);
      expect(signal.target).toBe(validTarget);
      expect(signal.type).toBe('message');
      expect(signal.content).toBe('hello from alpha');
    });

    it('auto-generates a valid ULID as the signal id', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'message',
        content: 'test',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(isValidUlid(result.value.id)).toBe(true);
    });

    it('auto-generates an ISO 8601 timestamp', () => {
      const before = new Date().toISOString();
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'event',
        content: 'deploy-complete',
      });
      const after = new Date().toISOString();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ts = result.value.timestamp;
      // Must be parseable as a date
      expect(Number.isNaN(Date.parse(ts))).toBe(false);
      // Must be within the before/after window
      expect(ts >= before).toBe(true);
      expect(ts <= after).toBe(true);
    });

    it('defaults channel to "default" when not provided', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'message',
        content: 'test',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.channel).toBe('default');
    });

    it('uses the provided channel when specified', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'event',
        content: 'test',
        channel: 'deploys',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.channel).toBe('deploys');
    });

    it('passes through optional ttl', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'message',
        content: 'ephemeral',
        ttl: 60,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.ttl).toBe(60);
    });

    it('passes through optional replyTo', () => {
      const originalId = generateUlid();
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'message',
        content: 'reply',
        replyTo: originalId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.replyTo).toBe(originalId);
    });

    it('omits ttl and replyTo when not provided', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'message',
        content: 'minimal',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.ttl).toBeUndefined();
      expect(result.value.replyTo).toBeUndefined();
    });
  });

  describe('broadcast target', () => {
    it('accepts "*" as a broadcast target', () => {
      const result = createSignal({
        sender: validSender,
        target: '*',
        type: 'event',
        content: 'broadcast message',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.target).toBe('*');
    });
  });

  describe('signal types', () => {
    it('accepts "message" type', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'message',
        content: 'test',
      });
      expect(result.ok).toBe(true);
    });

    it('accepts "command" type', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'command',
        content: 'restart',
      });
      expect(result.ok).toBe(true);
    });

    it('accepts "event" type', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'event',
        content: 'deploy-started',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('error conditions', () => {
    it('returns Err for an empty sender identity', () => {
      const result = createSignal({
        sender: '' as any,
        target: validTarget,
        type: 'message',
        content: 'test',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('sender');
    });

    it('returns Err for a sender with invalid characters', () => {
      const result = createSignal({
        sender: '!invalid' as any,
        target: validTarget,
        type: 'message',
        content: 'test',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error).toBeInstanceOf(Error);
    });

    it('returns Err for a sender starting with a dot', () => {
      const result = createSignal({
        sender: '.hidden' as any,
        target: validTarget,
        type: 'message',
        content: 'test',
      });

      expect(result.ok).toBe(false);
    });

    it('returns Err for a sender starting with a hyphen', () => {
      const result = createSignal({
        sender: '-dashed' as any,
        target: validTarget,
        type: 'message',
        content: 'test',
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('uniqueness', () => {
    it('generates unique ids for multiple signals', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const result = createSignal({
          sender: validSender,
          target: validTarget,
          type: 'message',
          content: `msg-${i}`,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          ids.add(result.value.id);
        }
      }
      expect(ids.size).toBe(100);
    });

    it('generates monotonically increasing ids across signals', () => {
      const ids: string[] = [];
      for (let i = 0; i < 20; i++) {
        const result = createSignal({
          sender: validSender,
          target: validTarget,
          type: 'message',
          content: `msg-${i}`,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          ids.push(result.value.id);
        }
      }
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]! > ids[i - 1]!).toBe(true);
      }
    });
  });

  describe('return type shape', () => {
    it('returns a Result with a TmeshSignal on success', () => {
      const result = createSignal({
        sender: validSender,
        target: validTarget,
        type: 'message',
        content: 'test',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const signal: TmeshSignal = result.value;
      expect(signal).toHaveProperty('id');
      expect(signal).toHaveProperty('sender');
      expect(signal).toHaveProperty('target');
      expect(signal).toHaveProperty('type');
      expect(signal).toHaveProperty('channel');
      expect(signal).toHaveProperty('content');
      expect(signal).toHaveProperty('timestamp');
    });

    it('returns a Result with an Error on failure', () => {
      const result = createSignal({
        sender: '' as any,
        target: validTarget,
        type: 'message',
        content: 'test',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error).toBeInstanceOf(Error);
    });
  });
});
