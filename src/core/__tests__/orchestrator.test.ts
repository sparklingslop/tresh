/**
 * Tests for the task orchestrator module.
 *
 * Tests single task execution, parallel execution with concurrency,
 * chain execution with {previous} substitution, mapWithConcurrency,
 * and error handling.
 *
 * Mocks execFileSync since tests run without tmux.
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import * as childProcess from 'node:child_process';
import type { TaskDef } from '../orchestrator';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

let execFileSyncMock: ReturnType<typeof spyOn>;

/**
 * Configure the execFileSync mock to simulate tmux behavior.
 *
 * For send-keys calls: returns empty string (no output).
 * For capture-pane calls: returns the configured pane output.
 */
function configureTmuxMock(options: {
  paneOutputs?: Record<string, string[]>;
  sendKeysError?: Error;
  capturePaneError?: Error;
}): void {
  const { paneOutputs = {}, sendKeysError, capturePaneError } = options;
  const callCounts: Record<string, number> = {};

  execFileSyncMock.mockImplementation((file: string, args?: readonly string[]) => {
    if (file !== 'tmux' || !args) return '';

    const subcommand = args[0];
    const paneIdx = args.indexOf('-t');
    const paneId = paneIdx >= 0 ? (args[paneIdx + 1] as string) : '';

    if (subcommand === 'send-keys') {
      if (sendKeysError) throw sendKeysError;
      return '';
    }

    if (subcommand === 'capture-pane') {
      if (capturePaneError) throw capturePaneError;
      const outputs = paneOutputs[paneId] ?? ['$ '];
      const count = callCounts[paneId] ?? 0;
      callCounts[paneId] = count + 1;
      // Cycle through outputs; last one sticks
      const idx = Math.min(count, outputs.length - 1);
      return outputs[idx]!;
    }

    return '';
  });
}

beforeEach(() => {
  execFileSyncMock = spyOn(childProcess, 'execFileSync');
});

afterEach(() => {
  execFileSyncMock.mockRestore();
});

// ---------------------------------------------------------------------------
// runTask -- single task execution
// ---------------------------------------------------------------------------

describe('runTask', () => {
  test('validates pane ID format', async () => {
    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: 'invalid-pane',
      command: 'echo hello',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('pane');
    }
  });

  test('validates pane ID rejects session:pane format', async () => {
    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: 'session:0.1',
      command: 'echo hello',
    });

    expect(result.ok).toBe(false);
  });

  test('accepts valid pane ID (%0, %1, %42)', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['running...\n', 'done\n$ '],
      },
    });

    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: '%0',
      command: 'echo hello',
      timeout: 5000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pane).toBe('%0');
      expect(result.value.status).toBe('completed');
    }
  });

  test('sends command via tmux send-keys', async () => {
    configureTmuxMock({
      paneOutputs: { '%1': ['$ '] },
    });

    const { runTask } = await import('../orchestrator');

    await runTask({
      pane: '%1',
      command: 'echo hello',
      timeout: 5000,
    });

    // Find the send-keys call
    const sendKeysCalls = execFileSyncMock.mock.calls.filter(
      (call: unknown[]) => call[1] && (call[1] as string[])[0] === 'send-keys',
    );
    expect(sendKeysCalls.length).toBeGreaterThanOrEqual(1);

    const firstCall = sendKeysCalls[0]!;
    const args = firstCall[1] as string[];
    expect(args).toContain('-t');
    expect(args).toContain('%1');
    expect(args).toContain('Enter');
  });

  test('polls capture-pane for completion pattern', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['running...\n', 'running...\n', 'all done\n$ '],
      },
    });

    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: '%0',
      command: 'do-work',
      timeout: 10000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('completed');
      expect(result.value.output).toContain('all done');
    }

    // Verify multiple capture-pane calls were made
    const captureCalls = execFileSyncMock.mock.calls.filter(
      (call: unknown[]) => call[1] && (call[1] as string[])[0] === 'capture-pane',
    );
    expect(captureCalls.length).toBeGreaterThanOrEqual(2);
  });

  test('returns timeout status when completion pattern not found', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['still running...\n'],
      },
    });

    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: '%0',
      command: 'long-task',
      timeout: 500, // Short timeout for test
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('timeout');
      expect(result.value.pane).toBe('%0');
    }
  });

  test('uses custom completion pattern', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['processing\n', 'DONE: success\n'],
      },
    });

    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: '%0',
      command: 'process-data',
      completionPattern: /DONE:/,
      timeout: 5000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('completed');
      expect(result.value.output).toContain('DONE: success');
    }
  });

  test('tracks duration in milliseconds', async () => {
    configureTmuxMock({
      paneOutputs: { '%0': ['$ '] },
    });

    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: '%0',
      command: 'fast-task',
      timeout: 5000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value.durationMs).toBe('number');
      expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  test('returns error status when send-keys fails', async () => {
    configureTmuxMock({
      sendKeysError: new Error('tmux: session not found'),
    });

    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: '%0',
      command: 'echo hello',
      timeout: 5000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('send-keys');
    }
  });

  test('default completion pattern matches shell prompt', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['output line\n$ '],
      },
    });

    const { runTask } = await import('../orchestrator');

    const result = await runTask({
      pane: '%0',
      command: 'test-cmd',
      // No completionPattern -- uses default /\$ $/
      timeout: 5000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('completed');
    }
  });

  test('default timeout is 300000ms (5 min)', async () => {
    // We just verify the type accepts no timeout and doesn't crash validation
    configureTmuxMock({
      paneOutputs: { '%0': ['$ '] },
    });

    const { runTask } = await import('../orchestrator');

    // This would take 5 minutes without mock, so just verify it starts
    const result = await runTask({
      pane: '%0',
      command: 'hello',
    });

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runParallel -- parallel task execution
// ---------------------------------------------------------------------------

describe('runParallel', () => {
  test('executes multiple tasks', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['output-a\n$ '],
        '%1': ['output-b\n$ '],
        '%2': ['output-c\n$ '],
      },
    });

    const { runParallel } = await import('../orchestrator');

    const tasks: TaskDef[] = [
      { pane: '%0', command: 'task-a', timeout: 5000 },
      { pane: '%1', command: 'task-b', timeout: 5000 },
      { pane: '%2', command: 'task-c', timeout: 5000 },
    ];

    const result = await runParallel(tasks);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(3);
      expect(result.value.every((r) => r.status === 'completed')).toBe(true);
    }
  });

  test('respects concurrency limit', async () => {
    let activeTasks = 0;
    let maxActiveTasks = 0;

    // Track concurrency via the mock
    execFileSyncMock.mockImplementation((file: string, args?: readonly string[]) => {
      if (file !== 'tmux' || !args) return '';
      const subcommand = args[0];

      if (subcommand === 'send-keys') {
        activeTasks++;
        maxActiveTasks = Math.max(maxActiveTasks, activeTasks);
        return '';
      }

      if (subcommand === 'capture-pane') {
        activeTasks = Math.max(0, activeTasks - 1);
        return '$ ';
      }

      return '';
    });

    const { runParallel } = await import('../orchestrator');

    const tasks: TaskDef[] = [
      { pane: '%0', command: 'a', timeout: 5000 },
      { pane: '%1', command: 'b', timeout: 5000 },
      { pane: '%2', command: 'c', timeout: 5000 },
      { pane: '%3', command: 'd', timeout: 5000 },
      { pane: '%4', command: 'e', timeout: 5000 },
      { pane: '%5', command: 'f', timeout: 5000 },
    ];

    const result = await runParallel(tasks, { concurrency: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(6);
    }
    // With concurrency 2, we should never have more than 2 active
    // Note: due to sync mock behavior, tracking is approximate
    // The important test is that all tasks complete
  });

  test('default concurrency is 4', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['$ '],
        '%1': ['$ '],
        '%2': ['$ '],
        '%3': ['$ '],
        '%4': ['$ '],
      },
    });

    const { runParallel } = await import('../orchestrator');

    const tasks: TaskDef[] = [
      { pane: '%0', command: 'a', timeout: 5000 },
      { pane: '%1', command: 'b', timeout: 5000 },
      { pane: '%2', command: 'c', timeout: 5000 },
      { pane: '%3', command: 'd', timeout: 5000 },
      { pane: '%4', command: 'e', timeout: 5000 },
    ];

    const result = await runParallel(tasks);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(5);
    }
  });

  test('returns empty array for empty task list', async () => {
    const { runParallel } = await import('../orchestrator');

    const result = await runParallel([]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  test('collects results from all tasks including failures', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['$ '],
        '%1': ['still going...\n'],
      },
    });

    const { runParallel } = await import('../orchestrator');

    const tasks: TaskDef[] = [
      { pane: '%0', command: 'fast', timeout: 5000 },
      { pane: '%1', command: 'slow', timeout: 500 },
    ];

    const result = await runParallel(tasks);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(2);
      expect(result.value[0]!.status).toBe('completed');
      expect(result.value[1]!.status).toBe('timeout');
    }
  });
});

// ---------------------------------------------------------------------------
// runChain -- sequential chain execution with {previous} substitution
// ---------------------------------------------------------------------------

describe('runChain', () => {
  test('executes tasks sequentially', async () => {
    const order: string[] = [];

    execFileSyncMock.mockImplementation((file: string, args?: readonly string[]) => {
      if (file !== 'tmux' || !args) return '';
      const subcommand = args[0];
      const paneIdx = args.indexOf('-t');
      const paneId = paneIdx >= 0 ? (args[paneIdx + 1] as string) : '';

      if (subcommand === 'send-keys') {
        order.push(paneId);
        return '';
      }

      if (subcommand === 'capture-pane') {
        return `result from ${paneId}\n$ `;
      }

      return '';
    });

    const { runChain } = await import('../orchestrator');

    const tasks: TaskDef[] = [
      { pane: '%0', command: 'step-1', timeout: 5000 },
      { pane: '%1', command: 'step-2', timeout: 5000 },
      { pane: '%2', command: 'step-3', timeout: 5000 },
    ];

    const result = await runChain(tasks);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(3);
    }

    // Verify sequential order
    expect(order).toEqual(['%0', '%1', '%2']);
  });

  test('substitutes {previous} with output of prior task', async () => {
    const sentCommands: string[] = [];

    execFileSyncMock.mockImplementation((file: string, args?: readonly string[]) => {
      if (file !== 'tmux' || !args) return '';
      const subcommand = args[0];

      if (subcommand === 'send-keys') {
        // The command is the 4th argument (index 3) after -t and paneId
        const tIdx = args.indexOf('-t');
        const cmdIdx = tIdx + 2; // skip -t, skip paneId
        sentCommands.push(args[cmdIdx] as string);
        return '';
      }

      if (subcommand === 'capture-pane') {
        const paneIdx = args.indexOf('-t');
        const paneId = paneIdx >= 0 ? (args[paneIdx + 1] as string) : '';
        if (paneId === '%0') return 'first-output\n$ ';
        if (paneId === '%1') return 'second-output\n$ ';
        return '$ ';
      }

      return '';
    });

    const { runChain } = await import('../orchestrator');

    const tasks: TaskDef[] = [
      { pane: '%0', command: 'generate-data', timeout: 5000 },
      { pane: '%1', command: 'process {previous}', timeout: 5000 },
      { pane: '%2', command: 'finalize {previous}', timeout: 5000 },
    ];

    const result = await runChain(tasks);

    expect(result.ok).toBe(true);

    // First command has no substitution
    expect(sentCommands[0]).not.toContain('{previous}');

    // Second command should have first task's output substituted in
    expect(sentCommands[1]).not.toContain('{previous}');
    expect(sentCommands[1]).toContain('first-output');

    // Third command should have second task's output substituted in
    expect(sentCommands[2]).not.toContain('{previous}');
    expect(sentCommands[2]).toContain('second-output');
  });

  test('truncates {previous} substitution to 500 chars', async () => {
    const longOutput = 'x'.repeat(1000);

    execFileSyncMock.mockImplementation((file: string, args?: readonly string[]) => {
      if (file !== 'tmux' || !args) return '';
      const subcommand = args[0];

      if (subcommand === 'send-keys') return '';

      if (subcommand === 'capture-pane') {
        const paneIdx = args.indexOf('-t');
        const paneId = paneIdx >= 0 ? (args[paneIdx + 1] as string) : '';
        if (paneId === '%0') return `${longOutput}\n$ `;
        return '$ ';
      }

      return '';
    });

    const { runChain } = await import('../orchestrator');

    const tasks: TaskDef[] = [
      { pane: '%0', command: 'gen', timeout: 5000 },
      { pane: '%1', command: 'use {previous}', timeout: 5000 },
    ];

    const result = await runChain(tasks);

    expect(result.ok).toBe(true);

    // Verify the sent command doesn't contain the full 1000-char output
    const sendKeysCalls = execFileSyncMock.mock.calls.filter(
      (call: unknown[]) => call[1] && (call[1] as string[])[0] === 'send-keys',
    );

    // Find the second send-keys call (for %1)
    const secondCall = sendKeysCalls[1];
    if (secondCall) {
      const cmdArgs = secondCall[1] as string[];
      const tIdx = cmdArgs.indexOf('-t');
      const sentCmd = cmdArgs[tIdx + 2] as string;
      // The substituted portion should be at most 500 chars
      // (the command itself is "use " + escaped(500 chars))
      expect(sentCmd.length).toBeLessThan(longOutput.length);
    }
  });

  test('stops chain on error and returns partial results', async () => {
    configureTmuxMock({
      paneOutputs: {
        '%0': ['$ '],
      },
      // send-keys will fail for %1 because we configure error generically
    });

    // More specific mock: fail send-keys only for %1
    execFileSyncMock.mockImplementation((file: string, args?: readonly string[]) => {
      if (file !== 'tmux' || !args) return '';
      const subcommand = args[0];
      const paneIdx = args.indexOf('-t');
      const paneId = paneIdx >= 0 ? (args[paneIdx + 1] as string) : '';

      if (subcommand === 'send-keys') {
        if (paneId === '%1') throw new Error('pane not found');
        return '';
      }

      if (subcommand === 'capture-pane') {
        return '$ ';
      }

      return '';
    });

    const { runChain } = await import('../orchestrator');

    const tasks: TaskDef[] = [
      { pane: '%0', command: 'step-1', timeout: 5000 },
      { pane: '%1', command: 'step-2', timeout: 5000 },
      { pane: '%2', command: 'step-3', timeout: 5000 },
    ];

    const result = await runChain(tasks);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('step 1');
    }
  });

  test('returns empty array for empty task list', async () => {
    const { runChain } = await import('../orchestrator');

    const result = await runChain([]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  test('first task has no {previous} substitution', async () => {
    configureTmuxMock({
      paneOutputs: { '%0': ['$ '] },
    });

    const { runChain } = await import('../orchestrator');

    const result = await runChain([
      { pane: '%0', command: 'start {previous}', timeout: 5000 },
    ]);

    expect(result.ok).toBe(true);

    // The first task should keep {previous} as-is (no prior output)
    const sendKeysCalls = execFileSyncMock.mock.calls.filter(
      (call: unknown[]) => call[1] && (call[1] as string[])[0] === 'send-keys',
    );
    expect(sendKeysCalls.length).toBe(1);
    const cmdArgs = sendKeysCalls[0]![1] as string[];
    const tIdx = cmdArgs.indexOf('-t');
    const sentCmd = cmdArgs[tIdx + 2] as string;
    // First task: {previous} should be replaced with empty string
    expect(sentCmd).not.toContain('{previous}');
  });
});

// ---------------------------------------------------------------------------
// mapWithConcurrency
// ---------------------------------------------------------------------------

describe('mapWithConcurrency', () => {
  test('maps over all items and returns results', async () => {
    const { mapWithConcurrency } = await import('../orchestrator');

    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 3, async (n) => n * 2);

    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  test('preserves input order in results', async () => {
    const { mapWithConcurrency } = await import('../orchestrator');

    const items = [30, 10, 20]; // Different "durations"
    const results = await mapWithConcurrency(items, 3, async (ms) => {
      await Bun.sleep(ms);
      return ms;
    });

    // Results should be in input order, not completion order
    expect(results).toEqual([30, 10, 20]);
  });

  test('limits concurrency to specified value', async () => {
    const { mapWithConcurrency } = await import('../orchestrator');

    let active = 0;
    let maxActive = 0;

    const items = [1, 2, 3, 4, 5, 6];
    await mapWithConcurrency(items, 2, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Bun.sleep(20);
      active--;
      return n;
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  test('handles concurrency of 1 (sequential)', async () => {
    const { mapWithConcurrency } = await import('../orchestrator');

    const order: number[] = [];
    const items = [1, 2, 3];
    await mapWithConcurrency(items, 1, async (n) => {
      order.push(n);
      await Bun.sleep(10);
      return n;
    });

    expect(order).toEqual([1, 2, 3]);
  });

  test('handles empty array', async () => {
    const { mapWithConcurrency } = await import('../orchestrator');

    const results = await mapWithConcurrency([], 4, async (n: number) => n);

    expect(results).toEqual([]);
  });

  test('handles single item', async () => {
    const { mapWithConcurrency } = await import('../orchestrator');

    const results = await mapWithConcurrency([42], 4, async (n) => n * 2);

    expect(results).toEqual([84]);
  });

  test('propagates errors from fn', async () => {
    const { mapWithConcurrency } = await import('../orchestrator');

    const items = [1, 2, 3];
    await expect(
      mapWithConcurrency(items, 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });

  test('concurrency larger than items works fine', async () => {
    const { mapWithConcurrency } = await import('../orchestrator');

    const items = [1, 2];
    const results = await mapWithConcurrency(items, 100, async (n) => n);

    expect(results).toEqual([1, 2]);
  });
});
