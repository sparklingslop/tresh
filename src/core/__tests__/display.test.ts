/**
 * Tests for the message display formatter.
 */

import { describe, test, expect } from 'bun:test';
import { formatOutbound, formatInbound } from '../display';

describe('formatOutbound', () => {
  test('uses [tmesh] prefix with timestamp', () => {
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
  test('uses [tmesh] prefix with timestamp', () => {
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
});
