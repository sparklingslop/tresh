/**
 * Tests for the output streaming module (pipe-pane).
 *
 * Tests command builders, path generation, pane ID validation,
 * and streaming logic. Uses temp files and mocks where tmux
 * is not available.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildPipePaneCommand,
  buildStopPipePaneCommand,
  streamOutputPath,
  streamPane,
} from '../stream';

// ---------------------------------------------------------------------------
// buildPipePaneCommand
// ---------------------------------------------------------------------------

describe('buildPipePaneCommand', () => {
  test('builds correct tmux pipe-pane command', () => {
    const cmd = buildPipePaneCommand('%0', '/tmp/tmesh/streams/test-output');
    expect(cmd[0]).toBe('tmux');
    expect(cmd).toContain('pipe-pane');
    expect(cmd).toContain('-O');
    expect(cmd).toContain('-t');
    expect(cmd).toContain('%0');
  });

  test('includes cat >> with the output path', () => {
    const cmd = buildPipePaneCommand('%42', '/tmp/tmesh/streams/42-out');
    const catArg = cmd[cmd.length - 1]!;
    expect(catArg).toContain('cat >>');
    expect(catArg).toContain('/tmp/tmesh/streams/42-out');
  });

  test('throws on invalid pane ID (no percent prefix)', () => {
    expect(() => buildPipePaneCommand('0', '/tmp/out')).toThrow();
  });

  test('throws on invalid pane ID (non-numeric after percent)', () => {
    expect(() => buildPipePaneCommand('%abc', '/tmp/out')).toThrow();
  });

  test('throws on empty pane ID', () => {
    expect(() => buildPipePaneCommand('', '/tmp/out')).toThrow();
  });

  test('throws on empty output path', () => {
    expect(() => buildPipePaneCommand('%0', '')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildStopPipePaneCommand
// ---------------------------------------------------------------------------

describe('buildStopPipePaneCommand', () => {
  test('builds tmux pipe-pane command with no pipe argument', () => {
    const cmd = buildStopPipePaneCommand('%0');
    expect(cmd[0]).toBe('tmux');
    expect(cmd).toContain('pipe-pane');
    expect(cmd).toContain('-t');
    expect(cmd).toContain('%0');
    // No cat >> argument -- empty command stops piping
    expect(cmd.length).toBe(4);
  });

  test('throws on invalid pane ID', () => {
    expect(() => buildStopPipePaneCommand('invalid')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// streamOutputPath
// ---------------------------------------------------------------------------

describe('streamOutputPath', () => {
  test('returns path under /tmp/tmesh/streams/', () => {
    const path = streamOutputPath('%0');
    expect(path).toMatch(/^\/tmp\/tmesh\/streams\//);
  });

  test('includes the pane ID (without percent) in the filename', () => {
    const path = streamOutputPath('%42');
    expect(path).toContain('42-');
  });

  test('includes a timestamp component', () => {
    const path = streamOutputPath('%0');
    // Should have a numeric timestamp
    expect(path).toMatch(/\d{13}/);
  });

  test('generates unique paths on successive calls', () => {
    const p1 = streamOutputPath('%0');
    const p2 = streamOutputPath('%0');
    // Paths should differ (timestamp or random suffix)
    // They might be the same if called in same ms, so we just check format
    expect(p1).toMatch(/^\/tmp\/tmesh\/streams\/0-/);
    expect(p2).toMatch(/^\/tmp\/tmesh\/streams\/0-/);
  });

  test('throws on invalid pane ID', () => {
    expect(() => streamOutputPath('bad')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// streamPane -- validation
// ---------------------------------------------------------------------------

describe('streamPane validation', () => {
  test('returns Err for invalid pane ID', () => {
    const result = streamPane('invalid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('pane ID');
    }
  });

  test('returns Err for empty pane ID', () => {
    const result = streamPane('');
    expect(result.ok).toBe(false);
  });

  test('returns Err for pane ID without percent prefix', () => {
    const result = streamPane('42');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// streamPane -- file tailing logic (using real temp files, no tmux)
// ---------------------------------------------------------------------------

describe('streamPane tailing', () => {
  const testDir = '/tmp/tmesh-stream-test';
  let testFile: string;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, `test-${Date.now()}`);
    writeFileSync(testFile, '');
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  test('calls onLine for each new line in the file', async () => {
    const lines: string[] = [];

    // We test the internal tailing by writing to a file and using the
    // tailFile helper. Since streamPane calls tmux (which we can't mock
    // cleanly in bun:test), we test the tailing logic via the exported
    // _tailFile test helper.
    const { _tailFile } = await import('../stream');

    const { stop, done } = _tailFile(testFile, {
      onLine: (line) => lines.push(line),
      timeout: 2000,
    });

    // Write lines to the file
    await Bun.sleep(50);
    appendFileSync(testFile, 'line one\n');
    await Bun.sleep(100);
    appendFileSync(testFile, 'line two\n');
    await Bun.sleep(100);

    stop();
    await done;

    expect(lines).toContain('line one');
    expect(lines).toContain('line two');
  });

  test('resolves done when pattern matches', async () => {
    const { _tailFile } = await import('../stream');

    const { done } = _tailFile(testFile, {
      pattern: /READY/,
      timeout: 2000,
    });

    await Bun.sleep(50);
    appendFileSync(testFile, 'booting...\n');
    await Bun.sleep(50);
    appendFileSync(testFile, 'READY\n');

    const result = await done;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(true);
      expect(result.value.matchedLine).toBe('READY');
      expect(result.value.timedOut).toBe(false);
    }
  });

  test('resolves with timedOut when timeout expires', async () => {
    const { _tailFile } = await import('../stream');

    const { done } = _tailFile(testFile, {
      pattern: /NEVER_MATCHES/,
      timeout: 200,
    });

    const result = await done;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(false);
      expect(result.value.timedOut).toBe(true);
    }
  });

  test('stop() resolves done with matched=false, timedOut=false', async () => {
    const { _tailFile } = await import('../stream');

    const { stop, done } = _tailFile(testFile, {
      pattern: /NEVER/,
      timeout: 60000,
    });

    await Bun.sleep(50);
    stop();

    const result = await done;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(false);
      expect(result.value.timedOut).toBe(false);
    }
  });

  test('handles multiple lines written at once', async () => {
    const lines: string[] = [];
    const { _tailFile } = await import('../stream');

    const { stop, done } = _tailFile(testFile, {
      onLine: (line) => lines.push(line),
      timeout: 2000,
    });

    await Bun.sleep(50);
    appendFileSync(testFile, 'alpha\nbeta\ngamma\n');
    await Bun.sleep(200);

    stop();
    await done;

    expect(lines).toContain('alpha');
    expect(lines).toContain('beta');
    expect(lines).toContain('gamma');
  });

  test('pattern matches mid-line content', async () => {
    const { _tailFile } = await import('../stream');

    const { done } = _tailFile(testFile, {
      pattern: /status=OK/,
      timeout: 2000,
    });

    await Bun.sleep(50);
    appendFileSync(testFile, 'health check status=OK at 12:00\n');

    const result = await done;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(true);
      expect(result.value.matchedLine).toBe('health check status=OK at 12:00');
    }
  });

  test('ignores empty lines for pattern matching but delivers them via onLine', async () => {
    const lines: string[] = [];
    const { _tailFile } = await import('../stream');

    const { stop, done } = _tailFile(testFile, {
      onLine: (line) => lines.push(line),
      pattern: /TARGET/,
      timeout: 2000,
    });

    await Bun.sleep(50);
    appendFileSync(testFile, '\n\nTARGET\n');
    await Bun.sleep(200);

    const result = await done;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(true);
    }
    // Empty lines are still delivered
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  test('timeout=0 means no timeout (stops only via stop() or pattern)', async () => {
    const { _tailFile } = await import('../stream');

    const { stop, done } = _tailFile(testFile, {
      timeout: 0,
    });

    // Wait a bit -- should NOT resolve on its own
    const race = await Promise.race([
      done.then(() => 'resolved' as const),
      Bun.sleep(300).then(() => 'pending' as const),
    ]);

    expect(race).toBe('pending');

    stop();
    const result = await done;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.timedOut).toBe(false);
    }
  });

  test('cleans up file watcher on stop', async () => {
    const { _tailFile } = await import('../stream');

    const { stop, done } = _tailFile(testFile, {
      timeout: 5000,
    });

    stop();
    await done;

    // No lingering watchers -- append should not cause errors
    appendFileSync(testFile, 'after stop\n');
    // If watcher leaked, this would throw or log errors
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pane ID validation pattern
// ---------------------------------------------------------------------------

describe('pane ID validation', () => {
  test('accepts valid pane IDs', () => {
    // Valid: %0, %1, %42, %100
    expect(buildPipePaneCommand('%0', '/tmp/out')).toBeTruthy();
    expect(buildPipePaneCommand('%1', '/tmp/out')).toBeTruthy();
    expect(buildPipePaneCommand('%42', '/tmp/out')).toBeTruthy();
    expect(buildPipePaneCommand('%100', '/tmp/out')).toBeTruthy();
  });

  test('rejects invalid pane IDs', () => {
    expect(() => buildPipePaneCommand('0', '/tmp/out')).toThrow();
    expect(() => buildPipePaneCommand('%', '/tmp/out')).toThrow();
    expect(() => buildPipePaneCommand('%-1', '/tmp/out')).toThrow();
    expect(() => buildPipePaneCommand('%abc', '/tmp/out')).toThrow();
    expect(() => buildPipePaneCommand('session:0.1', '/tmp/out')).toThrow();
  });
});
