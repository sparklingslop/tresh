# tmesh — Session Handoff (v2)

**Date**: 2026-04-05
**From**: tmesh-hq session (Kai/Claude Opus)
**State**: v0.0.5 + significant post-release work

---

## What Was Built This Session

### Phases 1-5 (complete, released as v0.0.3)
- Discovery, identity, transport, CLI, library API, direct injection
- 14 CLI commands, createTmesh() factory, standalone binary

### Post-release (v0.0.4-v0.0.5, committed but unreleased)
- **Inbox routing fix**: nodes read from nodes/{identity}/inbox/
- **Per-session identity**: TMESH_IDENTITY env var > shared file
- **Tmux notifications**: display-message on signal delivery
- **Viz dashboard**: gum-powered visual mesh display
- **@-mention routing**: tmesh @ "Hey @alice and @bob, deploy ready"
- **Auto-registration hooks**: tmux session-created/closed hooks
- **Wire format**: [tmesh YYYY-MM-DD HH:MM:SS] <-- sender: content
- **tmesh init**: hot-bootstrap any session onto the mesh
- **tmesh message**: unified send + inject + notify
- **Conversation log**: bidirectional append-only log per node
- **tmesh log**: show conversation history
- **tmesh watch**: tails conversation log (both directions)
- **PROTOCOL.md**: auto-generated protocol doc for agents
- **QA acceptance suite**: 31 system-level tests (just qa)
- **justfile**: task runner for all operations

### Live Verified
- Real-time bidirectional tmesh communication between:
  - tmesh-hq <-> nano-research (45 cycles, 218 tests agent)
  - tmesh-hq <-> pong (first full tmesh round trip)
  - tmesh-hq <-> nano-autoevolve

## Architecture

```
~/.tmesh/
  identity                              # this node's identity
  PROTOCOL.md                           # auto-generated protocol doc
  nodes/
    {identity}/
      inbox/                            # incoming JSON signals
        {ulid}.json
      conversation.log                  # append-only: --> and <-- lines
      outbox/                           # sent signal copies (audit)
```

### Layers
1. **Discovery**: tmux list-sessions + TMESH_IDENTITY env vars
2. **Transport**: JSON files in inbox dirs, atomic writes, ULID ordering
3. **Conversation log**: append-only per-node, both directions
4. **Display**: [tmesh YYYY-MM-DD HH:MM:SS] --> / <-- format
5. **Wire injection**: send-keys into tmux sessions for live notification

### Key Design Decisions
- TMESH_IDENTITY env var is per-session (tmux set-environment)
- Identity file at ~/.tmesh/identity is shared fallback
- Send writes to: ~/.tmesh/nodes/{target}/inbox/
- Each node reads from: ~/.tmesh/nodes/{myIdentity}/inbox/
- Conversation log at: ~/.tmesh/nodes/{myIdentity}/conversation.log
- Wire format is minimal: [tmesh TS] <-- sender: content
- PROTOCOL.md teaches agents how to reply (no reply instructions in messages)
- PostToolUse hook exists but is OPTIONAL -- conversation log is the real solution

## What's Next (v0.1.0 Redesign)

### Command Consolidation (20 -> 6 essential)
| New | Old | Notes |
|-----|-----|-------|
| tmesh setup | hooks install, register | One-time global install |
| tmesh join <id> | identify, init | Join mesh + start watch pane |
| tmesh send <target> "msg" | send, message | Unified send |
| tmesh log | inbox, read, log | Conversation view |
| tmesh who | who, ls, topology | Mesh status |
| tmesh peek <session> | peek | Screen capture |

Keep broadcast as `tmesh send * "msg"`. Keep @ as syntactic sugar.
Keep viz as `tmesh who --viz`. Delete the rest or make internal.

### tmesh setup (one-time global)
- Symlink tmesh into PATH
- Install tmux hooks (auto-join)
- Create ~/.tmesh/
- Optionally: configure tmux to auto-split watch pane

### Conversation Log Improvements
- Channel filtering in log view
- Log rotation / max size
- Consider: per-peer log files vs single log

### Open Questions
- Should watch pane auto-start on tmesh join?
- Should tmesh setup modify ~/.tmux.conf?
- Broadcast log entry format: --> * vs --> * (broadcast)
- How to handle channel subscriptions in the log view?

## Stats
- 389 tests, 920 assertions
- 22 CLI commands (consolidation pending)
- 0 production dependencies
- ~4,500 lines of TypeScript

## Key Files
- src/core/conversation.ts — conversation log (the new core)
- src/core/transport.ts — file-based signal delivery
- src/core/wire.ts — wire format + PROTOCOL.md
- src/core/init.ts — session hot-bootstrap
- src/core/display.ts — unified display formatting
- src/cli/commands/message.ts — unified send + inject + notify
- src/hooks/post-tool-tmesh.ts — optional Claude Code hook
- test/qa/acceptance.test.ts — system-level QA suite
- justfile — task runner
