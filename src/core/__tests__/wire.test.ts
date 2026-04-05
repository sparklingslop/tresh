/**
 * Tests for the tmesh wire format (display layer).
 */

import { describe, test, expect } from 'bun:test';
import { formatWireMessage, parseWireMessage, WIRE_PREFIX } from '../wire';

describe('formatWireMessage', () => {
  test('produces single-line output', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'hello',
    });
    expect(wire).not.toContain('\n');
  });

  test('starts with [tmesh prefix', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'hello',
    });
    expect(wire.startsWith(WIRE_PREFIX)).toBe(true);
  });

  test('includes sender identity', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'tmesh-hq', to: 'bob',
      type: 'message', channel: 'default', content: 'hello',
    });
    expect(wire).toContain('from tmesh-hq');
  });

  test('includes content', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'Hello from the mesh',
    });
    expect(wire).toContain('Hello from the mesh');
  });

  test('includes reply instruction with sender name', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'tmesh-hq', to: 'bob',
      type: 'message', channel: 'default', content: 'hi',
    });
    expect(wire).toContain('Reply: tmesh send tmesh-hq');
  });

  test('has no angle brackets or pipes', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'test',
    });
    expect(wire).not.toContain('<');
    expect(wire).not.toContain('>');
    expect(wire).not.toContain('|');
  });

  test('has no quotes in the header', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'test',
    });
    const header = wire.slice(0, wire.indexOf(']') + 1);
    expect(header).not.toContain('"');
    expect(header).not.toContain("'");
  });

  test('truncates long content', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'alice', to: 'bob',
      type: 'message', channel: 'default', content: 'x'.repeat(500),
    });
    expect(wire.length).toBeLessThan(500);
  });
});

describe('parseWireMessage', () => {
  test('round-trips through format and parse', () => {
    const wire = formatWireMessage({
      id: '01ABC', from: 'tmesh-hq', to: 'nano-research',
      type: 'command', channel: 'default', content: 'Hello from the mesh',
    });

    const parsed = parseWireMessage(wire);
    expect(parsed).not.toBeNull();
    expect(parsed!.from).toBe('tmesh-hq');
    expect(parsed!.content).toContain('Hello from the mesh');
  });

  test('returns null for non-tmesh text', () => {
    expect(parseWireMessage('just normal text')).toBeNull();
    expect(parseWireMessage('')).toBeNull();
  });
});
