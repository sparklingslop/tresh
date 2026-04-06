/**
 * Tests for pane lifecycle management (spawn, kill, health-check).
 *
 * Unit tests only -- tmux calls are mocked via module-level mock of
 * node:child_process. No real tmux required.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock child_process at module level (before importing the module under test)
// ---------------------------------------------------------------------------

const mockExecFileSync = mock(() => '');

mock.module('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));

import {
  spawnPane,
  killPane,
  isPaneDead,
  getPaneMode,
  paneExists,
  getPaneCommand,
  isValidPaneId,
} from '../pane-lifecycle';

// ---------------------------------------------------------------------------
// isValidPaneId -- pure validation, no mocks needed
// ---------------------------------------------------------------------------

describe('isValidPaneId', () => {
  test('accepts valid pane IDs', () => {
    expect(isValidPaneId('%0')).toBe(true);
    expect(isValidPaneId('%1')).toBe(true);
    expect(isValidPaneId('%42')).toBe(true);
    expect(isValidPaneId('%999')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isValidPaneId('')).toBe(false);
  });

  test('rejects missing percent prefix', () => {
    expect(isValidPaneId('0')).toBe(false);
    expect(isValidPaneId('42')).toBe(false);
  });

  test('rejects non-numeric after percent', () => {
    expect(isValidPaneId('%abc')).toBe(false);
    expect(isValidPaneId('%')).toBe(false);
    expect(isValidPaneId('%1a')).toBe(false);
  });

  test('rejects shell metacharacters', () => {
    expect(isValidPaneId('%1; rm -rf /')).toBe(false);
    expect(isValidPaneId('%1`evil`')).toBe(false);
    expect(isValidPaneId('%1$(evil)')).toBe(false);
  });

  test('rejects negative numbers', () => {
    expect(isValidPaneId('%-1')).toBe(false);
  });

  test('rejects whitespace', () => {
    expect(isValidPaneId('% 1')).toBe(false);
    expect(isValidPaneId('%1 ')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// spawnPane
// ---------------------------------------------------------------------------

describe('spawnPane', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('spawns a vertical pane with defaults', () => {
    mockExecFileSync.mockReturnValue('%5\n');

    const result = spawnPane();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('%5');
    }

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockExecFileSync.mock.calls[0]!;
    expect(cmd).toBe('tmux');
    expect(args).toContain('split-window');
    expect(args).toContain('-v');
    expect(args).toContain('-P');
    expect(args).toContain('-F');
    expect(args).toContain('#{pane_id}');
  });

  test('spawns a horizontal pane', () => {
    mockExecFileSync.mockReturnValue('%6\n');

    const result = spawnPane({ direction: 'horizontal' });
    expect(result.ok).toBe(true);

    const [, args] = mockExecFileSync.mock.calls[0]!;
    expect(args).toContain('-h');
    expect(args).not.toContain('-v');
  });

  test('respects size option', () => {
    mockExecFileSync.mockReturnValue('%7\n');

    const result = spawnPane({ size: '50%' });
    expect(result.ok).toBe(true);

    const [, args] = mockExecFileSync.mock.calls[0]!;
    expect(args).toContain('-l');
    expect(args).toContain('50%');
  });

  test('respects noFocus option (adds -d flag)', () => {
    mockExecFileSync.mockReturnValue('%8\n');

    const result = spawnPane({ noFocus: true });
    expect(result.ok).toBe(true);

    const [, args] = mockExecFileSync.mock.calls[0]!;
    expect(args).toContain('-d');
  });

  test('passes command to run in pane', () => {
    mockExecFileSync.mockReturnValue('%9\n');

    const result = spawnPane({ command: 'htop' });
    expect(result.ok).toBe(true);

    const [, args] = mockExecFileSync.mock.calls[0]!;
    // command should be the last argument
    expect(args[args.length - 1]).toBe('htop');
  });

  test('targets a specific session', () => {
    mockExecFileSync.mockReturnValue('%10\n');

    const result = spawnPane({ session: 'my-session' });
    expect(result.ok).toBe(true);

    const [, args] = mockExecFileSync.mock.calls[0]!;
    expect(args).toContain('-t');
    expect(args).toContain('my-session');
  });

  test('trims whitespace from returned pane ID', () => {
    mockExecFileSync.mockReturnValue('  %11  \n');

    const result = spawnPane();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('%11');
    }
  });

  test('returns Err on tmux failure', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('no server running');
    });

    const result = spawnPane();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to spawn pane');
    }
  });

  test('returns Err when output is not a valid pane ID', () => {
    mockExecFileSync.mockReturnValue('garbage output');

    const result = spawnPane();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Unexpected pane ID');
    }
  });
});

// ---------------------------------------------------------------------------
// killPane
// ---------------------------------------------------------------------------

describe('killPane', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('kills a pane by ID', () => {
    mockExecFileSync.mockReturnValue('');

    const result = killPane('%5');
    expect(result.ok).toBe(true);

    const [cmd, args] = mockExecFileSync.mock.calls[0]!;
    expect(cmd).toBe('tmux');
    expect(args).toContain('kill-pane');
    expect(args).toContain('-t');
    expect(args).toContain('%5');
  });

  test('returns Err on invalid pane ID', () => {
    const result = killPane('invalid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid pane ID');
    }
  });

  test('returns Err on tmux failure', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('pane not found');
    });

    const result = killPane('%99');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to kill pane');
    }
  });
});

// ---------------------------------------------------------------------------
// isPaneDead
// ---------------------------------------------------------------------------

describe('isPaneDead', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('returns true when pane is dead', () => {
    mockExecFileSync.mockReturnValue('1');

    const result = isPaneDead('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  test('returns false when pane is alive', () => {
    mockExecFileSync.mockReturnValue('0');

    const result = isPaneDead('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });

  test('returns Err on invalid pane ID', () => {
    const result = isPaneDead('bad');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid pane ID');
    }
  });

  test('returns Err on tmux failure', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('server exited');
    });

    const result = isPaneDead('%5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to check pane');
    }
  });
});

// ---------------------------------------------------------------------------
// getPaneMode
// ---------------------------------------------------------------------------

describe('getPaneMode', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('returns "normal" when pane is not in any mode', () => {
    mockExecFileSync.mockReturnValue('0');

    const result = getPaneMode('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('normal');
    }
  });

  test('returns "copy-mode" when pane is in copy mode', () => {
    // First call: pane_in_mode returns "1"
    // Second call: pane_mode returns "copy-mode"
    mockExecFileSync
      .mockReturnValueOnce('1')
      .mockReturnValueOnce('copy-mode');

    const result = getPaneMode('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('copy-mode');
    }
  });

  test('returns "view-mode" when pane is in view mode', () => {
    mockExecFileSync
      .mockReturnValueOnce('1')
      .mockReturnValueOnce('view-mode');

    const result = getPaneMode('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('view-mode');
    }
  });

  test('returns Err on invalid pane ID', () => {
    const result = getPaneMode('nope');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid pane ID');
    }
  });

  test('returns Err on tmux failure', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('connection refused');
    });

    const result = getPaneMode('%5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to get pane mode');
    }
  });
});

// ---------------------------------------------------------------------------
// paneExists
// ---------------------------------------------------------------------------

describe('paneExists', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('returns true when pane exists', () => {
    mockExecFileSync.mockReturnValue('');

    const result = paneExists('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  test('returns false when pane does not exist', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("can't find pane: %999");
    });

    const result = paneExists('%999');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });

  test('returns Err on invalid pane ID', () => {
    const result = paneExists('invalid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid pane ID');
    }
  });
});

// ---------------------------------------------------------------------------
// getPaneCommand
// ---------------------------------------------------------------------------

describe('getPaneCommand', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('returns the running command', () => {
    mockExecFileSync.mockReturnValue('zsh\n');

    const result = getPaneCommand('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('zsh');
    }
  });

  test('trims whitespace from command output', () => {
    mockExecFileSync.mockReturnValue('  bash  \n');

    const result = getPaneCommand('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('bash');
    }
  });

  test('returns Err on invalid pane ID', () => {
    const result = getPaneCommand('bad-id');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid pane ID');
    }
  });

  test('returns Err on tmux failure', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('server not found');
    });

    const result = getPaneCommand('%5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to get pane command');
    }
  });
});
