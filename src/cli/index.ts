#!/usr/bin/env bun
/**
 * tmesh CLI entry point.
 *
 * Minimal arg parser and command dispatcher. Zero dependencies.
 *
 * 6 essential commands (v0.0.7 consolidation):
 *   setup, join, send, log, who, peek
 *
 * Hidden commands (still callable, not in help):
 *   ls, identify, init, message, broadcast, cast, inbox, read, ack,
 *   watch, ping, topology, inject, viz, @, hooks, register, deregister
 */

import { Ok, Err } from '../types';
import type { Result } from '../types';
import { getCommand } from './registry';
export { registerCommand } from './registry';
export type { CommandHandler } from './registry';

// ---------------------------------------------------------------------------
// Essential commands (v0.0.7):
import './commands/setup';
import './commands/join';
import './commands/send';
import './commands/log';
import './commands/who';
import './commands/peek';

// Hidden commands (backwards compat, hook targets, power-user):
import './commands/ls';
import './commands/identify';
import './commands/init';
import './commands/message';
import './commands/broadcast';
import './commands/cast';
import './commands/inbox';
import './commands/read';
import './commands/ack';
import './commands/watch';
import './commands/ping';
import './commands/topology';
import './commands/inject';
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
    } else if (token === '-f') {
      // Short flag for --follow
      flags.set('follow', true);
      i += 1;
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
  setup       One-time global install (home dir + tmux hooks)
  join        Join the mesh (set identity, create inbox)
  send        Send a message to a node (or * for broadcast)
  log         Conversation history, inbox, and live tail
  who         Show mesh nodes and topology
  peek        Capture-pane snapshot of a tmux session

Flags (send):
  --ping                Send a ping signal (no message needed)
  --type <type>         Signal type: message|command|event
  --channel <name>      Channel/topic name
  --ttl <seconds>       Time-to-live for the signal

Flags (log):
  --follow, -f          Live tail (like tail -f)
  --tail <n>            Show last N lines
  --peer <name>         Filter by peer identity
  --inbox               List pending signals
  --read <signal-id>    Read a specific signal
  --ack <signal-id>     Acknowledge (delete) a signal

Flags (who):
  --all                 Show all tmux sessions (not just identified)
  --topology            Show topology with inbox counts
  --viz                 Visual dashboard (requires gum)
  --json                JSON output

Flags (setup):
  --status              Show current setup state
  --uninstall           Remove tmux hooks

Options:
  --help                Show this help message

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
