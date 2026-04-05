/**
 * Tests for the tmesh wire format (display layer).
 */

import { describe, test, expect } from 'bun:test';
import { formatWireMessage, parseWireMessage, WIRE_PREFIX, PROTOCOL_MD } from '../wire';

describe('formatWireMessage', () => {
  test('produces single-line output', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'hello',
      timestamp: '2026-04-05T16:30:00Z',
    });
    expect(wire).not.toContain('\n');
  });

  test('starts with [tmesh prefix', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'hello',
      timestamp: '2026-04-05T16:30:00Z',
    });
    expect(wire.startsWith(WIRE_PREFIX)).toBe(true);
  });

  test('includes timestamp in HH:MM format', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'hello',
      timestamp: '2026-04-05T16:30:00Z',
    });
    expect(wire).toContain('2026-04-05 16:30:00');
  });

  test('includes sender identity', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'tmesh-hq', to: 'bob',
      type: 'message', channel: 'default', content: 'hello',
      timestamp: '2026-04-05T16:30:00Z',
    });
    expect(wire).toContain('tmesh-hq:');
  });

  test('includes content', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'Hello from the mesh',
      timestamp: '2026-04-05T16:30:00Z',
    });
    expect(wire).toContain('Hello from the mesh');
  });

  test('has no pipes, angle brackets, or XML', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'test',
      timestamp: '2026-04-05T16:30:00Z',
    });
    expect(wire).not.toContain('|');
    expect(wire).not.toContain('<');
    expect(wire).not.toContain('>');
  });

  test('truncates long content with ellipsis', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'x'.repeat(200),
      timestamp: '2026-04-05T16:30:00Z',
    });
    expect(wire).toContain('...');
    expect(wire.length).toBeLessThan(200);
  });

  test('does not include reply instructions', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'hi',
      timestamp: '2026-04-05T16:30:00Z',
    });
    expect(wire).not.toContain('reply');
    expect(wire).not.toContain('Reply');
  });
});

describe('parseWireMessage', () => {
  test('round-trips through format and parse', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'tmesh-hq', to: 'nano-research',
      type: 'command', channel: 'default', content: 'Hello from the mesh',
      timestamp: '2026-04-05T16:30:00Z',
    });

    const parsed = parseWireMessage(wire);
    expect(parsed).not.toBeNull();
    expect(parsed!.from).toBe('tmesh-hq');
    expect(parsed!.time).toBe('2026-04-05 16:30:00');
    expect(parsed!.content).toContain('Hello from the mesh');
  });

  test('returns null for non-tmesh text', () => {
    expect(parseWireMessage('just normal text')).toBeNull();
    expect(parseWireMessage('')).toBeNull();
  });
});

describe('PROTOCOL_MD', () => {
  test('documents reply convention', () => {
    expect(PROTOCOL_MD).toContain('tmesh send');
  });

  test('documents inbox reading', () => {
    expect(PROTOCOL_MD).toContain('tmesh inbox');
  });

  test('documents signal format', () => {
    expect(PROTOCOL_MD).toContain('[tmesh');
  });
});
