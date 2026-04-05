/**
 * Tests for the tmesh wire format.
 */

import { describe, test, expect } from 'bun:test';
import { formatWireMessage, parseWireMessage, WIRE_PREFIX } from '../wire';

describe('formatWireMessage', () => {
  test('produces parseable wire format', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'tmesh-hq',
      to: 'nano-research',
      type: 'message',
      channel: 'default',
      content: 'Status check. What are you working on?',
    });

    expect(wire).toContain(WIRE_PREFIX);
    expect(wire).toContain('tmesh-hq');
    expect(wire).toContain('nano-research');
    expect(wire).toContain('Status check');
  });

  test('includes reply instruction', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'tmesh-hq',
      to: 'nano-research',
      type: 'command',
      channel: 'default',
      content: 'Do something',
    });

    expect(wire).toContain('tmesh send tmesh-hq');
  });

  test('truncates long content', () => {
    const long = 'x'.repeat(500);
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'alice',
      to: 'bob',
      type: 'message',
      channel: 'default',
      content: long,
    });

    expect(wire.length).toBeLessThan(600);
  });

  test('handles special characters safely', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'alice',
      to: 'bob',
      type: 'message',
      channel: 'default',
      content: 'Contains "quotes" and <angles>',
    });

    expect(wire).toContain('quotes');
  });
});

describe('parseWireMessage', () => {
  test('round-trips through format and parse', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'tmesh-hq',
      to: 'nano-research',
      type: 'message',
      channel: 'default',
      content: 'Hello from the mesh',
    });

    const parsed = parseWireMessage(wire);
    expect(parsed).not.toBeNull();
    expect(parsed!.from).toBe('tmesh-hq');
    expect(parsed!.to).toBe('nano-research');
    expect(parsed!.type).toBe('message');
    expect(parsed!.content).toContain('Hello from the mesh');
  });

  test('returns null for non-tmesh text', () => {
    expect(parseWireMessage('just normal text')).toBeNull();
    expect(parseWireMessage('')).toBeNull();
  });

  test('parses wire with command type', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'alice',
      to: 'bob',
      type: 'command',
      channel: 'ops',
      content: 'deploy now',
    });

    const parsed = parseWireMessage(wire);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('command');
  });
});
