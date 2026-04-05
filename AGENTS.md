# tmesh -- Agent Instructions

This file provides instructions for AI coding agents working with or integrating tmesh.

## What is tmesh?

A TypeScript SDK and CLI for zero-infrastructure inter-session communication between AI agents running in tmux. SDK-first design -- the library API is the primary interface.

## Install

```bash
bun add tmesh
```

## SDK Usage (primary interface)

```typescript
import { discover, identify, createSignal, type TmeshNode, type Result } from 'tmesh';

// All core functions return Result<T, Error> -- no thrown exceptions
const result: Result<TmeshNode[]> = discover();
if (result.ok) {
  // result.value is TmeshNode[]
}
```

## Key Types

- `Result<T, E>` -- Ok/Err monad, check `.ok` before accessing `.value` or `.error`
- `TmeshNode` -- discovered session: sessionName, identity, pid, command, status
- `TmeshSignal` -- message unit: id (ULID), sender, target, type, channel, content
- `Identity` -- branded string validated with `Identity()` constructor
- `SessionName` -- branded string validated with `SessionName()` constructor

## Running Tests

```bash
bun test
```

## Project Structure

- `src/core/` -- SDK modules (discovery, identity, signal)
- `src/cli/` -- CLI wrapper (thin layer over SDK)
- `src/index.ts` -- library entry point
- `test/` -- test files mirror src/ structure

## Rules

- Zero production dependencies (only node:* built-ins)
- TypeScript strict mode, no `any`
- Result types for errors, no thrown exceptions in core
- Bun runtime and test runner
- TDD -- tests first
