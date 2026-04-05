/**
 * Tests for src/core/discovery.ts
 *
 * TDD -- these tests define the contract for tmux session/pane discovery.
 * Implementation does not exist yet; all tests are expected to fail initially.
 */

import { describe, expect, it } from 'bun:test';
import {
  discoverNodes,
  parseTmuxPanes,
  parseTmuxSessions,
  type ParsedPane,
  type ParsedSession,
} from '../../src/core/discovery';

// ---------------------------------------------------------------------------
// Realistic sample data
// ---------------------------------------------------------------------------

const SINGLE_SESSION = `main: 3 windows (created Sat Apr  5 02:15:33 2026)`;

const MULTIPLE_SESSIONS = [
  `main: 3 windows (created Sat Apr  5 02:15:33 2026)`,
  `work: 1 windows (created Sat Apr  5 09:00:01 2026)`,
  `debug-session: 12 windows (created Fri Apr  4 23:59:59 2026)`,
].join('\n');

const SINGLE_PANE = `main\t%0\t12345\tbun\t1`;

const MULTIPLE_PANES = [
  `main\t%0\t12345\tbun\t1`,
  `main\t%1\t12346\tfish\t0`,
  `work\t%2\t23456\tnvim\t1`,
  `work\t%3\t23457\tzsh\t0`,
  `debug-session\t%4\t34567\thtop\t0`,
].join('\n');

// ---------------------------------------------------------------------------
// parseTmuxSessions
// ---------------------------------------------------------------------------

describe('parseTmuxSessions', () => {
  it('parses a single session line', () => {
    const result = parseTmuxSessions(SINGLE_SESSION);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      name: 'main',
      created: 'Sat Apr  5 02:15:33 2026',
    });
  });

  it('parses multiple session lines', () => {
    const result = parseTmuxSessions(MULTIPLE_SESSIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(3);
    expect(result.value[0]!.name).toBe('main');
    expect(result.value[1]!.name).toBe('work');
    expect(result.value[2]!.name).toBe('debug-session');
    expect(result.value[2]!.created).toBe('Fri Apr  4 23:59:59 2026');
  });

  it('returns Ok([]) for empty input', () => {
    const result = parseTmuxSessions('');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('returns Ok([]) for whitespace-only input', () => {
    const result = parseTmuxSessions('   \n  \n  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('skips malformed lines gracefully', () => {
    const input = [
      `main: 3 windows (created Sat Apr  5 02:15:33 2026)`,
      `this is not a valid line`,
      `work: 1 windows (created Sat Apr  5 09:00:01 2026)`,
    ].join('\n');

    const result = parseTmuxSessions(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
    expect(result.value[0]!.name).toBe('main');
    expect(result.value[1]!.name).toBe('work');
  });

  it('handles session names with hyphens and underscores', () => {
    const input = `my-long_session-name: 1 windows (created Mon Jan  1 00:00:00 2026)`;
    const result = parseTmuxSessions(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0]!.name).toBe('my-long_session-name');
  });

  it('handles session with single-digit day (padded with space)', () => {
    const input = `dev: 2 windows (created Tue Feb  3 14:30:00 2026)`;
    const result = parseTmuxSessions(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0]!.created).toBe('Tue Feb  3 14:30:00 2026');
  });

  it('handles session with double-digit day', () => {
    const input = `dev: 2 windows (created Tue Feb 13 14:30:00 2026)`;
    const result = parseTmuxSessions(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0]!.created).toBe('Tue Feb 13 14:30:00 2026');
  });

  it('handles lines with trailing newline', () => {
    const input = `main: 1 windows (created Sat Apr  5 02:15:33 2026)\n`;
    const result = parseTmuxSessions(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
  });

  it('preserves the window count in the name field correctly (no leakage)', () => {
    const input = `main: 100 windows (created Sat Apr  5 02:15:33 2026)`;
    const result = parseTmuxSessions(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0]!.name).toBe('main');
  });
});

// ---------------------------------------------------------------------------
// parseTmuxPanes
// ---------------------------------------------------------------------------

describe('parseTmuxPanes', () => {
  it('parses a single pane line', () => {
    const result = parseTmuxPanes(SINGLE_PANE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      sessionName: 'main',
      paneId: '%0',
      pid: 12345,
      command: 'bun',
      active: true,
    });
  });

  it('parses multiple pane lines', () => {
    const result = parseTmuxPanes(MULTIPLE_PANES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(5);
  });

  it('correctly distinguishes active (1) from inactive (0) panes', () => {
    const result = parseTmuxPanes(MULTIPLE_PANES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0]!.active).toBe(true); // main %0 -- active
    expect(result.value[1]!.active).toBe(false); // main %1 -- inactive
    expect(result.value[2]!.active).toBe(true); // work %2 -- active
    expect(result.value[3]!.active).toBe(false); // work %3 -- inactive
    expect(result.value[4]!.active).toBe(false); // debug-session %4 -- inactive
  });

  it('returns Ok([]) for empty input', () => {
    const result = parseTmuxPanes('');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('returns Ok([]) for whitespace-only input', () => {
    const result = parseTmuxPanes('  \n\n  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('parses pid as a number', () => {
    const result = parseTmuxPanes(SINGLE_PANE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(typeof result.value[0]!.pid).toBe('number');
    expect(result.value[0]!.pid).toBe(12345);
  });

  it('skips lines with wrong number of fields', () => {
    const input = [
      `main\t%0\t12345\tbun\t1`,
      `broken\t%1`, // too few fields
      `work\t%2\t23456\tnvim\t0`,
    ].join('\n');

    const result = parseTmuxPanes(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
    expect(result.value[0]!.sessionName).toBe('main');
    expect(result.value[1]!.sessionName).toBe('work');
  });

  it('skips lines where pid is not a number', () => {
    const input = [
      `main\t%0\tnot-a-pid\tbun\t1`,
      `work\t%2\t23456\tnvim\t0`,
    ].join('\n');

    const result = parseTmuxPanes(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.sessionName).toBe('work');
  });

  it('handles command names with spaces', () => {
    // A command field might contain spaces in some edge cases
    // but our tab-separated format means we split on tabs, so
    // the command is the 4th field between tabs
    const input = `main\t%0\t12345\tbun test\t1`;
    const result = parseTmuxPanes(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0]!.command).toBe('bun test');
  });

  it('handles trailing newline', () => {
    const input = `main\t%0\t12345\tbun\t1\n`;
    const result = parseTmuxPanes(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
  });

  it('handles session names with hyphens', () => {
    const input = `my-session\t%10\t99999\tzsh\t0`;
    const result = parseTmuxPanes(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0]!.sessionName).toBe('my-session');
    expect(result.value[0]!.paneId).toBe('%10');
  });
});

// ---------------------------------------------------------------------------
// discoverNodes
// ---------------------------------------------------------------------------

describe('discoverNodes', () => {
  const sessions: ParsedSession[] = [
    { name: 'main', created: 'Sat Apr  5 02:15:33 2026' },
    { name: 'work', created: 'Sat Apr  5 09:00:01 2026' },
    { name: 'debug-session', created: 'Fri Apr  4 23:59:59 2026' },
  ];

  const panes: ParsedPane[] = [
    { sessionName: 'main', paneId: '%0', pid: 12345, command: 'bun', active: true },
    { sessionName: 'main', paneId: '%1', pid: 12346, command: 'fish', active: false },
    { sessionName: 'work', paneId: '%2', pid: 23456, command: 'nvim', active: true },
    { sessionName: 'work', paneId: '%3', pid: 23457, command: 'zsh', active: false },
    { sessionName: 'debug-session', paneId: '%4', pid: 34567, command: 'htop', active: false },
  ];

  it('returns one node per session', () => {
    const nodes = discoverNodes(sessions, panes, new Map());
    expect(nodes).toHaveLength(3);
  });

  it('uses the first pane for each session', () => {
    const nodes = discoverNodes(sessions, panes, new Map());

    const main = nodes.find((n) => n.sessionName === 'main');
    expect(main).toBeDefined();
    expect(main!.pid).toBe(12345);
    expect(main!.command).toBe('bun');

    const work = nodes.find((n) => n.sessionName === 'work');
    expect(work).toBeDefined();
    expect(work!.pid).toBe(23456);
    expect(work!.command).toBe('nvim');
  });

  it('sets identity from the identities map', () => {
    const identities = new Map<string, string>([
      ['main', 'kai.main'],
      ['work', 'kai.work'],
    ]);

    const nodes = discoverNodes(sessions, panes, identities);

    const main = nodes.find((n) => n.sessionName === 'main');
    expect(main!.identity).toBe('kai.main');

    const work = nodes.find((n) => n.sessionName === 'work');
    expect(work!.identity).toBe('kai.work');
  });

  it('sets identity to null when session is not in the map', () => {
    const identities = new Map<string, string>([['main', 'kai.main']]);

    const nodes = discoverNodes(sessions, panes, identities);

    const debug = nodes.find((n) => n.sessionName === 'debug-session');
    expect(debug!.identity).toBeNull();
  });

  it('sets status to active when first pane is active', () => {
    const nodes = discoverNodes(sessions, panes, new Map());

    const main = nodes.find((n) => n.sessionName === 'main');
    expect(main!.status).toBe('active');

    const work = nodes.find((n) => n.sessionName === 'work');
    expect(work!.status).toBe('active');
  });

  it('sets status to detached when first pane is not active', () => {
    const nodes = discoverNodes(sessions, panes, new Map());

    const debug = nodes.find((n) => n.sessionName === 'debug-session');
    expect(debug!.status).toBe('detached');
  });

  it('populates startedAt from the session created timestamp', () => {
    const nodes = discoverNodes(sessions, panes, new Map());

    const main = nodes.find((n) => n.sessionName === 'main');
    expect(main!.startedAt).toBe('Sat Apr  5 02:15:33 2026');
  });

  it('returns empty array when no sessions provided', () => {
    const nodes = discoverNodes([], panes, new Map());
    expect(nodes).toEqual([]);
  });

  it('skips sessions that have no matching panes', () => {
    const sessionsWithOrphan: ParsedSession[] = [
      ...sessions,
      { name: 'orphan', created: 'Sat Apr  5 12:00:00 2026' },
    ];

    const nodes = discoverNodes(sessionsWithOrphan, panes, new Map());
    const orphan = nodes.find((n) => n.sessionName === 'orphan');
    expect(orphan).toBeUndefined();
  });

  it('returns branded SessionName values', () => {
    const nodes = discoverNodes(sessions, panes, new Map());
    // SessionName is a branded string -- at runtime it is just a string
    // but we verify the value is correct
    const main = nodes.find((n) => n.sessionName === 'main');
    expect(typeof main!.sessionName).toBe('string');
    expect(main!.sessionName).toBe('main');
  });

  it('handles empty identities map', () => {
    const nodes = discoverNodes(sessions, panes, new Map());
    for (const node of nodes) {
      expect(node.identity).toBeNull();
    }
  });

  it('handles single session with single pane', () => {
    const singleSession: ParsedSession[] = [
      { name: 'solo', created: 'Sat Apr  5 02:15:33 2026' },
    ];
    const singlePane: ParsedPane[] = [
      { sessionName: 'solo', paneId: '%0', pid: 1111, command: 'zsh', active: true },
    ];

    const nodes = discoverNodes(singleSession, singlePane, new Map());
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.sessionName).toBe('solo');
    expect(nodes[0]!.pid).toBe(1111);
    expect(nodes[0]!.status).toBe('active');
  });
});
