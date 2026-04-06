# tmesh Architecture

**Date**: 2026-04-06
**Status**: Research complete, informed by ecosystem analysis
**Version**: 0.0.10 (current implementation)

---

## Position Statement

tmesh is a **standalone, zero-dependency, agent-agnostic** communication primitive for AI coding agents running in tmux. It is NOT part of any ecosystem, framework, or platform. Any process in a tmux pane can use it.

```
bun add tmesh    # library
bunx tmesh who   # CLI
```

Works with Claude Code, Pi, Cursor, Aider, Codex, Gemini, or plain bash.

---

## What tmesh Already Has (v0.0.10)

### Core Primitives (implemented, tested)

| Module | What It Does |
|--------|-------------|
| `discovery.ts` | Parse tmux sessions/panes, read TMESH_IDENTITY env vars, build TmeshNode[] |
| `identity.ts` | Read/write identity files, resolve node home directories |
| `signal.ts` | ULID-based signal creation and validation |
| `transport.ts` | File-based signal delivery (atomic write to inbox), listing, ack, TTL cleanup |
| `watch.ts` | Async iterator over inbox (fs.watch + polling fallback) |
| `inject.ts` | `send-keys` injection with shell escaping, `capture-pane` reading |
| `wire.ts` | Display format for injected messages, PROTOCOL.md for agent onboarding |
| `mesh.ts` | `createTmesh()` factory -- high-level API wrapping all primitives |
| `nodes.ts` | List known peer nodes from filesystem |
| `init.ts` | Hot-bootstrap any tmux session onto the mesh (no restart needed) |
| `hooks.ts` | tmux `set-hook` for auto-register on session-created/closed |
| `notify.ts` | Non-invasive `display-message` notifications to peer sessions |
| `watchpane.ts` | Auto-watch pane (split-window tailing conversation log) |
| `conversation.ts` | Append-only conversation log for visibility |
| `display.ts` | Formatted signal display (outbound/inbound) with parsing |
| `mention.ts` | @ mention routing |

### CLI Commands (implemented)

`ls`, `who`, `identify`, `send`, `broadcast`, `cast`, `inbox`, `read`, `ack`, `watch`, `inject`, `peek`, `message`, `ping`, `topology`, `viz`, `log`, `join`, `setup`, `register`, `init`, `hooks`, `at`

### Architecture Properties (already achieved)

- Zero runtime dependencies (only `node:*` built-ins)
- Shell-safe injection (escaping + execFileSync, no shell interpolation)
- File-based transport (atomic writes, ULID ordering, TTL expiry)
- tmux env vars for identity (`TMESH_IDENTITY`)
- Works with detached sessions (filesystem delivery)
- Hot-bootstrapping (init a session without restarting it)
- Conversation log as universal visibility solution

---

## What the Ecosystem Taught Us

### Research Sources (2026-04-06)

Analyzed Pi (badlogic/pi-mono) core and community extensions, plus the broader tmux-agent ecosystem (AMUX, Batty, agentbus, smux, oh-my-pi, pi-tmux, pi-side-agents, Tmux-Orchestrator).

### Key Finding: Pi Does NOT Use tmux for Agent-to-Agent

Pi's tmux usage is terminal key handling only. Agent-to-agent is `child_process.spawn()` with JSONL over stdout. However, the **Pi community** built exactly what we're interested in -- as extensions.

### Patterns Worth Adopting

**From pi-tmux (offline-ant):**

1. **Name-based pane addressing** -- lock files at `/tmp/pi-semaphores/{name}` mapping human names to tmux pane IDs. Any agent can `resolve("worker")` to find `%42`.

2. **Transparent supervision** -- supervisor observes worker via `capture-pane` without the worker knowing. Self-alignment through observation, not protocol.

3. **Completion signaling** -- semaphore files released when command exits. `semaphore_wait(name)` blocks until work is done.

4. **Safety guards**:
   - Human typing detection (capture input buffer before send-keys, refuse if text present)
   - Copy mode awareness (check `#{pane_in_mode}` before sending)
   - Dead pane cleanup (detect `#{pane_dead}`, auto-kill + clean locks)

5. **Output streaming** -- `pipe-pane` + `tail -f` + `grep -m1` for pattern-based async notification.

**From oh-my-pi (can1357):**

6. **Concurrency-limited parallel execution** -- up to N concurrent agents with semaphore control.

7. **Agent definitions as markdown** -- YAML frontmatter specifying name, model, tools, capabilities. Filesystem-based discovery.

8. **Context rotation** -- monitor agent context usage, spawn replacement when approaching limit.

**From the broader ecosystem:**

9. **tmux `wait-for` as synchronization** -- zero-polling, tmux-native blocking wait. Better than filesystem polling for completion signaling.

10. **Process tree walking for discovery** (agentbus) -- auto-detect agents on the same tmux server without explicit registration.

11. **Kanban-based task claiming** (AMUX) -- atomic task assignment preventing double-work.

### Patterns We Improve On

| Their Approach | Our Improvement | Why |
|---------------|----------------|-----|
| Filesystem lock files (`/tmp/pi-semaphores/`) | tmux env vars + registry | No orphaned locks, tmux garbage-collects on session death |
| Filesystem polling for completion | tmux `wait-for` + `signal-wait` | Zero-polling, tmux-native, instant |
| Pi-specific extension API | Agent-agnostic CLI + library | Works with any process, not just Pi |
| JSONL over stdout (Pi subagents) | File-based mailbox + tmux injection | Persistent, works across sessions, works with detached |
| Broker-dependent mesh (nano-mesh) | Zero-infrastructure tmux transport | No single point of failure, no network dependency |

---

## What tmesh Needs Next

### Phase 7: Agent Orchestration Primitives

These are the missing pieces for agent-to-agent self-alignment:

#### 7.1 Pane Registry (name-based addressing)

```typescript
// Register a pane by role name
tmesh.registerPane('worker', '%42');
tmesh.registerPane('reviewer', '%43');

// Resolve name to pane ID
const paneId = tmesh.resolvePane('worker'); // '%42'

// List all registered panes
const panes = tmesh.listPanes(); // { worker: '%42', reviewer: '%43' }
```

**Implementation**: tmux session environment variables (`TMESH_PANE_{NAME}`) for session-scoped registry. Global cross-session index at `/tmp/tmesh/panes/{name}` mirroring the env vars, cleaned up on session death by existing hooks.

#### 7.2 Pane Lifecycle

```typescript
// Spawn a named pane
const paneId = tmesh.spawnPane('worker', {
  command: 'claude --identity worker',
  direction: 'horizontal', // split direction
  size: '50%',
});

// Kill a pane (with cleanup)
tmesh.killPane('worker');

// Check pane health
tmesh.isPaneDead('worker');    // boolean
tmesh.isPaneInMode('worker');  // 'copy-mode' | 'normal' | null
tmesh.paneStatus('worker');    // 'running' | 'idle' | 'dead'
```

**Implementation**: Wraps `tmux split-window`, `kill-pane`, format queries for `#{pane_dead}`, `#{pane_in_mode}`.

#### 7.3 Synchronization

```typescript
// Wait for a named event (blocks)
await tmesh.waitFor('worker-done');

// Signal an event (releases all waiters)
tmesh.signalWait('worker-done');
```

**Implementation**: Wraps tmux `wait-for` command. Since `wait-for` blocks the calling process, the library spawns it in a child process and returns a Promise. CLI exposes as `tmesh wait <channel>` and `tmesh signal <channel>`.

**Caveat**: `wait-for` blocks the process. Library wraps in spawned subprocess. Design consideration for callers.

#### 7.4 Output Streaming

```typescript
// Stream pane output to a callback
const stream = tmesh.streamPane('worker', {
  onLine: (line) => console.log(line),
  onPattern: /DONE/, // resolve when pattern matches
});

// Stop streaming
stream.stop();
```

**Implementation**: Wraps `tmux pipe-pane -O -t {pane} "cat >> /tmp/tmesh/streams/{name}"` + `tail -f` with pattern matching. Cleanup on stop.

#### 7.5 Safety Layer

```typescript
// Safe send-keys with guards
tmesh.safeSend('worker', 'analyze the codebase', {
  checkHumanTyping: true,   // capture input buffer first
  checkCopyMode: true,       // wait for copy mode exit
  checkDead: true,           // refuse if pane is dead
  timeout: 30000,            // max wait for mode exit
});
```

**Implementation**:
- **Copy mode**: Query `#{pane_in_mode}`, wait with timeout, force-cancel if needed
- **Dead pane**: Query `#{pane_dead}`, return error instead of silently failing
- **Human typing**: `capture-pane` the input line, check if non-empty (harness-specific heuristic -- Claude Code shows `>` prompt, Pi shows `$`, etc.)

#### 7.6 Supervision Pattern

```typescript
// Supervise a worker pane
const supervisor = tmesh.supervise('worker', {
  // Observe worker output periodically
  observeInterval: 5000,
  onObserve: (content) => {
    // Self-alignment: read worker's output, decide if intervention needed
  },
  // Detect completion
  completionPattern: /\$ $/, // shell prompt returned = task done
  onComplete: () => { /* ... */ },
  // Context rotation
  contextThreshold: 0.78,
  onContextHigh: (usage) => {
    // Spawn replacement, hand off
  },
});
```

**Implementation**: Polling loop using `peek()` (capture-pane). Pattern matching on output. No worker modification needed -- supervision is fully external and transparent.

### Phase 8: Task Orchestration

Higher-level patterns built on Phase 7 primitives:

#### 8.1 Single Task

```typescript
const result = await tmesh.task('worker', {
  command: 'Review the auth module for security issues',
  waitForCompletion: true,
});
```

#### 8.2 Parallel Tasks (fan-out / gather)

```typescript
const results = await tmesh.parallel([
  { pane: 'worker-1', command: 'Implement login endpoint' },
  { pane: 'worker-2', command: 'Implement signup endpoint' },
  { pane: 'worker-3', command: 'Write auth middleware' },
], { concurrency: 2 }); // max 2 concurrent
```

#### 8.3 Chain Tasks (pipeline)

```typescript
const result = await tmesh.chain([
  { pane: 'scout', command: 'Analyze the codebase structure' },
  { pane: 'planner', command: 'Create implementation plan based on: {previous}' },
  { pane: 'worker', command: 'Implement the plan: {previous}' },
  { pane: 'reviewer', command: 'Review the implementation: {previous}' },
]);
```

### Phase 9: Agent Definitions

```markdown
---
name: reviewer
description: Code review specialist
model: claude-opus-4-6
tools: [read, grep, glob]
---

You are a code reviewer. Focus on:
- Security vulnerabilities
- Performance issues
- API design consistency
```

Discovered from `~/.tmesh/agents/*.md` (user-level) and `.tmesh/agents/*.md` (project-level).

---

## Design Principles

1. **Zero dependencies** -- only `node:*` built-ins. No npm packages in core.
2. **Agent-agnostic** -- no coupling to Claude Code, Pi, or any harness.
3. **tmux IS the infrastructure** -- no broker, no cloud, no API keys.
4. **Convention over configuration** -- env vars and directory conventions, not config files.
5. **Signal-based, not RPC** -- fire-and-forget with optional ack. Agents are autonomous.
6. **Observable by default** -- humans can `tmux attach` and watch everything.
7. **Standalone** -- tmesh is a complete primitive, not a layer in someone else's stack. Other systems can consume tmesh, not the other way around.

---

## Non-Goals

- NOT a replacement for broker-based mesh systems (those solve different problems: multi-host, persistence, auth)
- NOT an MCP server (works without MCP)
- NOT a database (signals are ephemeral files)
- NOT tied to any AI vendor or harness
- NOT a framework (it's a primitive)

---

## Ecosystem Context

tmesh exists in a growing space of tmux-based agent coordination tools:

| Tool | Approach | tmesh Differentiator |
|------|----------|---------------------|
| pi-tmux | Pi extension, lock-based | Agent-agnostic, tmux-native addressing |
| pi-side-agents | Pi extension, git worktrees | Standalone CLI + library, not extension-only |
| oh-my-pi | Pi fork, batteries-included | Composable primitive, not opinionated framework |
| AMUX | Claude Code multiplexer | Any agent, not Claude-specific |
| Batty | Rust supervisor, Maildir | TypeScript, library-first, no daemon |
| agentbus | Zero-config MCP server | No MCP dependency, tmux-native |
| smux | One-command setup | Full protocol (signals, ack, TTL, channels) |

tmesh's gap: **no existing tool provides a general-purpose, agent-agnostic tmux mesh protocol with both a CLI and a library API**. That's the niche.

---

*Research conducted via three-way mesh collaboration between tmesh, nano-shell, and nano-mesh sessions on 2026-04-06. Ecosystem analysis covered Pi (badlogic/pi-mono), pi-tmux, pi-side-agents, oh-my-pi, AMUX, Batty, agentbus, smux, Tmux-Orchestrator, and multi-agent-shogun.*
