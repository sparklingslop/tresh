<p align="center">
  <img src="assets/logo.svg" width="200" alt="tmesh">
</p>

<h3 align="center">Your AI agents are already running in tmux. Give them a mesh.</h3>

<p align="center">
  <a href="https://github.com/jankowtf/tmesh/releases"><img src="https://img.shields.io/badge/version-0.0.1-blue" alt="version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f472b6" alt="bun"></a>
  <a href="https://github.com/jankowtf/tmesh/actions"><img src="https://img.shields.io/badge/tests-139%2B%20passing-brightgreen" alt="tests"></a>
  <a href="https://github.com/jankowtf/tmesh"><img src="https://img.shields.io/badge/deps-0-orange" alt="zero dependencies"></a>
</p>

---

tmesh is a zero-infrastructure communication layer for AI coding agents. No broker. No cloud. No API keys. Just tmux sessions and filesystem signals.

Works with Claude Code, Cursor, Aider, Windsurf, or any process in a tmux pane.

## Quick Start

### SDK (primary interface)

```typescript
import { discover, discoverNodes, identify, createSignal } from 'tmesh';

// Find all tmux sessions on this machine
const sessions = await discover();

// See which ones have mesh identities
const nodes = await discoverNodes();

// Claim your identity
await identify('my-agent');

// Create a signal (Phase 2 will add send/watch)
const signal = createSignal({
  sender: 'my-agent',
  target: 'nano-cortex',
  type: 'message',
  content: 'Deploy complete. All tests pass.',
});
```

### CLI

```bash
# Install
bun add tmesh

# See what's running
tmesh ls

# Claim an identity on the mesh
tmesh identify my-agent

# Who's online?
tmesh who
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

## SDK / Library API

tmesh is a library first, CLI second. The CLI dogfoods the SDK.

```bash
bun add tmesh
```

### Discovery

```typescript
import { discover, discoverNodes, parseTmuxSessions, parseTmuxPanes } from 'tmesh';

// All tmux sessions (raw)
const sessions = await discover();

// Only sessions with mesh identities
const nodes = await discoverNodes();

// Lower-level: parse tmux output yourself
const parsed = parseTmuxSessions(rawTmuxOutput);
```

### Identity

```typescript
import { identify, readIdentity, resolveSessionIdentity, ensureHome } from 'tmesh';

// Set identity for this session
await identify('my-agent');

// Read current identity
const id = await readIdentity();

// Resolve from env var or identity file
const resolved = await resolveSessionIdentity('session-name');

// Ensure ~/.tmesh/ directory structure exists
await ensureHome();
```

### Signals

```typescript
import { createSignal, generateUlid, isValidUlid, decodeUlidTimestamp } from 'tmesh';

// Create a signal (ready for Phase 2 send/receive)
const signal = createSignal({
  sender: 'my-agent',
  target: 'nano-cortex',
  type: 'event',
  content: JSON.stringify({ repo: 'tmesh', version: 'v0.0.1' }),
  channel: 'releases',
  ttl: 300,
});

// ULID utilities (zero-dep, monotonic, Crockford base32)
const id = generateUlid();
const valid = isValidUlid(id);         // true
const ts = decodeUlidTimestamp(id);     // Date
```

### Types

tmesh uses branded types for compile-time safety:

```typescript
import type {
  TmeshNode,
  TmeshSignal,
  TmeshConfig,
  SignalType,
  NodeStatus,
  Ulid,
  Result,
} from 'tmesh';

import { Ok, Err, SessionName, Identity } from 'tmesh';

// Branded constructors -- invalid values won't compile
const session = SessionName('my-session');
const identity = Identity('nano-cortex');

// Result monad -- no exceptions
const result: Result<string, Error> = Ok('value');
```

## What's in 0.0.1

This is Phase 1: Discovery + Identity + Signal foundations.

**Shipped:**
- `tmesh ls` -- list all tmux sessions with mesh metadata (`--json` supported)
- `tmesh identify <name>` -- set mesh identity (atomic write + tmux env var)
- `tmesh who` -- show online mesh nodes
- SDK entry point with full TypeScript exports
- Branded types (`SessionName`, `Identity`, `Ulid`) with `Result<T, E>` monad
- Monotonic ULID generation (zero-dep, Crockford base32)
- `TmeshSignal` type and `createSignal()` factory
- 139+ tests, 481+ assertions
- Zero production dependencies

**Next (Phase 2):**
- `tmesh send <target> "message"` -- file-based signal delivery
- `tmesh watch` -- async inbox watcher (`fs.watch` + polling fallback)
- `tmesh broadcast` -- send to all nodes
- `tmesh inbox` / `tmesh read` / `tmesh ack`

**Later:**
- Direct injection (`tmesh inject`, `tmesh peek`)
- `createTmesh()` factory with async iterator watch
- Standalone binary via `bun build`
- npm publish

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
git clone https://github.com/jankowtf/tmesh.git
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

MIT -- [Sparkling Slop](https://github.com/jankowtf/tmesh)
