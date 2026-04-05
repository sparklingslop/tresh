/**
 * tmux session and pane discovery.
 *
 * Parses tmux CLI output into structured data and merges it
 * with identity information to produce TmeshNode instances.
 *
 * Zero dependencies -- only node:child_process for live helpers.
 */

import { execSync } from 'node:child_process';
import {
  Identity,
  Ok,
  SessionName,
  type Result,
  type TmeshNode,
} from '../types';

// ---------------------------------------------------------------------------
// Parsed types
// ---------------------------------------------------------------------------

export type ParsedSession = {
  readonly name: string;
  readonly created: string;
};

export type ParsedPane = {
  readonly sessionName: string;
  readonly paneId: string;
  readonly pid: number;
  readonly command: string;
  readonly active: boolean;
};

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

const SESSION_RE = /^([^:]+):\s+\d+\s+windows?\s+\(created\s+(.+?)\)/;

/**
 * Parse the output of `tmux list-sessions` into structured data.
 * Skips malformed lines gracefully.
 */
export function parseTmuxSessions(output: string): Result<ParsedSession[]> {
  if (output.trim().length === 0) {
    return Ok([]);
  }

  const lines = output.split('\n').filter((l) => l.trim().length > 0);
  const sessions: ParsedSession[] = [];

  for (const line of lines) {
    const match = SESSION_RE.exec(line);
    if (match) {
      sessions.push({
        name: match[1]!,
        created: match[2]!,
      });
    }
  }

  return Ok(sessions);
}

/**
 * Parse tab-separated pane output into structured data.
 * Format: session\tpaneId\tpid\tcommand\tactive
 */
export function parseTmuxPanes(output: string): Result<ParsedPane[]> {
  if (output.trim().length === 0) {
    return Ok([]);
  }

  const lines = output.split('\n').filter((l) => l.trim().length > 0);
  const panes: ParsedPane[] = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 5) {
      continue;
    }

    const pid = parseInt(parts[2]!, 10);
    if (Number.isNaN(pid)) {
      continue;
    }

    panes.push({
      sessionName: parts[0]!,
      paneId: parts[1]!,
      pid,
      command: parts[3]!,
      active: parts[4] === '1',
    });
  }

  return Ok(panes);
}

// ---------------------------------------------------------------------------
// Node discovery (merge sessions + panes + identities)
// ---------------------------------------------------------------------------

/**
 * Merge parsed sessions, panes, and identity information into TmeshNode[].
 * Returns one node per session, using the first pane found for each session.
 * Sessions with no matching panes are skipped.
 */
export function discoverNodes(
  sessions: readonly ParsedSession[],
  panes: readonly ParsedPane[],
  identities: ReadonlyMap<string, string>,
): TmeshNode[] {
  // Build a map of session name -> first pane
  const paneMap = new Map<string, ParsedPane>();
  for (const pane of panes) {
    if (!paneMap.has(pane.sessionName)) {
      paneMap.set(pane.sessionName, pane);
    }
  }

  const nodes: TmeshNode[] = [];

  for (const session of sessions) {
    const pane = paneMap.get(session.name);
    if (!pane) {
      continue;
    }

    let identity: ReturnType<typeof Identity> | null = null;
    const rawIdentity = identities.get(session.name);
    if (rawIdentity !== undefined) {
      try {
        identity = Identity(rawIdentity);
      } catch {
        identity = null;
      }
    }

    nodes.push({
      sessionName: SessionName(session.name),
      identity,
      pid: pane.pid,
      command: pane.command,
      startedAt: session.created,
      status: pane.active ? 'active' : 'detached',
    });
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Live tmux helpers (for CLI use, not unit-tested)
// ---------------------------------------------------------------------------

/**
 * Run `tmux list-sessions` and parse the output.
 */
export function listSessions(): Result<ParsedSession[]> {
  try {
    const output = execSync('tmux list-sessions 2>/dev/null', { encoding: 'utf-8' });
    return parseTmuxSessions(output);
  } catch {
    return Ok([]);
  }
}

/**
 * Run `tmux list-panes -a` with a custom format and parse the output.
 */
export function listPanes(): Result<ParsedPane[]> {
  try {
    const output = execSync(
      "tmux list-panes -a -F '#{session_name}\t#{pane_id}\t#{pane_pid}\t#{pane_current_command}\t#{pane_active}' 2>/dev/null",
      { encoding: 'utf-8' },
    );
    return parseTmuxPanes(output);
  } catch {
    return Ok([]);
  }
}

/**
 * Read the TMESH_IDENTITY environment variable from a tmux session.
 */
export function getSessionEnvIdentity(sessionName: string): string | null {
  try {
    const output = execSync(
      `tmux show-environment -t ${sessionName} TMESH_IDENTITY 2>/dev/null`,
      { encoding: 'utf-8' },
    ).trim();
    // Format: TMESH_IDENTITY=value  or  -TMESH_IDENTITY (if unset)
    if (output.startsWith('-') || !output.includes('=')) {
      return null;
    }
    const value = output.split('=').slice(1).join('=');
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Full discovery pipeline: list sessions, list panes, read identities, merge.
 */
export function discover(): Result<TmeshNode[]> {
  const sessionsResult = listSessions();
  if (!sessionsResult.ok) return sessionsResult;

  const panesResult = listPanes();
  if (!panesResult.ok) return panesResult;

  const identities = new Map<string, string>();
  for (const session of sessionsResult.value) {
    const id = getSessionEnvIdentity(session.name);
    if (id !== null) {
      identities.set(session.name, id);
    }
  }

  return Ok(discoverNodes(sessionsResult.value, panesResult.value, identities));
}
