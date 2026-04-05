/**
 * @-mention parser for tmesh.
 *
 * Extracts @identity mentions from message text.
 * Used by the `tmesh @` command to auto-route signals.
 *
 * Zero dependencies -- pure TypeScript.
 */

// Match @identity where:
// - preceded by start of string, whitespace, or punctuation (not alphanumeric -- excludes emails)
// - identity starts with alphanumeric
// - identity can contain alphanumeric, dots, hyphens, underscores
const MENTION_PATTERN = /(?:^|(?<=[\s()\[\]{},.:;!?]))@([a-zA-Z0-9][a-zA-Z0-9._-]*)/g;

/**
 * Parse @mentions from message text.
 *
 * Returns deduplicated list of mentioned identities in order of appearance.
 * Excludes email-like patterns (user@domain).
 */
export function parseMentions(content: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const match of content.matchAll(MENTION_PATTERN)) {
    const identity = match[1]!;
    if (!seen.has(identity)) {
      seen.add(identity);
      result.push(identity);
    }
  }

  return result;
}
