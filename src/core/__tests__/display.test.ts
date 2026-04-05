/**
 * Tests for the message display formatter.
 */

import { describe, test, expect } from 'bun:test';
import { formatOutbound, formatInbound } from '../display';

describe('formatOutbound', () => {
  test('uses [tmesh] prefix with full ISO timestamp', () => {
    const out = formatOutbound({
      target: 'nano-research', content: 'hello',
      timestamp: '2026-04-05T14:19:12.000Z', status: 'delivered',
    });
    expect(out).toMatch(/^\[tmesh 2026-04-05 14:19:12\]/);
  });

  test('shows --> arrow and target', () => {
    const out = formatOutbound({
      target: 'nano-research', content: 'hello',
      timestamp: '2026-04-05T14:19:12.000Z', status: 'delivered',
    });
    expect(out).toContain('--> nano-research:');
  });

  test('includes content and status', () => {
    const out = formatOutbound({
      target: 'bob', content: 'test message',
      timestamp: '2026-04-05T14:00:00.000Z', status: 'delivered + injected',
    });
    expect(out).toContain('test message');
    expect(out).toContain('(delivered + injected)');
  });

  test('is single line', () => {
    const out = formatOutbound({
      target: 'bob', content: 'hello',
      timestamp: '2026-04-05T14:00:00.000Z', status: 'ok',
    });
    expect(out).not.toContain('\n');
  });
});

describe('formatInbound', () => {
  test('uses [tmesh] prefix with full ISO timestamp', () => {
    const out = formatInbound({
      sender: 'tmesh-hq', content: 'hello',
      timestamp: '2026-04-05T14:19:12.000Z', type: 'message',
    });
    expect(out).toMatch(/^\[tmesh 2026-04-05 14:19:12\]/);
  });

  test('shows <-- arrow and sender', () => {
    const out = formatInbound({
      sender: 'tmesh-hq', content: 'hello',
      timestamp: '2026-04-05T14:19:12.000Z', type: 'command',
    });
    expect(out).toContain('<-- tmesh-hq');
  });

  test('includes type and content', () => {
    const out = formatInbound({
      sender: 'alice', content: 'deploy now',
      timestamp: '2026-04-05T14:00:00.000Z', type: 'event',
    });
    expect(out).toContain('[event]');
    expect(out).toContain('deploy now');
  });

  test('is single line', () => {
    const out = formatInbound({
      sender: 'alice', content: 'hi',
      timestamp: '2026-04-05T14:00:00.000Z', type: 'message',
    });
    expect(out).not.toContain('\n');
  });

  test('includes channel when not default', () => {
    const out = formatInbound({
      sender: 'alice', content: 'v1 shipped',
      timestamp: '2026-04-05T14:00:00.000Z', type: 'event', channel: 'deploys',
    });
    expect(out).toContain('#deploys');
  });

  test('omits channel when default', () => {
    const out = formatInbound({
      sender: 'alice', content: 'hello',
      timestamp: '2026-04-05T14:00:00.000Z', type: 'message', channel: 'default',
    });
    expect(out).not.toContain('#');
  });

  test('omits channel when undefined', () => {
    const out = formatInbound({
      sender: 'alice', content: 'hello',
      timestamp: '2026-04-05T14:00:00.000Z', type: 'message',
    });
    expect(out).not.toContain('#');
  });
});

describe('formatOutbound channel', () => {
  test('includes channel when not default', () => {
    const out = formatOutbound({
      target: 'bob', content: 'v1 shipped',
      timestamp: '2026-04-05T14:00:00.000Z', status: 'sent', channel: 'deploys',
    });
    expect(out).toContain('#deploys');
  });

  test('omits channel when default', () => {
    const out = formatOutbound({
      target: 'bob', content: 'hello',
      timestamp: '2026-04-05T14:00:00.000Z', status: 'sent', channel: 'default',
    });
    expect(out).not.toContain('#');
  });
});

describe('parseLogLine', () => {
  test('parses outbound line', () => {
    const { parseLogLine } = require('../display');
    const parsed = parseLogLine('[tmesh 2026-04-05 14:30:00] --> bob: hello  (sent)');
    expect(parsed).not.toBeNull();
    expect(parsed!.direction).toBe('out');
    expect(parsed!.peer).toBe('bob');
  });

  test('parses inbound line', () => {
    const { parseLogLine } = require('../display');
    const parsed = parseLogLine('[tmesh 2026-04-05 14:30:00] <-- alice [message]: hey');
    expect(parsed).not.toBeNull();
    expect(parsed!.direction).toBe('in');
    expect(parsed!.peer).toBe('alice');
  });

  test('parses inbound with channel', () => {
    const { parseLogLine } = require('../display');
    const parsed = parseLogLine('[tmesh 2026-04-05 14:30:00] <-- alice [event] #deploys: v1 shipped');
    expect(parsed).not.toBeNull();
    expect(parsed!.channel).toBe('deploys');
  });

  test('returns null for non-log lines', () => {
    const { parseLogLine } = require('../display');
    expect(parseLogLine('random text')).toBeNull();
    expect(parseLogLine('')).toBeNull();
  });
});
