# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.2]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.2
[0.0.1]: https://github.com/sparklingslop/tmesh/releases/tag/v0.0.1
