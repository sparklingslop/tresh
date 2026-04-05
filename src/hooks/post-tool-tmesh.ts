#!/usr/bin/env bun
/**
 * tmesh PostToolUse hook for Claude Code.
 *
 * Fires after Bash tool calls. If the output contains a [tmesh -->] line,
 * re-emits it so it appears in the conversation flow (not buried in
 * the tool result block).
 *
 * Install in .claude/settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Bash",
 *       "hooks": [{
 *         "type": "command",
 *         "command": "bun /path/to/tmesh/src/hooks/post-tool-tmesh.ts"
 *       }]
 *     }]
 *   }
 * }
 */

import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Core logic (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Extract tmesh outbound lines from tool output.
 * Only extracts --> (outbound) lines, not <-- (inbound).
 */
export function extractTmeshLines(input: string): string[] {
  if (input.length === 0) return [];

  return input
    .split('\n')
    .filter(line => line.includes('[tmesh ') && line.includes('-->'))
    .map(line => line.replace(/^[\s⎿]*/, '').trim())
    .filter(line => line.length > 0);
}

// ---------------------------------------------------------------------------
// Hook entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  try {
    const input = readFileSync('/dev/stdin', 'utf-8');
    const lines = extractTmeshLines(input);
    for (const line of lines) {
      process.stdout.write(line + '\n');
    }
  } catch {
    // Silent failure -- hooks must not break the session
  }
}
