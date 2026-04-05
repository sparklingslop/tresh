/**
 * Tests for tmesh who command filtering.
 */

import { describe, expect, it } from 'bun:test';
import { filterIdentifiedNodes } from '../../src/cli/commands/who';
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
  {
    sessionName: SessionName('agent'),
    identity: Identity('nano-mesh'),
    pid: 12347,
    command: 'aider',
    startedAt: 'Sat Apr  5 04:00:00 2026',
    status: 'active',
  },
];

describe('filterIdentifiedNodes', () => {
  it('returns only nodes with identity', () => {
    const result = filterIdentifiedNodes(mockNodes);
    expect(result).toHaveLength(2);
    expect(result[0]!.identity as string).toBe('nano-cortex');
    expect(result[1]!.identity as string).toBe('nano-mesh');
  });

  it('returns empty array when no nodes have identity', () => {
    const noIdentity: TmeshNode[] = [
      {
        sessionName: SessionName('solo'),
        identity: null,
        pid: 1,
        command: 'bash',
        startedAt: 'now',
        status: 'active',
      },
    ];
    expect(filterIdentifiedNodes(noIdentity)).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterIdentifiedNodes([])).toEqual([]);
  });
});
