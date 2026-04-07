# tmesh

tmux-native agent mesh. Zero infrastructure. Zero polling. Push-based inter-session communication for AI agents.

<p align="center">
  <img src="assets/demo.gif" width="720" alt="tmesh demo — send and receive signals between agents">
</p>

## The thesis

Every AI coding agent already runs in a tmux session. tmesh turns those sessions into a peer-to-peer communication network using tmux as the discovery layer and the filesystem as the transport.

No broker. No server. No cloud. No MCP. Just tmux.

## Install

```bash
git clone https://github.com/sparklingslop/tmesh.git
cd tmesh && bun install
```

Run via:

```bash
bun run src/cli.ts ls          # from the repo
alias tmesh='bun run src/cli.ts'  # or alias it
```

## Quick start

```bash
# Terminal 1: identify and watch
export TMESH_IDENTITY=alice
tmesh watch

# Terminal 2: send a message
export TMESH_IDENTITY=bob
tmesh send alice "hello from bob"

# Terminal 1 shows:
# [00:42:15] bob: hello from bob
```

## How it works

```
  Session A (Claude)          Session B (Aider)
  ┌──────────────────┐        ┌──────────────────┐
  │ TMESH_IDENTITY=a │        │ TMESH_IDENTITY=b │
  │                  │        │                  │
  │ tmesh send b msg ─────────── ~/.tmesh/b/inbox/│
  │                  │  write │   1712...-x7k.json│
  │                  │        │                  │
  │                  │  wake  │ tmux wait-for    │
  │                  ─────────── (zero-CPU block) │
  └──────────────────┘        └──────────────────┘
```

**Discovery**: `tmux list-sessions` finds who's online. Sessions set `TMESH_IDENTITY` in the tmux environment.

**Send**: Write a JSON signal file to the target's inbox directory, then wake the receiver with `tmux wait-for -S`.

**Receive**: Block on `tmux wait-for` (zero CPU) until a signal arrives, then read the inbox. No polling needed.

**Inject**: For direct push, `tmux send-keys` injects text straight into a pane's input.

## Two transport modes

| Mode | Mechanism | Use case |
|------|-----------|----------|
| **Async (send/recv)** | File inbox + `tmux wait-for` | Reliable, structured messaging |
| **Direct (inject)** | `tmux send-keys` | Real-time push into agent input |

## Three watch modes

```bash
tmesh watch              # auto: push via wait-for, poll fallback
tmesh watch --push       # push only (requires tmux)
tmesh watch --poll 500   # poll every 500ms (no tmux needed)
```

## CLI

```
tmesh ls                      List mesh nodes (tmux sessions)
tmesh send <target> <body>    Send signal to target's inbox
tmesh inject <target> <text>  Push text into target's pane
tmesh watch [--poll <ms>]     Watch inbox for incoming signals
tmesh inbox                   Read pending signals (one-shot)
tmesh identify <name>         Set this session's mesh identity
```

## Library API

```typescript
import { discover, send, watch, inject, inbox, identify } from "tmesh";

// Set identity
identify("my-agent");

// Find peers
const nodes = discover();

// Send a signal
send("other-agent", "hello");

// Watch for signals (push mode)
const stop = watch((signal) => {
  // signal: { from, to, body, ts }
}, { mode: "push" });

// One-shot inbox read
const signals = inbox();

// Direct injection
inject("session-name", "some text");
```

## Signal format

```json
{ "from": "alice", "to": "bob", "body": "hello", "ts": 1712451200000 }
```

One struct. Four fields. That's the entire protocol.

## Design decisions

**tmux for discovery, filesystem for transport.** tmux tells us who's online. The filesystem handles reliable message delivery with atomic writes.

**`wait-for` as the push primitive.** `tmux wait-for` blocks at the kernel level with zero CPU. When a signal is delivered, `wait-for -S` wakes the receiver instantly. No polling loop.

**Harness-agnostic.** No MCP, no Claude-specific hooks. Any process in a tmux session can participate. A bash script is a valid mesh node.

**No daemon.** The library provides functions. Your agent's event loop does the work.

**Signal-based, not RPC.** Fire-and-forget signals with no request-response coupling. Agents are autonomous.

## Requirements

- [Bun](https://bun.sh) >= 1.0
- tmux (for discovery and push mode; poll mode works without it)

## License

MIT
