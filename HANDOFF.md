# tmesh — Implementation Handoff

**Date**: 2026-04-05
**From**: nano-cortex session (Kai/Claude Opus)
**To**: Forward-deployed agent in this repo
**Repo**: https://github.com/jankowtf/tmesh

---

## What Is tmesh?

A **tmux-native agent mesh**. Zero infrastructure, zero broker, zero cloud dependency. Inter-session communication for AI agents using tmux as the transport layer.

The thesis: **tmux IS the mesh**. Every AI coding agent already runs in a tmux session. tmesh turns those sessions into a peer-to-peer communication network with no additional infrastructure.

## Why This Exists

### The Problem
AI coding agents (Claude Code, Cursor, Aider, custom agents) run in isolated terminal sessions. They can't talk to each other. Current solutions require:
- A broker/server (single point of failure)
- Cloud infrastructure (latency, cost, complexity)
- Custom protocols (fragile, harness-specific)
- MCP servers (coupling to specific harness ecosystems)

### The Insight
Every serious AI agent workflow already uses tmux. The sessions are right there. `tmux send-keys` already works for injecting text into any session. `tmux capture-pane` already works for reading output. The mesh already exists — it just needs a protocol.

### The Context
We built a mesh system (cortex-mesh) that uses an HTTP broker + MCP relay. It works but has failure modes:
1. Broker unreachable = entire mesh down
2. MCP relay coupling = only works with Claude Code
3. API key provisioning = constant friction
4. Container networking = DNS resolution issues

tmesh eliminates ALL of these by using tmux as the transport. No broker. No MCP. No API keys. No DNS. Just Unix.

### The Opportunity
Anthropic's accidental Claude Code source leak created discourse about agent infrastructure. tmesh is the response: a better, open, harness-agnostic approach that works with ANY terminal-based agent. It's technically elegant (Unix philosophy) and narratively powerful (we don't need your leaked code — we have tmux).

## Architecture

### Core Concept

```
┌─────────────┐    tmux send-keys    ┌─────────────┐
│  Session A   │ ──────────────────► │  Session B   │
│  (Claude)    │                     │  (Aider)     │
│              │ ◄────────────────── │              │
│  .tmesh/     │   tmux capture-pane │  .tmesh/     │
│   inbox/     │                     │   inbox/     │
│   outbox/    │                     │   outbox/    │
└─────────────┘                      └─────────────┘
```

### Three Transport Layers (Progressive Enhancement)

**Layer 1: Direct Injection** (simplest, what we proved works today)
- `tmux send-keys -t <session> '<message>' Enter`
- Injects text directly into the agent's input
- Works RIGHT NOW with Claude Code — we verified this in our session
- Limitation: message appears as user input, agent processes it as a prompt
- Best for: simple notifications, status updates

**Layer 2: File-Based Mailbox** (reliable, asynchronous)
- Each session has a `.tmesh/inbox/` directory
- Sending = write a signal file to the target's inbox
- Receiving = watch inbox via `fs.watch()` or polling
- Signal file format: `{timestamp}-{sender}-{type}.json`
- tmux is used for discovery (which sessions exist) not transport
- Best for: structured data, reliable delivery, offline sessions

**Layer 3: Shared Signal Bus** (broadcast, pub/sub)
- Shared directory (e.g., `/tmp/tmesh/signals/`)
- Any session can write; all sessions read
- Enables broadcast, multicast, topic-based routing
- Combined with tmux session discovery for the node registry
- Best for: events, announcements, coordination

### Key Design Decisions

1. **tmux for discovery, filesystem for transport** — tmux tells us WHO is online (`tmux list-sessions`). Filesystem handles message delivery (atomic writes, no race conditions).

2. **Harness-agnostic** — No MCP, no Claude-specific hooks. Any process in a tmux session can participate. A bash script is a valid mesh node.

3. **No daemon** — The library provides functions. The agent's existing event loop does the work. No background process to manage.

4. **Convention over configuration** — Session naming convention (`tmesh-{identity}` or annotation via tmux environment variables) handles identity. No registration step needed.

5. **Signal-based, not RPC** — Fire-and-forget signals with optional acknowledgment. Not request-response. Agents are autonomous — they decide what to do with signals.

## Data Model

### Node (discovered from tmux)
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

### Signal (the message unit)
```typescript
interface TmeshSignal {
  id: string;              // ULID
  sender: string;          // sender identity
  target: string;          // target identity (or "*" for broadcast)
  type: 'message' | 'command' | 'event';
  channel: string;         // topic/namespace (default: "default")
  content: string;         // payload
  timestamp: string;       // ISO 8601
  ttl?: number;            // seconds until expiry
  replyTo?: string;        // signal ID this replies to
}
```

### Inbox Structure
```
~/.tmesh/                       # or project-local .tmesh/
  identity                      # file containing this node's identity
  inbox/                        # incoming signals
    01ABC-nano-cortex-message.json
    01DEF-nano-mesh-event.json
  outbox/                       # sent signals (optional, for audit)
  peers/                        # cached peer discovery
```

## CLI Design

```bash
# Discovery
tmesh ls                        # list all tmux sessions with tmesh metadata
tmesh who                       # show online mesh nodes with identities
tmesh identify <name>           # set this session's mesh identity

# Communication
tmesh send <target> "message"   # send a signal to a specific node
tmesh broadcast "message"       # send to all nodes
tmesh cast <channel> "message"  # send to a channel/topic

# Receiving
tmesh watch                     # tail incoming signals (like `tail -f`)
tmesh inbox                     # list pending signals
tmesh read <signal-id>          # read a specific signal
tmesh ack <signal-id>           # acknowledge a signal

# Direct injection (Layer 1)
tmesh inject <session> "text"   # raw tmux send-keys injection
tmesh peek <session>            # capture-pane snapshot

# Topology
tmesh topology                  # show all nodes and their connections
tmesh ping <target>             # ping a node (signal + ack roundtrip)
```

## Library API (TypeScript)

```typescript
import { createTmesh } from 'tmesh';

// Initialize
const mesh = createTmesh({
  identity: 'my-agent',
  inbox: '.tmesh/inbox',         // default
  discovery: 'tmux',             // default, uses tmux list-sessions
});

// Send
await mesh.send('nano-cortex', {
  type: 'message',
  content: 'Deploy complete. All tests pass.',
});

// Broadcast
await mesh.broadcast({
  type: 'event',
  channel: 'deploys',
  content: JSON.stringify({ repo: 'nano-cortex', version: 'v0.1.30' }),
});

// Watch (async iterator)
for await (const signal of mesh.watch()) {
  console.log(`${signal.sender}: ${signal.content}`);
  await mesh.ack(signal.id);
}

// Discovery
const nodes = await mesh.discover();
// [{ identity: 'nano-mesh', sessionName: 'kai-kai-claude-code-2', ... }]

// Direct injection (Layer 1 — raw tmux)
await mesh.inject('kai-kai-claude-code-2', 'Hello from tmesh!');
const screen = await mesh.peek('kai-kai-claude-code-2');
```

## Tech Stack

- **Runtime**: Bun (fast, TypeScript-native, good fs.watch)
- **Language**: TypeScript (strict mode)
- **CLI framework**: `commander` or minimal custom (keep deps near zero)
- **Build**: `bun build` for single-binary CLI
- **Test**: `bun:test`
- **Package**: npm (`tmesh`) + GitHub releases (standalone binary)
- **Zero dependencies** in core — only `node:child_process`, `node:fs`, `node:path`

## Project Structure

```
tmesh/
  src/
    core/
      discovery.ts      # tmux session discovery (list-sessions, metadata)
      transport.ts       # file-based signal delivery
      signal.ts          # signal creation, validation, serialization
      identity.ts        # node identity management
      watch.ts           # inbox watcher (fs.watch + polling fallback)
      inject.ts          # Layer 1: raw tmux send-keys injection
    cli/
      index.ts           # CLI entry point
      commands/           # one file per command
    index.ts             # library entry point (createTmesh)
  test/
    core/
      discovery.test.ts
      transport.test.ts
      signal.test.ts
      inject.test.ts
    cli/
      commands.test.ts
    integration/
      two-node.test.ts   # spin up 2 tmux sessions, exchange signals
  CLAUDE.md              # project instructions for any AI agent
  README.md              # public-facing docs
  package.json
  tsconfig.json
```

## README Energy

The README should have this energy:

> **Your AI agents are already running in tmux. Give them a mesh.**
>
> tmesh is a zero-infrastructure communication layer for AI coding agents. No broker. No cloud. No API keys. Just tmux sessions and filesystem signals.
>
> Works with Claude Code, Cursor, Aider, Windsurf, or any process in a tmux pane.

Key README sections:
1. One-liner pitch
2. 30-second demo (GIF of two agents exchanging signals)
3. Install (`bun add tmesh` / `brew install tmesh`)
4. Quick start (5 lines of code)
5. Why tmux? (the philosophy)
6. Architecture (the three layers)
7. CLI reference
8. Library API
9. Comparison with alternatives (MCP, custom brokers, etc.)
10. Contributing

## What We Proved Today

In the nano-cortex session, we empirically verified:

1. **`tmux send-keys` works with Claude Code** — text injected via `tmux send-keys -t <session> '<message>' Enter` appears as user input and Claude processes it. We sent 3 messages from nano-cortex to nano-mesh this way.

2. **`tmux capture-pane` works for reading** — we used `tmux capture-pane -t <session> -p | tail -N` to read the current screen state of other sessions.

3. **`tmux list-sessions` works for discovery** — we listed all sessions and identified which one was running nano-mesh by scanning pane content.

4. **Session identification** — we identified the Claude Code process via `pgrep -P <pane_pid>` and matched it to the session's identity.

5. **The main failure mode** — messages that are too long or contain special characters can fail. Short, clean messages work reliably.

## Non-Goals

- **NOT a replacement for cortex-mesh** — cortex-mesh does broker-mediated communication with persistence, auth, topology. tmesh is local-only, ephemeral, zero-infrastructure.
- **NOT an MCP server** — tmesh works WITHOUT MCP. Any process can use it.
- **NOT a database** — signals are ephemeral files. No persistence beyond the filesystem.
- **NOT tied to Anthropic/Claude** — works with any terminal-based agent.

## Implementation Priority

1. **Phase 1: Discovery + Identity** — `tmesh ls`, `tmesh who`, `tmesh identify`. Parse tmux sessions, extract metadata, assign identities.

2. **Phase 2: Send + Receive** — `tmesh send`, `tmesh watch`, `tmesh inbox`. File-based mailbox with ULID-named signal files.

3. **Phase 3: CLI + Binary** — Full CLI with all commands. `bun build` to standalone binary.

4. **Phase 4: Library API** — `createTmesh()` factory, async iterator watch, TypeScript types.

5. **Phase 5: Direct Injection** — `tmesh inject`, `tmesh peek`. Layer 1 raw tmux integration.

6. **Phase 6: README + Release** — Public-facing docs, npm publish, GitHub release.

## Key Gotchas from Experience

1. **tmux send-keys and special characters** — quotes, backticks, dollar signs in messages will be interpreted by the shell. Always use single-quoted strings or base64-encode payloads.

2. **Claude Code input handling** — Claude Code has its own TUI. `send-keys` works but the message appears as "Pasted text" in the prompt. This is fine — Claude processes it.

3. **Session naming** — tmux sessions have inconsistent naming. Some use auto-generated names, some are manually named. tmesh needs to handle both (annotation via tmux environment variables is the answer).

4. **Detached sessions** — tmux sessions can be detached but still running. Agents in detached sessions can still receive file-based signals but NOT tmux send-keys injection.

5. **Race conditions on write** — Use atomic file writes (write to temp, rename) to prevent partial reads. ULID ordering prevents signal reordering.

6. **Cleanup** — Signals accumulate in inbox. Need TTL-based cleanup or explicit ack+delete pattern.

## Brand Guidelines

- **Tone**: Technical, confident, slightly irreverent. Unix philosophy. "We don't need a $200M broker — we have tmux."
- **No emojis** in code or docs (keep it professional)
- **Minimal dependencies** — every dependency is a liability for a public project
- **MIT license** — maximum adoption
- **Logo**: Consider terminal-aesthetic, maybe ASCII art of connected tmux panes

---

*This handoff was written from a session that built cortex-mesh (HTTP broker + MCP relay), hit its failure modes, discovered tmux injection works empirically, and realized the mesh was hiding in plain sight the whole time.*
