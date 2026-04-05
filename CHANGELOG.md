# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.1]: https://github.com/jankowtf/tmesh/releases/tag/v0.0.1
