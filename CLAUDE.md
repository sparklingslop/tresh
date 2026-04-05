# tmesh

**tmux-native agent mesh. Zero infrastructure inter-session communication.**

## First Action

Read `HANDOFF.md` — it contains the full architecture, data model, CLI design, library API, tech stack, project structure, empirical findings, and implementation priority from the session that conceived this project.

## Rules

1. **Bun** for everything — runtime, test, build, package management
2. **Zero dependencies** in core — only `node:*` built-ins
3. **TypeScript strict mode**
4. **TDD** — write tests first, then implement
5. **No emojis** in code or docs
6. **MIT license**
7. **Keep it minimal** — this is a Unix tool, not a framework

## Implementation Order

Follow the 6 phases in HANDOFF.md. Start with Phase 1 (Discovery + Identity).

## Quality Bar

- Every function has a test
- CLI commands work as documented in HANDOFF.md
- `bun test` passes before every commit
- Library API matches the interface in HANDOFF.md
- README is world-class (this is a public credibility project)
