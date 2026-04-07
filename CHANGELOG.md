# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2] - 2026-04-07

Renamed from tmesh to tresh. The mesh never happened. The shuttle works.

### Changed
- Project renamed: tmesh -> tresh (Trivially Reliable Event Shuttle for Harnesses)
- All env vars: `TMESH_*` -> `TRESH_*`
- Inbox directory: `~/.tmesh` -> `~/.tresh`
- tmux wait-for channels: `tmesh-inbox-*` -> `tresh-inbox-*`
- New logo (struck-through M, neon pink)
- README rewritten in Hitchhiker's Guide voice

### Added
- Trash can with I/O signals in logo
- Link to [tmesh](https://github.com/sparklingslop/tmesh) (the real mesh, coming soon)

## [0.1.1] - 2026-04-07

### Fixed
- `TRESH_DIR` now resolved per-call (was stale if env changed after import)
- Push watch kills `tmux wait-for` child on `stop()` (prevents process leak)
- `VERSION` read from `package.json` (single source of truth)

## [0.1.0] - 2026-04-07

First-principles rewrite. The v0 codebase (~2000 lines) was replaced with ~450 lines.

### Added
- Push-based receive via `tmux wait-for` (zero-polling, zero-CPU block)
- Poll-based receive via `setInterval` (works without tmux)
- Auto mode: push with poll fallback
- Direct injection via `tmux send-keys`
- One-shot inbox read
- CLI: `ls`, `send`, `inject`, `watch`, `inbox`, `identify`

### Removed
- Everything from v0.0.x (custom ULID, branded types, Result monad, wire format, factory pattern, orchestration framework)

See [v0.0.11-legacy](https://github.com/sparklingslop/tresh/releases/tag/v0.0.11-legacy) for the previous codebase.
