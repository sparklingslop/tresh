/**
 * Tests for the message display formatter.
 */

import { describe, test, expect } from 'bun:test';
import { formatOutbound, formatInbound } from '../display';

describe('formatOutbound', () => {
  test('shows arrow, target, timestamp, and content', () => {
    const out = formatOutbound({
      target: 'nano-research',
      content: 'Hello from tmesh-hq',
      timestamp: '2026-04-05T14:19:12.000Z',
      status: 'delivered + injected',
    });
    expect(out).toContain('-->');
    expect(out).toContain('nano-research');
    expect(out).toContain('2026-04-05 14:19:12');
    expect(out).toContain('Hello from tmesh-hq');
    expect(out).toContain('delivered + injected');
  });

  test('handles offline status', () => {
    const out = formatOutbound({
      target: 'bob',
      content: 'hello',
      timestamp: '2026-04-05T14:00:00.000Z',
      status: 'delivered (offline)',
    });
    expect(out).toContain('offline');
  });
});

describe('formatInbound', () => {
  test('shows arrow, sender, timestamp, and content', () => {
    const out = formatInbound({
      sender: 'tmesh-hq',
      content: 'Status check',
      timestamp: '2026-04-05T14:19:12.000Z',
      type: 'command',
    });
    expect(out).toContain('<--');
    expect(out).toContain('tmesh-hq');
    expect(out).toContain('2026-04-05 14:19:12');
    expect(out).toContain('Status check');
  });

  test('shows signal type', () => {
    const out = formatInbound({
      sender: 'alice',
      content: 'deploy',
      timestamp: '2026-04-05T14:00:00.000Z',
      type: 'event',
    });
    expect(out).toContain('event');
  });
});
