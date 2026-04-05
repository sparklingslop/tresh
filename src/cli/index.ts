#!/usr/bin/env bun
/**
 * tmesh CLI entry point.
 *
 * Minimal arg parser and command dispatcher. Zero dependencies.
 */

import { Ok, Err } from '../types';
import type { Result } from '../types';
import { getCommand } from './registry';
export { registerCommand } from './registry';
export type { CommandHandler } from './registry';

// ---------------------------------------------------------------------------
// Commands loaded in Phase 1:
import './commands/ls';
import './commands/who';
import './commands/identify';
// Commands loaded in Phase 2:
import './commands/send';
import './commands/inbox';
import './commands/read';
import './commands/ack';
// Commands loaded in Phase 3:
import './commands/broadcast';
import './commands/cast';
import './commands/watch';
import './commands/ping';
import './commands/topology';
// Commands loaded in Phase 5:
import './commands/inject';
import './commands/peek';
import './commands/viz';
import './commands/at';
import './commands/hooks';
import './commands/register';
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  readonly command: string;
  readonly args: readonly string[];
  readonly flags: ReadonlyMap<string, string | boolean>;
}

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
// Usage / help
// ---------------------------------------------------------------------------

function printUsage(): void {
  const usage = `tmesh - tmux-native agent mesh

Usage: tmesh <command> [options]

Commands:
  ls          List all tmesh nodes (tmux sessions)
  who         Show identity of current session
  identify    Set identity for current session
  send        Send a signal to a specific node
  broadcast   Send a signal to all known nodes
  cast        Send to a channel/topic
  inbox       List pending signals in the inbox
  read        Read a specific signal by ID
  ack         Acknowledge (delete) a signal
  watch       Tail incoming signals (like tail -f)
  ping        Ping a node (delivery check)
  topology    Show all nodes and connections
  inject      Raw tmux send-keys injection
  peek        Capture-pane snapshot of a session
  viz         Visual mesh dashboard (requires gum)
  @           Send to all @mentioned nodes
  hooks       Manage tmux auto-registration hooks
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

  const handler = getCommand(command);
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
