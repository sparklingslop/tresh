/**
 * Command registry for the tmesh CLI.
 *
 * Separated from index.ts to avoid circular imports when command
 * files import registerCommand while index.ts imports command files.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandHandler = (
  args: readonly string[],
  flags: ReadonlyMap<string, string | boolean>,
) => Promise<number>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const commands: Map<string, CommandHandler> = new Map();

export function registerCommand(name: string, handler: CommandHandler): void {
  commands.set(name, handler);
}

export function getCommand(name: string): CommandHandler | undefined {
  return commands.get(name);
}
