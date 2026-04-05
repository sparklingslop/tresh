/**
 * Tests for tmesh ls command output formatting.
 */

import { describe, expect, it } from 'bun:test';
import { formatNodeTable, formatNodeJson } from '../../src/cli/commands/ls';
import type { TmeshNode } from '../../src/types';
import { SessionName, Identity } from '../../src/types';

const mockNodes: readonly TmeshNode[] = [
  {
    sessionName: SessionName('main'),
    identity: Identity('nano-cortex'),
    pid: 12345,
    command: 'claude',
    startedAt: 'Sat Apr  5 02:10:15 2026',
    status: 'active',
  },
  {
    sessionName: SessionName('work'),
    identity: null,
    pid: 12346,
    command: 'bash',
    startedAt: 'Sat Apr  5 03:22:41 2026',
    status: 'detached',
  },
];

describe('formatNodeTable', () => {
  it('includes session names', () => {
    const output = formatNodeTable(mockNodes);
    expect(output).toContain('main');
    expect(output).toContain('work');
  });

  it('includes identity when present', () => {
    const output = formatNodeTable(mockNodes);
    expect(output).toContain('nano-cortex');
  });

  it('shows dash for null identity', () => {
    const output = formatNodeTable(mockNodes);
    expect(output).toContain('-');
  });

  it('includes command and status', () => {
    const output = formatNodeTable(mockNodes);
    expect(output).toContain('claude');
    expect(output).toContain('active');
    expect(output).toContain('detached');
  });

  it('includes column headers', () => {
    const output = formatNodeTable(mockNodes);
    expect(output).toContain('SESSION');
    expect(output).toContain('IDENTITY');
    expect(output).toContain('PID');
    expect(output).toContain('COMMAND');
    expect(output).toContain('STATUS');
  });

  it('returns message for empty nodes', () => {
    const output = formatNodeTable([]);
    expect(output).toContain('No tmux sessions found');
  });
});

describe('formatNodeJson', () => {
  it('returns valid JSON', () => {
    const output = formatNodeJson(mockNodes);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
  });

  it('preserves all fields', () => {
    const output = formatNodeJson(mockNodes);
    const parsed = JSON.parse(output);
    expect(parsed[0].sessionName).toBe('main');
    expect(parsed[0].identity).toBe('nano-cortex');
    expect(parsed[0].pid).toBe(12345);
    expect(parsed[1].identity).toBeNull();
  });
});
