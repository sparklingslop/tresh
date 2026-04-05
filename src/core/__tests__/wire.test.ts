/**
 * Tests for the tmesh wire format.
 */

import { describe, test, expect } from 'bun:test';
import { formatWireMessage, parseWireMessage, WIRE_PREFIX } from '../wire';

describe('formatWireMessage', () => {
  test('produces single-line output', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'tmesh-hq',
      to: 'nano-research',
      type: 'message',
      channel: 'default',
      content: 'Status check',
    });

    expect(wire).not.toContain('\n');
  });

  test('starts with [tmesh| prefix', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'alice',
      to: 'bob',
      type: 'message',
      channel: 'default',
      content: 'hello',
    });

    expect(wire.startsWith(WIRE_PREFIX)).toBe(true);
  });

  test('includes all metadata fields', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'tmesh-hq',
      to: 'nano-research',
      type: 'command',
      channel: 'ops',
      content: 'deploy',
    });

    expect(wire).toContain('from:tmesh-hq');
    expect(wire).toContain('to:nano-research');
    expect(wire).toContain('type:command');
    expect(wire).toContain('ch:ops');
    expect(wire).toContain('id:01ABC');
  });

  test('includes reply instruction with sender name', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'tmesh-hq',
      to: 'bob',
      type: 'message',
      channel: 'default',
      content: 'hello',
    });

    expect(wire).toContain('reply via: tmesh send tmesh-hq');
  });

  test('includes content', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'alice',
      to: 'bob',
      type: 'message',
      channel: 'default',
      content: 'Hello from the mesh',
    });

    expect(wire).toContain('Hello from the mesh');
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

    expect(wire.length).toBeLessThan(500);
  });

  test('has no quotes in header section', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'alice',
      to: 'bob',
      type: 'message',
      channel: 'default',
      content: 'test',
    });

    const header = wire.slice(0, wire.indexOf(']') + 1);
    expect(header).not.toContain('"');
    expect(header).not.toContain("'");
  });
});

describe('parseWireMessage', () => {
  test('round-trips through format and parse', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'tmesh-hq',
      to: 'nano-research',
      type: 'command',
      channel: 'default',
      content: 'Hello from the mesh',
    });

    const parsed = parseWireMessage(wire);
    expect(parsed).not.toBeNull();
    expect(parsed!.from).toBe('tmesh-hq');
    expect(parsed!.to).toBe('nano-research');
    expect(parsed!.type).toBe('command');
    expect(parsed!.content).toBe('Hello from the mesh');
    expect(parsed!.id).toBe('01ABC123DEF456GHJ789KLMNPQ');
  });

  test('returns null for non-tmesh text', () => {
    expect(parseWireMessage('just normal text')).toBeNull();
    expect(parseWireMessage('')).toBeNull();
  });

  test('parses channel field', () => {
    const wire = formatWireMessage({
      id: '01ABC123DEF456GHJ789KLMNPQ',
      from: 'alice',
      to: 'bob',
      type: 'event',
      channel: 'deploys',
      content: 'shipped',
    });

    const parsed = parseWireMessage(wire);
    expect(parsed!.channel).toBe('deploys');
  });
});
