# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-07

First-principles rewrite. The v0 codebase (~2000 lines) was replaced with a clean ~200-line implementation centered on `tmux wait-for` as the push primitive.

### Added
- Push-based receive via `tmux wait-for` (zero-polling, zero-CPU block)
- Poll-based receive via `setInterval` (works without tmux)
- Auto mode: push with poll fallback
- Direct injection via `tmux send-keys`
- One-shot inbox read
- CLI: `ls`, `send`, `inject`, `watch`, `inbox`, `identify`
- Library API: `discover()`, `send()`, `watch()`, `inject()`, `inbox()`, `identify()`

### Removed
- Custom ULID generator
- Branded types (Identity, SessionName, Ulid)
- Result monad
- Wire format translation layer
- Factory pattern (createTmesh)
- Agent orchestration framework (pane registry, lifecycle, supervision, orchestrator)
- Conversation logging system

### Design
- Signal format: `{ from, to, body, ts }` -- 4 fields, no ceremony
- Identity: `TMESH_IDENTITY` env var, no fallback chain
- Zero dependencies in core (only `node:*` built-ins)

See [v0.0.11-legacy](https://github.com/sparklingslop/tmesh/releases/tag/v0.0.11-legacy) for the previous codebase.
