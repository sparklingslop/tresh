/**
 * tmesh Acceptance Test Suite
 *
 * System-level QA that validates every feature against REAL tmux sessions.
 * This is NOT a unit test -- it creates actual tmux sessions, sends real
 * signals, and verifies the full user experience end-to-end.
 *
 * Prerequisites: tmux must be running.
 *
 * Run: just qa
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { execSync, execFileSync } from 'node:child_process';
import { readdir, readFile, rm, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TMESH_HOME = '/tmp/tmesh-qa-acceptance';
const CLI = join(import.meta.dir, '..', '..', 'src', 'cli', 'index.ts');
const SESSION_A = 'tmesh-qa-alpha';
const SESSION_B = 'tmesh-qa-beta';
const IDENTITY_A = 'qa-alpha';
const IDENTITY_B = 'qa-beta';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmesh(args: string[], identity?: string): string {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    TMESH_HOME,
  };
  if (identity) env['TMESH_IDENTITY'] = identity;

  return execFileSync('bun', ['run', CLI, ...args], {
    encoding: 'utf-8',
    env,
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function createTmuxSession(name: string): void {
  execSync(`tmux new-session -d -s ${name} -x 120 -y 30`, { stdio: 'pipe' });
}

function killTmuxSession(name: string): void {
  try { execSync(`tmux kill-session -t ${name} 2>/dev/null`, { stdio: 'pipe' }); } catch { /* */ }
}

async function cleanInbox(identity: string): Promise<void> {
  const p = join(TMESH_HOME, 'nodes', identity, 'inbox');
  await rm(p, { recursive: true, force: true });
  await mkdir(p, { recursive: true });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await rm(TMESH_HOME, { recursive: true, force: true });
  await mkdir(TMESH_HOME, { recursive: true });
  killTmuxSession(SESSION_A);
  killTmuxSession(SESSION_B);
  createTmuxSession(SESSION_A);
  createTmuxSession(SESSION_B);
});

afterAll(async () => {
  killTmuxSession(SESSION_A);
  killTmuxSession(SESSION_B);
  await rm(TMESH_HOME, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// QA-01: Identity
// ---------------------------------------------------------------------------

describe('QA-01: Identity', () => {
  test('identify sets identity for node A', () => {
    const out = tmesh(['identify', IDENTITY_A], IDENTITY_A);
    expect(out).toContain(`Identity set to: ${IDENTITY_A}`);
  });

  test('identify sets identity for node B', () => {
    const out = tmesh(['identify', IDENTITY_B], IDENTITY_B);
    expect(out).toContain(`Identity set to: ${IDENTITY_B}`);
  });
});

// ---------------------------------------------------------------------------
// QA-02: Discovery
// ---------------------------------------------------------------------------

describe('QA-02: Discovery', () => {
  test('ls lists QA sessions', () => {
    const out = tmesh(['ls'], IDENTITY_A);
    expect(out).toContain(SESSION_A);
    expect(out).toContain(SESSION_B);
  });

  test('ls output has correct columns', () => {
    const out = tmesh(['ls'], IDENTITY_A);
    expect(out).toContain('SESSION');
    expect(out).toContain('PID');
    expect(out).toContain('STATUS');
  });
});

// ---------------------------------------------------------------------------
// QA-03: Send + Receive (the core loop)
// ---------------------------------------------------------------------------

describe('QA-03: Send + Receive', () => {
  test('A sends to B -- signal lands in B inbox', async () => {
    await cleanInbox(IDENTITY_B);

    const out = tmesh(['send', IDENTITY_B, 'QA test message from alpha'], IDENTITY_A);
    expect(out).toContain(`to ${IDENTITY_B}`);

    const inboxPath = join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox');
    const files = await readdir(inboxPath);
    expect(files.length).toBe(1);

    const signal = JSON.parse(await readFile(join(inboxPath, files[0]!), 'utf-8'));
    expect(signal.sender).toBe(IDENTITY_A);
    expect(signal.target).toBe(IDENTITY_B);
    expect(signal.content).toBe('QA test message from alpha');
    expect(signal.type).toBe('message');
    expect(signal.channel).toBe('default');
    expect(signal.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(signal.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('B reads inbox -- sees A message', () => {
    const out = tmesh(['inbox'], IDENTITY_B);
    expect(out).toContain(IDENTITY_A);
    expect(out).toContain('QA test message from alpha');
  });

  test('B reads specific signal by ID', async () => {
    const inboxPath = join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox');
    const files = await readdir(inboxPath);
    const signalId = files[0]!.replace('.json', '');

    const out = tmesh(['read', signalId], IDENTITY_B);
    expect(out).toContain(`From:      ${IDENTITY_A}`);
    expect(out).toContain(`To:        ${IDENTITY_B}`);
    expect(out).toContain('QA test message from alpha');
  });

  test('B replies to A -- signal lands in A inbox', async () => {
    await cleanInbox(IDENTITY_A);

    const out = tmesh(['send', IDENTITY_A, 'QA reply from beta'], IDENTITY_B);
    expect(out).toContain(`to ${IDENTITY_A}`);

    const inboxPath = join(TMESH_HOME, 'nodes', IDENTITY_A, 'inbox');
    const files = await readdir(inboxPath);
    expect(files.length).toBe(1);

    const signal = JSON.parse(await readFile(join(inboxPath, files[0]!), 'utf-8'));
    expect(signal.sender).toBe(IDENTITY_B);
    expect(signal.content).toBe('QA reply from beta');
  });

  test('A reads inbox -- sees B reply', () => {
    const out = tmesh(['inbox'], IDENTITY_A);
    expect(out).toContain(IDENTITY_B);
    expect(out).toContain('QA reply from beta');
  });

  test('A acks the reply -- inbox empty', async () => {
    const inboxPath = join(TMESH_HOME, 'nodes', IDENTITY_A, 'inbox');
    const files = await readdir(inboxPath);
    const signalId = files[0]!.replace('.json', '');

    const out = tmesh(['ack', signalId], IDENTITY_A);
    expect(out).toContain(`Acked ${signalId}`);

    const remaining = await readdir(inboxPath);
    expect(remaining.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// QA-04: Broadcast + Cast
// ---------------------------------------------------------------------------

describe('QA-04: Broadcast + Cast', () => {
  test('broadcast delivers to all known nodes', async () => {
    await cleanInbox(IDENTITY_A);
    await cleanInbox(IDENTITY_B);

    const out = tmesh(['broadcast', 'QA broadcast test'], IDENTITY_A);
    expect(out).toContain('node(s)');

    const bFiles = await readdir(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox'));
    expect(bFiles.length).toBeGreaterThanOrEqual(1);
  });

  test('cast delivers with channel', async () => {
    await cleanInbox(IDENTITY_B);

    const out = tmesh(['cast', 'releases', 'v0.0.5 shipped'], IDENTITY_A);
    expect(out).toContain('channel "releases"');

    const bFiles = await readdir(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox'));
    const signal = JSON.parse(await readFile(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox', bFiles[0]!), 'utf-8'));
    expect(signal.channel).toBe('releases');
  });
});

// ---------------------------------------------------------------------------
// QA-05: @-mention routing
// ---------------------------------------------------------------------------

describe('QA-05: @-mention routing', () => {
  test('@ delivers to all mentioned nodes', async () => {
    await cleanInbox(IDENTITY_A);
    await cleanInbox(IDENTITY_B);

    const out = tmesh(['@', `Hey @${IDENTITY_A} and @${IDENTITY_B}, QA test`], 'qa-sender');
    expect(out).toContain(IDENTITY_A);
    expect(out).toContain(IDENTITY_B);
    expect(out).toContain('2/2 delivered');

    const aFiles = await readdir(join(TMESH_HOME, 'nodes', IDENTITY_A, 'inbox'));
    const bFiles = await readdir(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox'));
    expect(aFiles.length).toBe(1);
    expect(bFiles.length).toBe(1);
  });

  test('@ skips self-mention', async () => {
    await cleanInbox(IDENTITY_A);
    await cleanInbox(IDENTITY_B);

    const out = tmesh(['@', `Hey @${IDENTITY_A} and @${IDENTITY_B}`], IDENTITY_A);
    expect(out).toContain('1/1 delivered');

    const aFiles = await readdir(join(TMESH_HOME, 'nodes', IDENTITY_A, 'inbox'));
    expect(aFiles.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// QA-06: Topology + Viz
// ---------------------------------------------------------------------------

describe('QA-06: Topology + Viz', () => {
  test('topology shows correct structure', () => {
    const out = tmesh(['topology'], IDENTITY_A);
    expect(out).toContain(IDENTITY_A);
    expect(out).toContain('this node');
    expect(out).toContain('Known peers');
  });

  test('viz --json returns valid structure', () => {
    const out = tmesh(['viz', '--json'], IDENTITY_A);
    const data = JSON.parse(out);
    expect(data.identity).toBe(IDENTITY_A);
    expect(typeof data.totalNodes).toBe('number');
    expect(typeof data.inboxCount).toBe('number');
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(typeof data.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// QA-07: Direct Injection (Layer 1)
// ---------------------------------------------------------------------------

describe('QA-07: Direct Injection', () => {
  test('inject sends text to session', () => {
    const out = tmesh(['inject', SESSION_A, 'echo QA-INJECT-TEST'], IDENTITY_A);
    expect(out).toContain('Injected');
    expect(out).toContain(SESSION_A);
  });

  test('peek captures session screen', () => {
    const out = tmesh(['peek', SESSION_A, '--lines', '5'], IDENTITY_A);
    expect(out.length).toBeGreaterThan(0);
  });

  test('inject rejects invalid session names', () => {
    expect(() => tmesh(['inject', 'bad;session', 'hello'], IDENTITY_A)).toThrow();
  });

  test('peek rejects invalid session names', () => {
    expect(() => tmesh(['peek', '$evil'], IDENTITY_A)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// QA-08: Register / Deregister
// ---------------------------------------------------------------------------

describe('QA-08: Register / Deregister', () => {
  test('register creates node directory', async () => {
    const out = tmesh(['register', 'qa-new-node'], IDENTITY_A);
    expect(out).toContain('Registered');

    const exists = await access(join(TMESH_HOME, 'nodes', 'qa-new-node', 'inbox'))
      .then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('deregister removes node directory', async () => {
    const out = tmesh(['deregister', 'qa-new-node'], IDENTITY_A);
    expect(out).toContain('Deregistered');

    const exists = await access(join(TMESH_HOME, 'nodes', 'qa-new-node'))
      .then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QA-09: Signal integrity
// ---------------------------------------------------------------------------

describe('QA-09: Signal integrity', () => {
  test('signal has valid ULID and filename', async () => {
    await cleanInbox(IDENTITY_B);

    tmesh(['send', IDENTITY_B, 'integrity test'], IDENTITY_A);

    const files = await readdir(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox'));
    const signal = JSON.parse(await readFile(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox', files[0]!), 'utf-8'));

    expect(signal.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(files[0]).toBe(`${signal.id}.json`);
  });

  test('signal with --type command', async () => {
    await cleanInbox(IDENTITY_B);

    tmesh(['send', IDENTITY_B, 'do it', '--type', 'command'], IDENTITY_A);

    const files = await readdir(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox'));
    const signal = JSON.parse(await readFile(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox', files[0]!), 'utf-8'));
    expect(signal.type).toBe('command');
  });

  test('signal with --channel deploys', async () => {
    await cleanInbox(IDENTITY_B);

    tmesh(['send', IDENTITY_B, 'deployed', '--channel', 'deploys'], IDENTITY_A);

    const files = await readdir(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox'));
    const signal = JSON.parse(await readFile(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox', files[0]!), 'utf-8'));
    expect(signal.channel).toBe('deploys');
  });

  test('signals are ordered by ULID (chronological)', async () => {
    await cleanInbox(IDENTITY_B);

    tmesh(['send', IDENTITY_B, 'first'], IDENTITY_A);
    await new Promise((r) => setTimeout(r, 5));
    tmesh(['send', IDENTITY_B, 'second'], IDENTITY_A);

    const files = (await readdir(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox'))).sort();
    const s1 = JSON.parse(await readFile(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox', files[0]!), 'utf-8'));
    const s2 = JSON.parse(await readFile(join(TMESH_HOME, 'nodes', IDENTITY_B, 'inbox', files[1]!), 'utf-8'));

    expect(s1.content).toBe('first');
    expect(s2.content).toBe('second');
    expect(s1.id < s2.id).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// QA-10: Error handling
// ---------------------------------------------------------------------------

describe('QA-10: Error handling', () => {
  test('send fails without identity', () => {
    expect(() => {
      execFileSync('bun', ['run', CLI, 'send', 'someone', 'hello'], {
        encoding: 'utf-8',
        env: { ...process.env as Record<string, string>, TMESH_HOME: '/tmp/tmesh-qa-empty' },
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }).toThrow();
  });

  test('read fails for nonexistent signal', () => {
    expect(() => tmesh(['read', '00000000000000000000000000'], IDENTITY_A)).toThrow();
  });

  test('ack fails for nonexistent signal', () => {
    expect(() => tmesh(['ack', '00000000000000000000000000'], IDENTITY_A)).toThrow();
  });

  test('@ fails with no mentions', () => {
    expect(() => tmesh(['@', 'no mentions here'], IDENTITY_A)).toThrow();
  });

  test('help exits cleanly', () => {
    const out = tmesh(['help'], IDENTITY_A);
    expect(out).toContain('tmesh - tmux-native agent mesh');
    expect(out).toContain('Commands:');
  });
});
