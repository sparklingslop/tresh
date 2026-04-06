/**
 * Tests for the pane supervision module.
 *
 * Transparent observation of tmux panes via capture-pane polling.
 * Mocks child_process to simulate tmux interactions without requiring
 * a real tmux server.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

import type { SuperviseOptions, SuperviseResult } from '../supervisor';

// ---------------------------------------------------------------------------
// Mock state -- controls what execFileSync returns
// ---------------------------------------------------------------------------

let mockCaptureOutput = 'some output\n';
let mockPaneDead = '0';
let mockExecThrows = false;
let mockExecError: Error | null = null;
let execCalls: Array<{ file: string; args: readonly string[] }> = [];

// ---------------------------------------------------------------------------
// Mock child_process via mock.module
// ---------------------------------------------------------------------------

mock.module('node:child_process', () => ({
  execFileSync: (file: string, args?: readonly string[], _options?: unknown): string => {
    execCalls.push({ file, args: args ?? [] });

    if (mockExecThrows) {
      throw mockExecError ?? new Error('mock exec failure');
    }

    // Route based on tmux subcommand
    const argsArr = args ?? [];
    if (argsArr.includes('capture-pane')) {
      return mockCaptureOutput;
    }
    if (argsArr.includes('display-message')) {
      return mockPaneDead;
    }

    return '';
  },
}));

// Import AFTER mock.module so the mock is in effect
const { supervise } = await import('../supervisor');

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockCaptureOutput = 'some output\n';
  mockPaneDead = '0';
  mockExecThrows = false;
  mockExecError = null;
  execCalls = [];
});

// ---------------------------------------------------------------------------
// Pane ID validation
// ---------------------------------------------------------------------------

describe('supervise -- pane ID validation', () => {
  test('returns Err for empty pane ID', () => {
    const result = supervise('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('pane ID');
    }
  });

  test('returns Err for pane ID without percent prefix', () => {
    const result = supervise('42');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('pane ID');
    }
  });

  test('returns Err for pane ID with non-numeric suffix', () => {
    const result = supervise('%abc');
    expect(result.ok).toBe(false);
  });

  test('returns Err for percent-only pane ID', () => {
    const result = supervise('%');
    expect(result.ok).toBe(false);
  });

  test('accepts valid pane IDs', () => {
    const result = supervise('%0', { observeInterval: 50 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      result.value.stop();
    }
  });

  test('accepts multi-digit pane IDs', () => {
    const result = supervise('%42', { observeInterval: 50 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      result.value.stop();
    }
  });
});

// ---------------------------------------------------------------------------
// Basic observation
// ---------------------------------------------------------------------------

describe('supervise -- observation', () => {
  test('calls onObserve with captured content', async () => {
    const observations: Array<{ content: string; paneId: string }> = [];
    mockCaptureOutput = 'hello from pane\n';

    const result = supervise('%0', {
      observeInterval: 30,
      onObserve: (content, paneId) => {
        observations.push({ content, paneId });
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    // Wait for at least one observation tick
    await Bun.sleep(80);
    handle.stop();
    await handle.done;

    expect(observations.length).toBeGreaterThanOrEqual(1);
    expect(observations[0]!.content).toBe('hello from pane\n');
    expect(observations[0]!.paneId).toBe('%0');
  });

  test('tracks observation count in result', async () => {
    const result = supervise('%0', { observeInterval: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    await Bun.sleep(90);
    handle.stop();
    const sv = await handle.done;

    expect(sv.observations).toBeGreaterThanOrEqual(2);
    expect(sv.paneId).toBe('%0');
  });

  test('captures the specified number of lines', async () => {
    const result = supervise('%0', {
      observeInterval: 30,
      captureLines: 100,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    await Bun.sleep(60);
    handle.stop();
    await handle.done;

    // Verify capture-pane was called with -S -100
    const captureCall = execCalls.find(
      (c) => c.args.includes('capture-pane'),
    );
    expect(captureCall).toBeTruthy();
    expect(captureCall!.args).toContain('-S');
    expect(captureCall!.args).toContain('-100');
  });

  test('uses default captureLines of 50', async () => {
    const result = supervise('%0', { observeInterval: 30 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    await Bun.sleep(60);
    handle.stop();
    await handle.done;

    const captureCall = execCalls.find(
      (c) => c.args.includes('capture-pane'),
    );
    expect(captureCall).toBeTruthy();
    expect(captureCall!.args).toContain('-50');
  });
});

// ---------------------------------------------------------------------------
// Completion detection
// ---------------------------------------------------------------------------

describe('supervise -- completion detection', () => {
  test('resolves with "completed" when pattern matches', async () => {
    mockCaptureOutput = 'working...\nTASK DONE\n';

    const result = supervise('%0', {
      observeInterval: 20,
      completionPattern: /TASK DONE/,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv = await result.value.done;
    expect(sv.reason).toBe('completed');
    expect(sv.lastContent).toContain('TASK DONE');
    expect(sv.paneId).toBe('%0');
  });

  test('calls onComplete callback when pattern matches', async () => {
    mockCaptureOutput = 'BUILD SUCCESS\n';
    let completeCalled = false;
    let completeContent = '';

    const result = supervise('%0', {
      observeInterval: 20,
      completionPattern: /BUILD SUCCESS/,
      onComplete: (content, _paneId) => {
        completeCalled = true;
        completeContent = content;
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await result.value.done;
    expect(completeCalled).toBe(true);
    expect(completeContent).toContain('BUILD SUCCESS');
  });

  test('does not complete when pattern does not match', async () => {
    mockCaptureOutput = 'still working...\n';

    const result = supervise('%0', {
      observeInterval: 20,
      completionPattern: /FINISHED/,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    // Wait a few ticks -- should not complete
    const race = await Promise.race([
      handle.done.then(() => 'resolved' as const),
      Bun.sleep(100).then(() => 'pending' as const),
    ]);

    expect(race).toBe('pending');
    handle.stop();
    await handle.done;
  });

  test('completion pattern is tested against full captured content', async () => {
    // The pattern should match anywhere in the captured content
    mockCaptureOutput = 'line1\nline2\nDONE: exit code 0\nline4\n';

    const result = supervise('%0', {
      observeInterval: 20,
      completionPattern: /DONE: exit code \d+/,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv = await result.value.done;
    expect(sv.reason).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Dead pane detection
// ---------------------------------------------------------------------------

describe('supervise -- dead pane detection', () => {
  test('resolves with "dead" when pane dies', async () => {
    mockPaneDead = '1';

    const result = supervise('%0', { observeInterval: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv = await result.value.done;
    expect(sv.reason).toBe('dead');
    expect(sv.paneId).toBe('%0');
  });

  test('calls onDead callback when pane dies', async () => {
    mockPaneDead = '1';
    let deadPaneId = '';

    const result = supervise('%0', {
      observeInterval: 20,
      onDead: (paneId) => {
        deadPaneId = paneId;
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await result.value.done;
    expect(deadPaneId).toBe('%0');
  });

  test('pane death detected even without completion pattern', async () => {
    mockPaneDead = '1';

    const result = supervise('%0', { observeInterval: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv = await result.value.done;
    expect(sv.reason).toBe('dead');
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('supervise -- timeout', () => {
  test('resolves with "timeout" when timeout expires', async () => {
    mockPaneDead = '0';

    const result = supervise('%0', {
      observeInterval: 20,
      timeout: 80,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv = await result.value.done;
    expect(sv.reason).toBe('timeout');
    expect(sv.paneId).toBe('%0');
  });

  test('timeout includes observation count', async () => {
    const result = supervise('%0', {
      observeInterval: 20,
      timeout: 100,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv = await result.value.done;
    expect(sv.reason).toBe('timeout');
    expect(sv.observations).toBeGreaterThanOrEqual(1);
  });

  test('timeout=0 means no timeout (infinite supervision)', async () => {
    const result = supervise('%0', {
      observeInterval: 20,
      timeout: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    // Should not resolve on its own
    const race = await Promise.race([
      handle.done.then(() => 'resolved' as const),
      Bun.sleep(120).then(() => 'pending' as const),
    ]);

    expect(race).toBe('pending');
    handle.stop();
    await handle.done;
  });

  test('default timeout is infinite (0)', async () => {
    const result = supervise('%0', { observeInterval: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    // Without explicit timeout, should not resolve on its own
    const race = await Promise.race([
      handle.done.then(() => 'resolved' as const),
      Bun.sleep(120).then(() => 'pending' as const),
    ]);

    expect(race).toBe('pending');
    handle.stop();
    await handle.done;
  });
});

// ---------------------------------------------------------------------------
// Manual stop
// ---------------------------------------------------------------------------

describe('supervise -- manual stop', () => {
  test('resolves with "stopped" when stop() called', async () => {
    const result = supervise('%0', { observeInterval: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    await Bun.sleep(50);
    handle.stop();
    const sv = await handle.done;

    expect(sv.reason).toBe('stopped');
    expect(sv.paneId).toBe('%0');
  });

  test('stop() includes last captured content', async () => {
    mockCaptureOutput = 'final output\n';

    const result = supervise('%0', { observeInterval: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    await Bun.sleep(50);
    handle.stop();
    const sv = await handle.done;

    expect(sv.reason).toBe('stopped');
    expect(sv.lastContent).toBe('final output\n');
  });

  test('stop() is idempotent -- calling twice does not throw', async () => {
    const result = supervise('%0', { observeInterval: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    handle.stop();
    handle.stop(); // Should not throw
    const sv = await handle.done;

    expect(sv.reason).toBe('stopped');
  });

  test('observations stop after stop() is called', async () => {
    let observeCount = 0;

    const result = supervise('%0', {
      observeInterval: 20,
      onObserve: () => {
        observeCount++;
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    await Bun.sleep(60);
    handle.stop();
    await handle.done;

    const countAtStop = observeCount;

    // Wait a bit more -- count should not increase
    await Bun.sleep(80);
    expect(observeCount).toBe(countAtStop);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('supervise -- error handling', () => {
  test('resolves with "error" when capture-pane throws', async () => {
    mockExecThrows = true;
    mockExecError = new Error('tmux not running');

    const result = supervise('%0', { observeInterval: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv = await result.value.done;
    expect(sv.reason).toBe('error');
    expect(sv.paneId).toBe('%0');
  });
});

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

describe('supervise -- result shape', () => {
  test('result contains all required fields', async () => {
    mockCaptureOutput = 'ALL DONE\n';

    const result = supervise('%0', {
      observeInterval: 20,
      completionPattern: /ALL DONE/,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv: SuperviseResult = await result.value.done;

    expect(typeof sv.paneId).toBe('string');
    expect(typeof sv.reason).toBe('string');
    expect(typeof sv.observations).toBe('number');
    expect(['completed', 'dead', 'timeout', 'stopped', 'error']).toContain(sv.reason);
  });

  test('handle has done promise and stop method', () => {
    const result = supervise('%0', { observeInterval: 50 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;
    expect(handle.done).toBeInstanceOf(Promise);
    expect(typeof handle.stop).toBe('function');

    handle.stop();
  });
});

// ---------------------------------------------------------------------------
// Priority: completion before death/timeout
// ---------------------------------------------------------------------------

describe('supervise -- priority ordering', () => {
  test('completion takes priority over death detection', async () => {
    // Both conditions true: pattern matches AND pane is dead
    mockCaptureOutput = 'TASK COMPLETE\n';
    mockPaneDead = '1';

    const result = supervise('%0', {
      observeInterval: 20,
      completionPattern: /TASK COMPLETE/,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sv = await result.value.done;
    // Completion should win since we check it first
    expect(sv.reason).toBe('completed');
  });
});
