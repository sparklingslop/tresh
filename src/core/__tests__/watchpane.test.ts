/**
 * Tests for the auto-watch pane module.
 */

import { describe, test, expect } from 'bun:test';
import { buildWatchPaneCommand, buildCheckWatchPaneCommand, buildCloseWatchPaneCommand } from '../watchpane';

describe('buildWatchPaneCommand', () => {
  test('creates tmux split-window command', () => {
    const cmd = buildWatchPaneCommand('my-agent', '/usr/bin/tmesh');
    expect(cmd[0]).toBe('tmux');
    expect(cmd).toContain('split-window');
  });

  test('sets pane height to 6 lines', () => {
    const cmd = buildWatchPaneCommand('my-agent', '/usr/bin/tmesh');
    const lIdx = cmd.indexOf('-l');
    expect(lIdx).toBeGreaterThan(-1);
    expect(cmd[lIdx + 1]).toBe('6');
  });

  test('runs tmesh log -f with correct identity', () => {
    const cmd = buildWatchPaneCommand('my-agent', '/usr/bin/tmesh');
    const shellCmd = cmd[cmd.length - 1]!;
    expect(shellCmd).toContain('TMESH_IDENTITY=my-agent');
    expect(shellCmd).toContain('log');
    expect(shellCmd).toContain('--follow');
  });

  test('includes pane title for identification', () => {
    const cmd = buildWatchPaneCommand('my-agent', '/usr/bin/tmesh');
    // Should set a pane title so we can find it later
    expect(cmd.join(' ')).toContain('tmesh-watch');
  });
});

describe('buildCheckWatchPaneCommand', () => {
  test('creates tmux list-panes command', () => {
    const cmd = buildCheckWatchPaneCommand();
    expect(cmd[0]).toBe('tmux');
    expect(cmd).toContain('list-panes');
  });
});

describe('buildCloseWatchPaneCommand', () => {
  test('creates tmux kill-pane command', () => {
    const cmd = buildCloseWatchPaneCommand();
    expect(cmd[0]).toBe('tmux');
  });
});
