#!/usr/bin/env bun
/**
 * tmesh CLI entry point.
 *
 * Minimal arg parser and command dispatcher. Zero dependencies.
 */

import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Commands loaded in Phase 1:
// import './commands/ls';
// import './commands/who';
// import './commands/identify';
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  readonly command: string;
  readonly args: readonly string[];
  readonly flags: ReadonlyMap<string, string | boolean>;
}

export type CommandHandler = (
  args: readonly string[],
  flags: ReadonlyMap<string, string | boolean>,
) => Promise<number>;

// ---------------------------------------------------------------------------
// CLI output helpers (stdout/stderr -- not application logging)
// ---------------------------------------------------------------------------

function out(message: string): void {
  process.stdout.write(message + '\n');
}

function cliError(message: string): void {
  process.stderr.write(message + '\n');
}

// ---------------------------------------------------------------------------
// Command registry (module-level, populated by registerCommand)
// ---------------------------------------------------------------------------

const commands: Map<string, CommandHandler> = new Map();

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

export function parseArgs(argv: readonly string[]): Result<ParsedArgs> {
  const raw = argv.slice(2);

  if (raw.length === 0) {
    return Err(new Error('No command provided. Run "tmesh help" for usage.'));
  }

  const command = raw[0]!;
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();

  let i = 1;
  while (i < raw.length) {
    const token = raw[i]!;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = raw[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(key, next);
        i += 2;
      } else {
        flags.set(key, true);
        i += 1;
      }
    } else {
      positional.push(token);
      i += 1;
    }
  }

  return Ok({ command, args: positional, flags });
}

// ---------------------------------------------------------------------------
// registerCommand
// ---------------------------------------------------------------------------

export function registerCommand(name: string, handler: CommandHandler): void {
  commands.set(name, handler);
}

// ---------------------------------------------------------------------------
// Usage / help
// ---------------------------------------------------------------------------

function printUsage(): void {
  const usage = `tmesh - tmux-native agent mesh

Usage: tmesh <command> [options]

Commands:
  ls          List all tmesh nodes (tmux sessions)
  who         Show identity of current session
  identify    Set identity for current session
  help        Show this help message

Options:
  --help      Show help for a command

Run "tmesh <command> --help" for command-specific help.`;
  out(usage);
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

export async function run(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if (!parsed.ok) {
    cliError(`Error: ${parsed.error.message}`);
    printUsage();
    return 1;
  }

  const { command, args, flags } = parsed.value;

  // Global --help or help command
  if (command === 'help' || flags.get('help') === true) {
    printUsage();
    return 0;
  }

  const handler = commands.get(command);
  if (handler === undefined) {
    cliError(`Unknown command: ${command}`);
    printUsage();
    return 1;
  }

  return handler(args, flags);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const exitCode = await run(process.argv);
  process.exit(exitCode);
}
