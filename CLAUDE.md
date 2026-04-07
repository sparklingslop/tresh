# tmesh

**tmux-native agent mesh. Zero infrastructure inter-session communication.**

## Rules

1. **Bun** for everything -- runtime, test, build, package management
2. **Zero dependencies** in core -- only `node:*` built-ins
3. **TypeScript strict mode**
4. **TDD** -- write tests first, then implement
5. **No emojis** in code or docs
6. **MIT license**
7. **Keep it minimal** -- this is a Unix tool, not a framework

## Architecture

Three files:
- `src/types.ts` -- Node, Signal, WatchOptions (~25 lines)
- `src/tmesh.ts` -- discover, send, recv, inject (~200 lines)
- `src/cli.ts` -- CLI wrapper (~150 lines)

## Core Primitives

| Function | Purpose | Mechanism |
|----------|---------|-----------|
| `discover()` | Find mesh nodes | `tmux list-sessions` + env vars |
| `send(target, body)` | Async signal delivery | File write + `tmux wait-for -S` |
| `watch(handler, opts)` | Receive signals | `tmux wait-for` (push) or `setInterval` (poll) |
| `inject(target, text)` | Direct pane push | `tmux send-keys` |
| `inbox()` | One-shot read | Scan + consume inbox files |
| `identify(name)` | Set identity | Env var + tmux session env |

## Signal Format

```json
{ "from": "alice", "to": "bob", "body": "hello", "ts": 1712451200000 }
```

## Quality Bar

- Every function has a test
- CLI commands work as documented
- `bun test` passes before every commit
- Library API matches the exports in `src/tmesh.ts`
