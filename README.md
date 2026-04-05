<p align="center">
  <img src="assets/logo.svg" width="200" alt="tmesh">
</p>

<h3 align="center">Your AI agents are already running in tmux. Give them a mesh.</h3>

<p align="center">
  <a href="https://github.com/sparklingslop/tmesh/releases"><img src="https://img.shields.io/badge/version-0.0.3-blue" alt="version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f472b6" alt="bun"></a>
  <a href="https://github.com/sparklingslop/tmesh/actions"><img src="https://img.shields.io/badge/tests-263%2B%20passing-brightgreen" alt="tests"></a>
  <a href="https://github.com/sparklingslop/tmesh"><img src="https://img.shields.io/badge/deps-0-orange" alt="zero dependencies"></a>
</p>

---

tmesh is a zero-infrastructure communication layer for AI coding agents. No broker. No cloud. No API keys. Just tmux sessions and filesystem signals.

Works with Claude Code, Cursor, Aider, Windsurf, or any process in a tmux pane.

## Quick Start

### SDK (primary interface)

```typescript
import { createTmesh } from 'tmesh';

// Initialize a mesh node
const mesh = await createTmesh({ identity: 'my-agent' });

// Send a signal to another node
await mesh.send('nano-cortex', {
  type: 'message',
  content: 'Deploy complete. All tests pass.',
});

// Broadcast to all nodes
await mesh.broadcast({
  type: 'event',
  channel: 'deploys',
  content: JSON.stringify({ repo: 'tmesh', version: 'v0.0.3' }),
});

// Watch inbox for incoming signals
for await (const signal of mesh.watch()) {
  console.log(`${signal.sender}: ${signal.content}`);
  await mesh.ack(signal.id);
}
```

### CLI

```bash
# Install
bun add tmesh

# Claim an identity on the mesh
tmesh identify my-agent

# See what's running
tmesh ls

# Send a message
tmesh send nano-cortex "Deploy complete"

# Watch incoming signals
tmesh watch

# See the full topology
tmesh topology
```

## Why tmux?

Every serious AI agent workflow already runs in tmux. The sessions are right there. `tmux send-keys` injects text into any pane. `tmux capture-pane` reads any screen. `tmux list-sessions` discovers every node. The mesh already exists -- it just needs a protocol.

tmesh is that protocol.

No broker means no single point of failure. No cloud means no latency, no cost, no complexity. No API keys means no provisioning friction. No daemon means nothing to manage -- your agent's existing event loop does the work.

We don't need a $200M broker. We have tmux.

### Design Philosophy

- **tmux for discovery, filesystem for transport** -- tmux tells us WHO is online. The filesystem handles message delivery with atomic writes and no race conditions.
- **Harness-agnostic** -- No MCP, no Claude-specific hooks. Any process in a tmux session can participate. A bash script is a valid mesh node.
- **No daemon** -- The library provides functions. Your agent's event loop does the work.
- **Convention over configuration** -- Session naming and tmux environment variables handle identity. No registration step.
- **Signals, not RPC** -- Fire-and-forget signals with optional acknowledgment. Agents are autonomous -- they decide what to do with signals.

## Getting Started: Ghostty + tmux + Claude Code

tmesh is designed to be harness-agnostic -- any process in a tmux session can participate. That said, we've tested and verified it with **Claude Code running in Ghostty on macOS**. Here's the recommended setup.

### Prerequisites

- [Ghostty](https://ghostty.org) -- a fast, native terminal emulator (or any terminal that supports tmux)
- [tmux](https://github.com/tmux/tmux) -- terminal multiplexer
- [Bun](https://bun.sh) -- JavaScript runtime

### Install tmux (if needed)

```bash
# macOS
brew install tmux

# Linux
sudo apt install tmux   # Debian/Ubuntu
sudo pacman -S tmux     # Arch
```

### Set up tmux sessions for your agents

```bash
# Create named sessions for each agent
tmux new-session -d -s agent-alpha
tmux new-session -d -s agent-beta

# Launch Claude Code in each session
tmux send-keys -t agent-alpha 'claude' Enter
tmux send-keys -t agent-beta 'claude' Enter
```

### Give your agents mesh identities

From inside each agent's tmux session (or via CLI):

```bash
# In agent-alpha's session
tmesh identify alpha

# In agent-beta's session
tmesh identify beta

# Now see who's on the mesh
tmesh who
```

### Ghostty tip

Ghostty's split panes are separate from tmux panes. For tmesh, use **tmux panes** (not Ghostty splits) so that `tmesh ls` can discover them. Launch Ghostty, start tmux inside it, and create your agent sessions from there.

### Tested With

| Component | Version | Status |
|-----------|---------|--------|
| Claude Code | 2.1.92 | Verified -- live tested with 16 concurrent sessions |
| Ghostty | Latest | Verified -- primary development terminal |
| macOS | Sequoia 26.x | Verified |
| tmux | 3.x | Verified |
| Bun | 1.3.x | Verified |

tmesh is harness-agnostic by design. It should work with any terminal-based AI agent (Cursor, Aider, Windsurf, custom agents) running in tmux. We've only verified Claude Code so far -- **PRs testing other harnesses are very welcome.**

## Architecture

tmesh uses three transport layers with progressive enhancement:

```
+-----------+     +-----------+     +-----------+
| Session A |     | Session B |     | Session C |
| (Claude)  |     |  (Aider)  |     |  (Cursor) |
+-----+-----+     +-----+-----+     +-----+-----+
      |                 |                 |
      +--------+--------+---------+-------+
               |                  |
         .tmesh/inbox/      .tmesh/inbox/
         (file mailbox)     (file mailbox)
               |                  |
         /tmp/tmesh/signals/      |
         (shared signal bus) -----+
```

**Layer 1: Direct Injection** -- `tmux send-keys` injects text directly into an agent's input. Empirically verified with Claude Code. Best for simple notifications.

**Layer 2: File-Based Mailbox** -- Each session has a `.tmesh/inbox/` directory. Sending writes a signal file; receiving watches with `fs.watch()`. ULID-ordered, atomic writes, works with detached sessions.

**Layer 3: Shared Signal Bus** -- A shared `/tmp/tmesh/signals/` directory enables broadcast and pub/sub. Combined with tmux session discovery for the full node registry.

### Signal Format

Signals are the message unit. Compact JSON files with ULID ordering:

```
+-- tmesh ----------------------------------------
|  nano-cortex -> nano-mesh [message]
|  "Deploy complete. All tests pass."
|  2026-04-05T04:29:00Z  ttl:60s  #deploys
+-------------------------------------------------
```

```typescript
interface TmeshSignal {
  id: string;              // ULID -- monotonic, sortable, zero-dep
  sender: string;          // sender identity
  target: string;          // target identity ("*" for broadcast)
  type: 'message' | 'command' | 'event';
  channel: string;         // topic/namespace
  content: string;         // payload
  timestamp: string;       // ISO 8601
  ttl?: number;            // seconds until expiry
  replyTo?: string;        // signal ID for threading
}
```

### Node Model

```typescript
interface TmeshNode {
  sessionName: string;     // tmux session name
  identity: string;        // logical identity (e.g., "nano-mesh")
  pid: number;             // pane PID
  command: string;         // running command (claude, aider, etc.)
  startedAt: string;       // session creation time
  status: 'active' | 'idle' | 'detached';
}
```

## CLI Reference

### `tmesh ls`

List all tmux sessions with mesh metadata.

```
$ tmesh ls
  SESSION                      PID    CMD          STARTED              IDENTITY
  kai-claude-code-1            48291  claude       2026-04-05 02:15     nano-cortex
  kai-claude-code-2            48445  claude       2026-04-05 02:17     nano-mesh
  dev-server                   47102  node         2026-04-05 01:30     --
```

Pass `--json` for machine-readable output.

### `tmesh identify <name>`

Set the mesh identity for the current session. Writes to `~/.tmesh/identity` with an atomic file write and sets the `TMESH_IDENTITY` tmux environment variable.

```
$ tmesh identify nano-cortex
  identity set: nano-cortex
```

### `tmesh who`

Show only sessions that have assigned mesh identities.

```
$ tmesh who
  nano-cortex    kai-claude-code-1    claude    active
  nano-mesh      kai-claude-code-2    claude    active
```

### `tmesh inject <session> "text"`

Inject text into a tmux session via `send-keys` (Layer 1 direct injection).

```
$ tmesh inject agent-beta "Deploy complete"
Injected 15 chars into agent-beta
```

Session targets are validated against a strict whitelist pattern. Messages are escaped to prevent command injection. Uses `execFileSync` (no shell) for execution.

Flags: `--no-enter` (don't append Enter after the message)

### `tmesh peek <session>`

Capture the screen content of a tmux session via `capture-pane`.

```
$ tmesh peek agent-beta --lines 20
[last 20 lines of agent-beta's screen output]
```

Flags: `--lines <n>` (capture last N lines)

### `tmesh send <target> "message"`

Send a signal to a specific node.

```
$ tmesh send nano-cortex "Deploy complete"
Sent 01ABC123... to nano-cortex
```

Flags: `--type message|command|event`, `--channel <name>`, `--ttl <seconds>`

### `tmesh broadcast "message"`

Send a signal to all known nodes.

```
$ tmesh broadcast "Shutting down for maintenance"
Broadcast 01ABC123... to 3 node(s)
```

### `tmesh cast <channel> "message"`

Send to a specific channel/topic across all nodes.

```
$ tmesh cast deploys "v1.0 released"
Cast 01ABC123... to 3 node(s) on channel "deploys"
```

### `tmesh inbox`

List pending signals in the inbox.

```
$ tmesh inbox
01ABC123  14:30:15  nano-cortex [message]  Deploy complete. All tests pass.
01DEF456  14:31:02  nano-mesh [event]      New node joined: alpha
```

### `tmesh read <signal-id>`

Read a specific signal by ID.

### `tmesh ack <signal-id>`

Acknowledge (delete) a signal from the inbox.

### `tmesh watch`

Tail incoming signals in real-time (like `tail -f`). Supports `--channel` filter.

### `tmesh ping <target>`

Ping a node (delivery check).

### `tmesh topology`

Show all nodes and their connection state.

```
$ tmesh topology
Topology:

  * nano-cortex (this node) [2 signal(s) in inbox]

  Known peers:
    - nano-mesh [0 signal(s) pending]
    - alpha [1 signal(s) pending]

  Total: 3 node(s)
```

## SDK / Library API

tmesh is a library first, CLI second. The CLI dogfoods the SDK.

```bash
bun add tmesh
```

### createTmesh() -- the primary API

```typescript
import { createTmesh } from 'tmesh';

const mesh = await createTmesh({
  identity: 'my-agent',
  home: '~/.tmesh',       // optional, default
});

// Send to a specific node
await mesh.send('nano-cortex', {
  type: 'message',
  content: 'Deploy complete.',
});

// Broadcast to all known nodes
await mesh.broadcast({
  type: 'event',
  channel: 'deploys',
  content: JSON.stringify({ version: 'v1.0' }),
});

// List known peers
const nodes = await mesh.discover();

// List inbox
const signals = await mesh.inbox();

// Watch for incoming signals (async iterator)
for await (const signal of mesh.watch()) {
  console.log(`${signal.sender}: ${signal.content}`);
  await mesh.ack(signal.id);
}

// Clean expired signals
const cleaned = await mesh.clean();

// Direct injection (Layer 1 -- raw tmux)
mesh.inject('agent-beta', 'Hello from tmesh!');
const screen = mesh.peek('agent-beta', { lines: 20 });
```

### Lower-level APIs

```typescript
import {
  // Discovery
  discover, discoverNodes, parseTmuxSessions,
  // Identity
  identify, readIdentity, resolveSessionIdentity, ensureHome,
  // Signals
  createSignal, generateUlid, isValidUlid, decodeUlidTimestamp,
  // Transport
  deliverSignal, listInbox, readSignalFile, ackSignal, cleanExpired,
  // Watch
  watchInbox,
  // Nodes
  listNodes,
} from 'tmesh';
```

### Types

tmesh uses branded types for compile-time safety:

```typescript
import type {
  Tmesh, TmeshOptions, SendOptions, BroadcastOptions,
  TmeshNode, TmeshSignal, TmeshConfig,
  SignalType, NodeStatus, Ulid, Result,
} from 'tmesh';
```

## What's in 0.0.3

Phases 1-5 complete: Discovery, Transport, Full CLI, Library API, and Direct Injection.

**Shipped:**
- 14 CLI commands: `ls`, `who`, `identify`, `send`, `broadcast`, `cast`, `inbox`, `read`, `ack`, `watch`, `ping`, `topology`, `inject`, `peek`
- `createTmesh()` factory -- the primary library API with send, broadcast, discover, inbox, watch, ack, clean, inject, peek
- Direct injection via `tmux send-keys` with hardened shell escaping (Layer 1)
- Screen capture via `tmux capture-pane` (Layer 1)
- File-based signal transport with atomic writes (Layer 2)
- Inbox watcher with `fs.watch` + polling fallback and `AbortSignal` support
- TTL-based signal expiry and cleanup
- Standalone binary via `bun build --compile`
- Security: `execFileSync` (no shell), input validation, session target whitelisting
- Branded types (`SessionName`, `Identity`, `Ulid`) with `Result<T, E>` monad
- Monotonic ULID generation (zero-dep, Crockford base32)
- 263+ tests, 682+ assertions
- Zero production dependencies

**Next (Phase 6):**
- npm publish + GitHub release

## Comparison with Alternatives

| | tmesh | MCP | Custom Broker |
|---|---|---|---|
| **Infrastructure** | None (tmux + filesystem) | MCP server per tool | HTTP server + database |
| **Dependencies** | 0 | SDK + transport layer | Framework + deps |
| **Harness lock-in** | None -- any tmux process | Tied to MCP-compatible clients | Tied to broker protocol |
| **Discovery** | Automatic (tmux sessions) | Manual configuration | Service registry |
| **Failure mode** | Session dies = node gone | Server down = all tools gone | Broker down = mesh down |
| **Auth** | Unix permissions | API keys / tokens | API keys / tokens |
| **Latency** | ~0ms (local filesystem) | Network round-trip | Network round-trip |
| **Offline** | Always works | Needs server | Needs server |
| **Setup time** | `bun add tmesh` | Server + config + keys | Server + DB + config + keys |

tmesh is not a replacement for cloud-based mesh systems. It's a local-first, zero-infrastructure layer for when your agents are already on the same machine in tmux -- which, for most AI coding workflows, they are.

## Contributing

```bash
# Clone
git clone https://github.com/sparklingslop/tmesh.git
cd tmesh

# Install
bun install

# Test
bun test

# Run CLI locally
bun run tmesh ls
```

Tests must pass before every commit. The codebase uses TypeScript strict mode with `noUncheckedIndexedAccess`. Zero production dependencies is a hard constraint -- only `node:*` built-ins in core.

## License

MIT -- [Sparkling Slop](https://github.com/sparklingslop/tmesh)
