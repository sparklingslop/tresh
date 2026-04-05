/**
 * Tests for tmux hook management.
 */

import { describe, test, expect } from 'bun:test';
import {
  buildInstallCommands,
  buildUninstallCommands,
  HOOK_NAMES,
} from '../hooks';

describe('buildInstallCommands', () => {
  test('returns commands for all hooks', () => {
    const cmds = buildInstallCommands('/usr/local/bin/tmesh');
    expect(cmds.length).toBe(HOOK_NAMES.length);
  });

  test('each command uses set-hook -g', () => {
    const cmds = buildInstallCommands('/usr/local/bin/tmesh');
    for (const cmd of cmds) {
      expect(cmd[0]).toBe('tmux');
      expect(cmd[1]).toBe('set-hook');
      expect(cmd[2]).toBe('-g');
    }
  });

  test('session-created hook calls tmesh register', () => {
    const cmds = buildInstallCommands('/usr/local/bin/tmesh');
    const sessionCreated = cmds.find((c) => c[3] === 'session-created');
    expect(sessionCreated).toBeDefined();
    const runShell = sessionCreated![4] as string;
    expect(runShell).toContain('tmesh');
    expect(runShell).toContain('register');
  });

  test('session-closed hook calls tmesh deregister', () => {
    const cmds = buildInstallCommands('/usr/local/bin/tmesh');
    const sessionClosed = cmds.find((c) => c[3] === 'session-closed');
    expect(sessionClosed).toBeDefined();
    const runShell = sessionClosed![4] as string;
    expect(runShell).toContain('deregister');
  });

  test('uses provided binary path', () => {
    const cmds = buildInstallCommands('/custom/path/tmesh');
    for (const cmd of cmds) {
      const runShell = cmd[4] as string;
      expect(runShell).toContain('/custom/path/tmesh');
    }
  });
});

describe('buildUninstallCommands', () => {
  test('returns unset commands for all hooks', () => {
    const cmds = buildUninstallCommands();
    expect(cmds.length).toBe(HOOK_NAMES.length);
  });

  test('each command uses set-hook -gu', () => {
    const cmds = buildUninstallCommands();
    for (const cmd of cmds) {
      expect(cmd[0]).toBe('tmux');
      expect(cmd[1]).toBe('set-hook');
      expect(cmd[2]).toBe('-gu');
    }
  });
});
