# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.8] - 2026-04-05

### Added

- **Channel in conversation log**: Log lines now include `#channel` when the channel is not `default`. Both outbound (`-->`) and inbound (`<--`) entries include channel info.
- **Structured log filtering**: `--peer` and `--channel` flags use parsed log line structure instead of naive substring matching. Filters can be combined.
- **Log rotation**: Conversation logs auto-rotate at 1MB. Up to 3 rotations (`conversation.log.1`, `.2`, `.3`).
- **Auto-watch pane**: `tmesh join` automatically opens a 6-line tmux split pane running `tmesh log --follow`. Opt-out with `--no-watch`. Detects existing watch panes to prevent duplicates.
- **`parseLogLine()`**: Exported utility for structured parsing of conversation log lines (direction, peer, channel).
- **Standalone binary**: macOS binary attached to GitHub release (57MB, zero runtime dependencies).

### Architecture

- 421+ tests, 998+ assertions
- Watch pane module (`src/core/watchpane.ts`) for tmux pane lifecycle management

## [0.0.7] - 2026-04-05

### Changed

- **CLI consolidated from 22 commands to 6**: `setup`, `join`, `send`, `log`, `who`, `peek`. All old commands remain callable but hidden from `tmesh help`.

### Added

- **CLI: setup**: `tmesh setup` -- one-time global install. Creates `~/.tmesh/`, installs tmux hooks. Supports `--status` and `--uninstall`.
- **CLI: join**: `tmesh join <identity>` -- replaces `identify` + `init`. Single-arg sets identity for current session. Two-arg (`tmesh join <session> <identity>`) hot-bootstraps a remote session.
- **CLI: send** (consolidated): `tmesh send <target> "msg"` now does the full pipeline (signal + inject + notify + log). `tmesh send * "msg"` for broadcast. `--ping` flag for pings. `--channel` for cast. @-mentions auto-route to mentioned nodes.
- **CLI: log** (consolidated): `tmesh log --follow` / `-f` for live tail (replaces `watch`). `--inbox` lists pending signals. `--read <id>` and `--ack <id>` for signal management. `--peer <name>` filters by peer.
- **CLI: who** (consolidated): `--all` shows all tmux sessions (replaces `ls`). `--topology` shows inbox counts. `--viz` for gum dashboard. `--json` for machine output.
- **Short flag `-f`**: alias for `--follow` in `tmesh log`.

### Architecture

- 403+ tests, 960+ assertions
- 6 essential CLI commands (22 hidden for backwards compatibility)
- Zero production dependencies maintained

## [0.0.6] - 2026-04-05

### Added

- **Conversation log**: append-only per-node log file at `~/.tmesh/nodes/{identity}/conversation.log`. Every send appends `-->`, every delivery appends `<--`. Both directions in one stream. The definitive conversation view.
- **CLI: log**: `tmesh log` shows conversation history. Supports `--tail N`.
- **CLI: message**: Unified send command -- file delivery + wire-formatted tmux injection + display-message notification.
- **CLI: init**: `tmesh init <session> <identity>` hot-bootstraps any tmux session onto the mesh from outside. Sets identity, creates inbox, injects shell alias + protocol primer.
- **Wire format v3**: `[tmesh YYYY-MM-DD HH:MM:SS] <-- sender: content`. Clean, timestamped, no pipes/XML/escaping. Direction arrows: `-->` outbound, `<--` inbound.
- **PROTOCOL.md**: Auto-generated protocol document dropped into `~/.tmesh/` on identify. Teaches any agent how to send, receive, and reply via tmesh.
- **tmesh watch** now tails the conversation log (both directions) instead of watching inbox files.
- **justfile**: Task runner with `just test`, `just qa`, `just test-all`, `just viz`, `just status`.
- **QA acceptance suite**: 31 system-level tests against real tmux sessions (`just qa`).

### Fixed

- **Inbox routing**: nodes read from `nodes/{identity}/inbox/` where send delivers.
- **Per-session identity**: `TMESH_IDENTITY` env var takes priority over shared file.
- **Wire format escaping**: eliminated pipes, XML tags, quotes from injected messages.

### Verified

- Real-time bidirectional tmesh communication between live Claude Code agents: tmesh-hq <-> nano-research, tmesh-hq <-> pong, tmesh-hq <-> nano-autoevolve.
- nano-research and pong both replied via tmesh (not cortex-mesh) after hot-init.

### Architecture

- 389+ tests, 920+ assertions
- 22 CLI commands
- Conversation log is the new core (no adapters needed for visibility)

## [0.0.5] - 2026-04-05

### Added

- **CLI: @**: `tmesh @ "Hey @alice and @bob, deploy ready"` -- parses @mentions from message text, delivers a signal to each mentioned node with tmux notification. Skips self-mentions. Harness-agnostic.
- **@-mention parser**: `parseMentions()` extracts @identities from text. Handles dots, hyphens, underscores. Excludes email-like patterns. Deduplicates.
- **CLI: hooks**: `tmesh hooks install` installs tmux global hooks (`session-created`, `session-closed`) that auto-register/deregister nodes. `tmesh hooks uninstall` removes them. `tmesh hooks status` shows active hooks.
- **CLI: register/deregister**: Internal commands called by tmux hooks. Creates/removes node inbox directories.
- **Library exports**: `parseMentions`, `installHooks`, `uninstallHooks`, `buildInstallCommands`, `buildUninstallCommands`, `HOOK_NAMES`.

### Architecture

- 309+ tests, 768+ assertions
- 18 CLI commands (+ 2 internal: register, deregister)

## [0.0.4] - 2026-04-05

### Fixed

- **Inbox routing**: Nodes now read from `{home}/nodes/{identity}/inbox/` where `send` actually delivers signals. Previously `inbox`/`read`/`ack`/`watch` read from the root `{home}/inbox/` which was never written to by other nodes.
- **Per-session identity**: `resolveEffectiveIdentity()` checks `TMESH_IDENTITY` env var first (per-session via `tmux set-environment`), then falls back to the shared identity file. Prevents identity collision when multiple sessions share `~/.tmesh`.

### Added

- **Tmux notifications**: `send` now triggers a `tmux display-message` on the target session's status bar. Non-invasive (doesn't interrupt the running process). Best-effort -- signal delivery works even if notification fails.
- **CLI: viz**: `tmesh viz` renders a gum-powered visual mesh dashboard. `--json` for raw data output. Falls back to JSON if gum/jq not installed.
- **Viz data collector**: `collectVizData()` gathers all mesh state into a single JSON blob.
- **Jenga-tower logo**: New SVG logo with stacked letter blocks in the Sparkling Slop palette (cyan, purple, pink, lime, amber). Animated signal pulses, dot grid background.

### Verified

- Real-time bidirectional communication between tmesh-hq and nano-autoevolve sessions using `tmesh watch` in a tmux split pane + `tmesh send` with tmux notifications.

### Architecture

- 276+ tests, 712+ assertions
- 15 CLI commands fully operational

## [0.0.3] - 2026-04-05

### Added

- **CLI: inject**: `tmesh inject <session> "text"` -- raw `tmux send-keys` injection into any tmux session. Hardened shell escaping prevents command injection.
- **CLI: peek**: `tmesh peek <session>` -- `tmux capture-pane` screen snapshot with optional `--lines` flag.
- **Inject module**: `escapeForTmux()` escapes 14 shell metacharacter classes (quotes, dollar signs, backticks, semicolons, pipes, ampersands, parentheses, control chars). `validateSessionTarget()` whitelists session name characters.
- **Library API**: `mesh.inject()` and `mesh.peek()` added to `createTmesh()` factory.
- **Exports**: `inject`, `peek`, `escapeForTmux`, `validateSessionTarget`, `buildInjectCommand`, `buildPeekCommand` and associated types exported from library entry point.

### Security

- All tmux commands use `execFileSync` (not `execSync`) to avoid shell interpolation.
- Session target names validated against strict regex pattern before use in any command.
- Message content escaped defensively even though `execFileSync` doesn't invoke a shell.
- 5-second timeout on all tmux exec calls to prevent hangs.

### Architecture

- 263+ tests, 682+ assertions
- 14 CLI commands fully operational

## [0.0.2] - 2026-04-05

### Added

- **Transport**: File-based signal delivery with atomic writes (temp file + rename). `deliverSignal`, `listInbox`, `readSignalFile`, `ackSignal`, `cleanExpired`.
- **Watch**: Inbox watcher via `fs.watch` with polling fallback. Async iterator API with `AbortSignal` support.
- **CLI: send**: `tmesh send <target> "message"` with `--type`, `--channel`, `--ttl` flags.
- **CLI: broadcast**: `tmesh broadcast "message"` sends to all known nodes.
- **CLI: cast**: `tmesh cast <channel> "message"` sends to a channel/topic.
- **CLI: inbox**: `tmesh inbox` lists pending signals.
- **CLI: read**: `tmesh read <signal-id>` reads a specific signal.
- **CLI: ack**: `tmesh ack <signal-id>` acknowledges (deletes) a signal.
- **CLI: watch**: `tmesh watch` tails incoming signals with optional `--channel` filter.
- **CLI: ping**: `tmesh ping <target>` sends a ping signal.
- **CLI: topology**: `tmesh topology` shows all nodes and connection state.
- **Library API**: `createTmesh()` factory -- the primary programmatic interface with `send`, `broadcast`, `discover`, `inbox`, `read`, `ack`, `clean`, and `watch` methods.
- **Nodes**: `listNodes()` utility for peer discovery from the nodes/ directory.
- **Binary**: Standalone binary build via `bun build --compile` (57MB macOS binary).

### Architecture

- 208+ tests, 611+ assertions
- 12 CLI commands fully operational
- All Phase 2-4 modules exported from library entry point

## [0.0.1] - 2026-04-05

### Added

- **Discovery**: `tmesh ls` lists all tmux sessions with mesh metadata (identity, PID, command, status). Supports `--json` for machine-readable output.
- **Identity**: `tmesh identify <name>` sets the mesh identity for the current session. Writes to `~/.tmesh/identity` (atomic file write) and sets `TMESH_IDENTITY` tmux environment variable.
- **Who**: `tmesh who` shows only sessions with assigned mesh identities.
- **SDK**: Library entry point (`import { ... } from 'tmesh'`) re-exports all core modules for programmatic use. SDK-first design -- CLI dogfoods the SDK.
- **Types**: Branded types (`SessionName`, `Identity`, `Ulid`) with compile-time safety. `Result<T, E>` monad for error handling without exceptions.
- **ULID**: Monotonic ULID generation with Crockford base32 encoding. Zero dependencies.
- **Signal model**: `TmeshSignal` type definition and `createSignal()` factory (foundation for Phase 2 messaging).

### Architecture

- Zero production dependencies -- only `node:*` built-ins
- TypeScript strict mode with `noUncheckedIndexedAccess`
- 139+ tests, 481+ assertions
- Bun runtime and test runner

[0.0.8]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.8
[0.0.7]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.7
[0.0.6]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.6
[0.0.5]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.5
[0.0.4]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.4
[0.0.3]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.3
[0.0.2]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.2
[0.0.1]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.1
