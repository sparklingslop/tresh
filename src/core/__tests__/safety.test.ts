/**
 * Tests for safety guards module (pre-flight checks before send-keys injection).
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
  safeSend,
  detectHumanTyping,
  waitForCopyModeExit,
} from '../safety';

import type {
  SafeSendOptions,
  SafeSendResult,
  SafeSendError,
} from '../safety';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate a sequence of tmux command responses. */
function mockTmuxResponses(...responses: (string | Error)[]) {
  for (const resp of responses) {
    if (resp instanceof Error) {
      mockExecFileSync.mockImplementationOnce(() => { throw resp; });
    } else {
      mockExecFileSync.mockReturnValueOnce(resp);
    }
  }
}

// ---------------------------------------------------------------------------
// safeSend -- pane ID validation
// ---------------------------------------------------------------------------

describe('safeSend', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  describe('pane ID validation', () => {
    test('rejects empty pane ID', () => {
      const result = safeSend('', 'hello');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('injection_failed');
      }
    });

    test('rejects pane ID without percent prefix', () => {
      const result = safeSend('42', 'hello');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('injection_failed');
      }
    });

    test('rejects pane ID with shell metacharacters', () => {
      const result = safeSend('%1; rm -rf /', 'hello');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('injection_failed');
      }
    });

    test('rejects empty message', () => {
      const result = safeSend('%0', '');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('injection_failed');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // safeSend -- dead pane guard
  // ---------------------------------------------------------------------------

  describe('dead pane guard', () => {
    test('returns dead_pane error when pane is dead', () => {
      // isPaneDead query returns "1"
      mockTmuxResponses('1');

      const result = safeSend('%5', 'hello');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('dead_pane');
        if (result.error.kind === 'dead_pane') {
          expect(result.error.paneId).toBe('%5');
        }
      }
    });

    test('skips dead check when checkDead is false', () => {
      // No dead check, no copy mode check, no typing check -> straight to inject
      mockTmuxResponses(''); // inject call

      const result = safeSend('%5', 'hello', {
        checkDead: false,
        checkCopyMode: false,
        checkHumanTyping: false,
      });
      expect(result.ok).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // safeSend -- copy mode guard
  // ---------------------------------------------------------------------------

  describe('copy mode guard', () => {
    test('returns copy_mode_timeout when pane stays in copy mode', () => {
      // Dead check: not dead
      // Copy mode check: returns "1" forever (pane stuck in copy mode)
      mockExecFileSync.mockReturnValue('1');
      // First call for dead check should return "0"
      mockExecFileSync.mockReset();
      mockExecFileSync.mockReturnValueOnce('0'); // not dead
      // All subsequent calls return "1" (still in copy mode)
      mockExecFileSync.mockReturnValue('1');

      const result = safeSend('%5', 'hello', {
        copyModeTimeout: 50, // very short timeout for test
        checkHumanTyping: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('copy_mode_timeout');
        if (result.error.kind === 'copy_mode_timeout') {
          expect(result.error.paneId).toBe('%5');
          expect(result.error.timeoutMs).toBe(50);
        }
      }
    });

    test('skips copy mode check when checkCopyMode is false', () => {
      // Dead check: not dead
      // No copy mode check
      // Inject
      mockTmuxResponses(
        '0', // not dead
        '',  // inject
      );

      const result = safeSend('%5', 'hello', {
        checkCopyMode: false,
        checkHumanTyping: false,
      });
      expect(result.ok).toBe(true);
    });

    test('proceeds when pane is not in copy mode', () => {
      mockTmuxResponses(
        '0', // not dead
        '0', // not in copy mode
        '',  // inject
      );

      const result = safeSend('%5', 'hello', { checkHumanTyping: false });
      expect(result.ok).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // safeSend -- human typing guard
  // ---------------------------------------------------------------------------

  describe('human typing guard', () => {
    test('returns human_typing error when someone is typing', () => {
      mockTmuxResponses(
        '0',                          // not dead
        '0',                          // not in copy mode
        '$ partial command in progr',  // capture-pane shows typed content
      );

      const result = safeSend('%5', 'hello');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('human_typing');
        if (result.error.kind === 'human_typing') {
          expect(result.error.paneId).toBe('%5');
          expect(result.error.inputContent).toContain('partial command in progr');
        }
      }
    });

    test('skips human typing check when checkHumanTyping is false', () => {
      mockTmuxResponses(
        '0', // not dead
        '0', // not in copy mode
        '',  // inject
      );

      const result = safeSend('%5', 'hello', { checkHumanTyping: false });
      expect(result.ok).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // safeSend -- successful injection
  // ---------------------------------------------------------------------------

  describe('successful injection', () => {
    test('returns SafeSendResult on success with all guards', () => {
      mockTmuxResponses(
        '0',   // not dead
        '0',   // not in copy mode
        '$ ',  // capture-pane: clean prompt, no typing
        '',    // inject
      );

      const result = safeSend('%5', 'hello world');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.paneId).toBe('%5');
        expect(result.value.messageLength).toBe(11);
        expect(result.value.guardsChecked).toContain('dead');
        expect(result.value.guardsChecked).toContain('copy_mode');
        expect(result.value.guardsChecked).toContain('human_typing');
      }
    });

    test('returns SafeSendResult with no guards when all disabled', () => {
      mockTmuxResponses(''); // inject only

      const result = safeSend('%5', 'hello', {
        checkDead: false,
        checkCopyMode: false,
        checkHumanTyping: false,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.paneId).toBe('%5');
        expect(result.value.messageLength).toBe(5);
        expect(result.value.guardsChecked).toEqual([]);
      }
    });

    test('passes noEnter through to send-keys', () => {
      mockTmuxResponses(''); // inject only

      const result = safeSend('%5', 'hello', {
        checkDead: false,
        checkCopyMode: false,
        checkHumanTyping: false,
        noEnter: true,
      });
      expect(result.ok).toBe(true);

      // Verify the send-keys call does NOT include 'Enter'
      const lastCall = mockExecFileSync.mock.calls[mockExecFileSync.mock.calls.length - 1]!;
      const args = lastCall[1] as string[];
      expect(args).not.toContain('Enter');
    });

    test('includes Enter by default in send-keys', () => {
      mockTmuxResponses(''); // inject only

      const result = safeSend('%5', 'hello', {
        checkDead: false,
        checkCopyMode: false,
        checkHumanTyping: false,
      });
      expect(result.ok).toBe(true);

      const lastCall = mockExecFileSync.mock.calls[mockExecFileSync.mock.calls.length - 1]!;
      const args = lastCall[1] as string[];
      expect(args).toContain('Enter');
    });

    test('returns injection_failed when tmux send-keys fails', () => {
      mockTmuxResponses(
        '0',   // not dead
        '0',   // not in copy mode
        '$ ',  // no typing
      );
      // The injection itself fails
      mockExecFileSync.mockImplementationOnce(() => {
        throw new Error('pane has been destroyed');
      });

      const result = safeSend('%5', 'hello');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('injection_failed');
        if (result.error.kind === 'injection_failed') {
          expect(result.error.paneId).toBe('%5');
          expect(result.error.error).toContain('pane has been destroyed');
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// detectHumanTyping
// ---------------------------------------------------------------------------

describe('detectHumanTyping', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('returns Err on invalid pane ID', () => {
    const result = detectHumanTyping('bad');
    expect(result.ok).toBe(false);
  });

  test('detects no typing on bare $ prompt', () => {
    mockTmuxResponses('$ \n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(false);
    }
  });

  test('detects no typing on bare % prompt', () => {
    mockTmuxResponses('% \n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(false);
    }
  });

  test('detects no typing on bare > prompt', () => {
    mockTmuxResponses('> \n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(false);
    }
  });

  test('detects no typing on bare >>> prompt', () => {
    mockTmuxResponses('>>> \n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(false);
    }
  });

  test('detects typing after $ prompt', () => {
    mockTmuxResponses('$ some partial command\n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(true);
      expect(result.value.content).toBe('some partial command');
    }
  });

  test('detects typing after % prompt', () => {
    mockTmuxResponses('% git commit\n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(true);
      expect(result.value.content).toBe('git commit');
    }
  });

  test('detects typing after > prompt', () => {
    mockTmuxResponses('> hello world\n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(true);
      expect(result.value.content).toBe('hello world');
    }
  });

  test('detects typing after >>> prompt', () => {
    mockTmuxResponses('>>> import os\n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(true);
      expect(result.value.content).toBe('import os');
    }
  });

  test('returns no typing on empty pane', () => {
    mockTmuxResponses('\n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(false);
    }
  });

  test('returns no typing when pane has only whitespace lines', () => {
    mockTmuxResponses('   \n   \n   \n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(false);
    }
  });

  test('uses last non-empty line for detection', () => {
    mockTmuxResponses('some output\n$ partial typing\n\n\n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(true);
      expect(result.value.content).toBe('partial typing');
    }
  });

  test('returns Err when tmux capture-pane fails', () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('no such pane');
    });

    const result = detectHumanTyping('%99');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to detect human typing');
    }
  });

  test('no typing when last line has no recognized prompt', () => {
    mockTmuxResponses('some random output text\n');

    const result = detectHumanTyping('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.typing).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// waitForCopyModeExit
// ---------------------------------------------------------------------------

describe('waitForCopyModeExit', () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  test('returns Err on invalid pane ID', () => {
    const result = waitForCopyModeExit('bad');
    expect(result.ok).toBe(false);
  });

  test('returns true immediately when pane is not in copy mode', () => {
    mockTmuxResponses('0'); // pane_in_mode = 0

    const result = waitForCopyModeExit('%5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  test('returns true when pane exits copy mode before timeout', () => {
    mockTmuxResponses(
      '1', // first poll: still in copy mode
      '1', // second poll: still in copy mode
      '0', // third poll: exited copy mode
    );

    const result = waitForCopyModeExit('%5', 5000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  test('returns false when timeout expires', () => {
    // Always return "1" (stuck in copy mode)
    mockExecFileSync.mockReturnValue('1');

    const result = waitForCopyModeExit('%5', 50); // very short timeout
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });

  test('returns Err when tmux command fails', () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('server gone');
    });

    const result = waitForCopyModeExit('%5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Failed to check copy mode');
    }
  });

  test('uses default timeout of 10000ms', () => {
    // We just verify it doesn't throw -- the timeout is internal
    mockTmuxResponses('0');

    const result = waitForCopyModeExit('%5');
    expect(result.ok).toBe(true);
  });
});
