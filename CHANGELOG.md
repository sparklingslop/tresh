# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.4]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.4
[0.0.3]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.3
[0.0.2]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.2
[0.0.1]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.1
