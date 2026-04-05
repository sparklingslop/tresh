/**
 * Tests for the tmux notification module.
 */

import { describe, test, expect } from 'bun:test';
import { buildNotifyCommand, formatSignalNotification } from '../notify';

describe('formatSignalNotification', () => {
  test('formats a message notification', () => {
    const msg = formatSignalNotification('alice', 'message', 'hello bob');
    expect(msg).toContain('alice');
    expect(msg).toContain('hello bob');
  });

  test('truncates long content', () => {
    const long = 'a'.repeat(200);
    const msg = formatSignalNotification('alice', 'message', long);
    expect(msg.length).toBeLessThan(120);
  });

  test('includes signal type', () => {
    const msg = formatSignalNotification('alice', 'command', 'do something');
    expect(msg).toContain('command');
  });
});

describe('buildNotifyCommand', () => {
  test('builds tmux display-message command', () => {
    const cmd = buildNotifyCommand('kai-session-1', 'tmesh: hello');
    expect(cmd[0]).toBe('tmux');
    expect(cmd[1]).toBe('display-message');
    expect(cmd).toContain('-t');
    expect(cmd).toContain('kai-session-1');
  });

  test('includes duration flag', () => {
    const cmd = buildNotifyCommand('sess', 'msg', { durationMs: 5000 });
    expect(cmd).toContain('-d');
    expect(cmd).toContain('5000');
  });
});
