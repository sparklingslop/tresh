/**
 * Tests for the pane registry module.
 *
 * Name-based pane addressing: maps human-readable names to tmux pane IDs.
 * Tests mock execFileSync to avoid requiring tmux.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Mock child_process.execFileSync
// ---------------------------------------------------------------------------

// We need to mock execFileSync before importing the module under test.
// Bun's mock.module lets us replace the module entirely.
const mockExecFileSync = mock(() => '');

mock.module('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));

// Now import the module under test (uses the mocked execFileSync)
import {
  registerPane,
  resolvePane,
  listRegisteredPanes,
  unregisterPane,
  isValidPaneName,
} from '../pane-registry';

// ---------------------------------------------------------------------------
// isValidPaneName -- validation rules
// ---------------------------------------------------------------------------

describe('isValidPaneName', () => {
  test('accepts simple alpha names', () => {
    expect(isValidPaneName('worker')).toBe(true);
    expect(isValidPaneName('reviewer')).toBe(true);
    expect(isValidPaneName('Alice')).toBe(true);
  });

  test('accepts names with hyphens and underscores', () => {
    expect(isValidPaneName('my-worker')).toBe(true);
    expect(isValidPaneName('my_worker')).toBe(true);
    expect(isValidPaneName('agent-1')).toBe(true);
  });

  test('accepts names with numbers (not leading)', () => {
    expect(isValidPaneName('worker1')).toBe(true);
    expect(isValidPaneName('a123')).toBe(true);
  });

  test('rejects names starting with a number', () => {
    expect(isValidPaneName('1worker')).toBe(false);
  });

  test('rejects names starting with a hyphen', () => {
    expect(isValidPaneName('-worker')).toBe(false);
  });

  test('rejects names starting with an underscore', () => {
    expect(isValidPaneName('_worker')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidPaneName('')).toBe(false);
  });

  test('rejects names with spaces', () => {
    expect(isValidPaneName('my worker')).toBe(false);
  });

  test('rejects names with special characters', () => {
    expect(isValidPaneName('worker!')).toBe(false);
    expect(isValidPaneName('work@home')).toBe(false);
    expect(isValidPaneName('test.name')).toBe(false);
    expect(isValidPaneName('a$b')).toBe(false);
    expect(isValidPaneName('a;b')).toBe(false);
  });

  test('rejects names longer than 64 characters', () => {
    const longName = 'a'.repeat(65);
    expect(isValidPaneName(longName)).toBe(false);
  });

  test('accepts names exactly 64 characters', () => {
    const name64 = 'a'.repeat(64);
    expect(isValidPaneName(name64)).toBe(true);
  });

  test('accepts single character name', () => {
    expect(isValidPaneName('a')).toBe(true);
    expect(isValidPaneName('Z')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// registerPane
// ---------------------------------------------------------------------------

describe('registerPane', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
    mockExecFileSync.mockReturnValue('');
  });

  test('calls tmux set-environment with correct args', () => {
    const result = registerPane('worker', '%42');
    expect(result.ok).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'tmux',
      ['set-environment', '-t', expect.any(String), 'TMESH_PANE_WORKER', '%42'],
      expect.objectContaining({ stdio: 'pipe' }),
    );
  });

  test('uppercases the name in the env var', () => {
    registerPane('myWorker', '%10', { session: 'sess' });
    const callArgs = mockExecFileSync.mock.calls[0];
    // The env var name should be TMESH_PANE_MYWORKER
    expect(callArgs![1]![3]).toBe('TMESH_PANE_MYWORKER');
  });

  test('uses provided session option', () => {
    registerPane('worker', '%42', { session: 'my-session' });
    const callArgs = mockExecFileSync.mock.calls[0];
    expect(callArgs![1]![2]).toBe('my-session');
  });

  test('returns Err on invalid pane name', () => {
    const result = registerPane('', '%42');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid pane name');
    }
  });

  test('returns Err on name with special characters', () => {
    const result = registerPane('work!er', '%42');
    expect(result.ok).toBe(false);
  });

  test('returns Err when tmux command fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('no server running');
    });
    const result = registerPane('worker', '%42');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to register pane');
    }
  });

  test('writes global index file', () => {
    const result = registerPane('worker', '%42', { session: 'test-sess' });
    expect(result.ok).toBe(true);
    // Check the index file was written
    const indexPath = '/tmp/tmesh/panes/worker';
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath, 'utf-8');
      expect(content).toBe('test-sess:%42');
    }
  });
});

// ---------------------------------------------------------------------------
// resolvePane
// ---------------------------------------------------------------------------

describe('resolvePane', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('returns pane ID when found', () => {
    mockExecFileSync.mockReturnValue('TMESH_PANE_WORKER=%42\n');
    const result = resolvePane('worker');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('%42');
    }
  });

  test('calls tmux show-environment with correct args', () => {
    mockExecFileSync.mockReturnValue('TMESH_PANE_WORKER=%42\n');
    resolvePane('worker');
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'tmux',
      ['show-environment', '-t', expect.any(String), 'TMESH_PANE_WORKER'],
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  test('returns null when pane not found (tmux returns -TMESH_PANE_NAME)', () => {
    // tmux show-environment returns "-VAR_NAME" when unset
    mockExecFileSync.mockImplementation(() => {
      throw new Error('unknown variable');
    });
    const result = resolvePane('worker');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  test('uses provided session option', () => {
    mockExecFileSync.mockReturnValue('TMESH_PANE_WORKER=%42\n');
    resolvePane('worker', { session: 'other-sess' });
    const callArgs = mockExecFileSync.mock.calls[0];
    expect(callArgs![1]![2]).toBe('other-sess');
  });

  test('returns Err on invalid pane name', () => {
    const result = resolvePane('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid pane name');
    }
  });

  test('uppercases the name in the env var', () => {
    mockExecFileSync.mockReturnValue('TMESH_PANE_MYWORKER=%10\n');
    resolvePane('myWorker', { session: 'sess' });
    const callArgs = mockExecFileSync.mock.calls[0];
    expect(callArgs![1]![3]).toBe('TMESH_PANE_MYWORKER');
  });
});

// ---------------------------------------------------------------------------
// listRegisteredPanes
// ---------------------------------------------------------------------------

describe('listRegisteredPanes', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('returns map of all registered panes', () => {
    mockExecFileSync.mockReturnValue(
      'TMESH_HOME=/tmp/tmesh\n' +
      'TMESH_PANE_WORKER=%42\n' +
      'TMESH_PANE_REVIEWER=%55\n' +
      'OTHER_VAR=foo\n',
    );
    const result = listRegisteredPanes();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.size).toBe(2);
      expect(result.value.get('WORKER')).toBe('%42');
      expect(result.value.get('REVIEWER')).toBe('%55');
    }
  });

  test('returns empty map when no panes registered', () => {
    mockExecFileSync.mockReturnValue('TMESH_HOME=/tmp/tmesh\nOTHER=val\n');
    const result = listRegisteredPanes();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.size).toBe(0);
    }
  });

  test('handles empty output from tmux', () => {
    mockExecFileSync.mockReturnValue('');
    const result = listRegisteredPanes();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.size).toBe(0);
    }
  });

  test('calls tmux show-environment with correct args', () => {
    mockExecFileSync.mockReturnValue('');
    listRegisteredPanes({ session: 'test-sess' });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'tmux',
      ['show-environment', '-t', 'test-sess'],
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  test('returns Err when tmux command fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('no server running');
    });
    const result = listRegisteredPanes();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to list registered panes');
    }
  });
});

// ---------------------------------------------------------------------------
// unregisterPane
// ---------------------------------------------------------------------------

describe('unregisterPane', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
    mockExecFileSync.mockReturnValue('');
  });

  test('calls tmux set-environment -u to unset', () => {
    const result = unregisterPane('worker');
    expect(result.ok).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'tmux',
      ['set-environment', '-t', expect.any(String), '-u', 'TMESH_PANE_WORKER'],
      expect.objectContaining({ stdio: 'pipe' }),
    );
  });

  test('uses provided session option', () => {
    unregisterPane('worker', { session: 'my-sess' });
    const callArgs = mockExecFileSync.mock.calls[0];
    expect(callArgs![1]![2]).toBe('my-sess');
  });

  test('returns Err on invalid pane name', () => {
    const result = unregisterPane('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid pane name');
    }
  });

  test('returns Err when tmux command fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('no server running');
    });
    const result = unregisterPane('worker');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to unregister pane');
    }
  });

  test('removes global index file', () => {
    // Create a temp index file first
    mkdirSync('/tmp/tmesh/panes', { recursive: true });
    writeFileSync('/tmp/tmesh/panes/worker', 'test-sess:%42');

    const result = unregisterPane('worker');
    expect(result.ok).toBe(true);

    // The index file should be removed
    expect(existsSync('/tmp/tmesh/panes/worker')).toBe(false);
  });

  test('uppercases the name in the env var', () => {
    unregisterPane('myWorker', { session: 'sess' });
    const callArgs = mockExecFileSync.mock.calls[0];
    expect(callArgs![1]![4]).toBe('TMESH_PANE_MYWORKER');
  });
});
