/**
 * Agent definitions module for tmesh.
 *
 * Agent definitions are markdown files with YAML frontmatter.
 * Filesystem-based discovery from user-level (~/.tmesh/agents/)
 * and project-level (.tmesh/agents/) directories.
 *
 * Includes a minimal YAML parser (key: value, arrays as - item)
 * to maintain the zero-dependency constraint.
 *
 * Zero dependencies -- only node:* built-ins.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Ok, Err } from '../types';
import type { Result } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  /** Agent name (from frontmatter) */
  readonly name: string;
  /** Description of what the agent does */
  readonly description: string;
  /** Preferred model (optional) */
  readonly model?: string;
  /** Allowed tools (optional) */
  readonly tools?: readonly string[];
  /** The system prompt body (markdown content after frontmatter) */
  readonly systemPrompt: string;
  /** Source file path */
  readonly source: string;
  /** Scope: 'user' or 'project' */
  readonly scope: 'user' | 'project';
}

export interface DiscoverAgentsOptions {
  /** User-level agents directory (default: ~/.tmesh/agents) */
  readonly userDir?: string;
  /** Project-level agents directory (default: .tmesh/agents in cwd) */
  readonly projectDir?: string;
  /** Scope filter: 'user', 'project', or 'both' (default: 'both') */
  readonly scope?: 'user' | 'project' | 'both';
}

// ---------------------------------------------------------------------------
// Minimal YAML frontmatter parser
// ---------------------------------------------------------------------------

/**
 * Strip surrounding quotes (single or double) from a string value.
 */
function stripQuotes(value: string): string {
  if (value.length >= 2) {
    if (
      (value[0] === '"' && value[value.length - 1] === '"') ||
      (value[0] === "'" && value[value.length - 1] === "'")
    ) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Parse YAML frontmatter from markdown content.
 *
 * Looks for `---\n...\n---` at the very start of the file. Parses the
 * content between delimiters as minimal YAML (key: value per line,
 * arrays as `  - item` lines).
 *
 * Returns [frontmatter object, body string after closing delimiter].
 */
export function parseFrontmatter(
  content: string,
): Result<{ frontmatter: Record<string, unknown>; body: string }> {
  // Must start with --- on the first line
  if (!content.startsWith('---')) {
    return Err(new Error('No frontmatter: file does not start with ---'));
  }

  // Find the closing ---
  const closingIndex = content.indexOf('\n---', 3);
  if (closingIndex === -1) {
    return Err(new Error('No frontmatter: missing closing --- delimiter'));
  }

  const yamlBlock = content.slice(4, closingIndex); // skip opening "---\n"
  const body = content.slice(closingIndex + 4); // skip "\n---"

  // Parse the minimal YAML
  const frontmatter: Record<string, unknown> = {};
  const lines = yamlBlock.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // Array item line: "  - value"
    if (/^\s+-\s+/.test(line) && currentKey !== null) {
      const itemValue = line.replace(/^\s+-\s+/, '').trim();
      if (currentArray === null) {
        currentArray = [];
      }
      currentArray.push(stripQuotes(itemValue));
      continue;
    }

    // Flush any pending array
    if (currentKey !== null && currentArray !== null) {
      frontmatter[currentKey] = currentArray;
      currentArray = null;
      currentKey = null;
    }

    // Key: value line
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      // Skip blank lines and lines without colons
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key.length === 0) continue;

    if (value.length === 0) {
      // Could be start of an array or empty value
      currentKey = key;
      currentArray = null;
      frontmatter[key] = value; // default empty string; overwritten if array items follow
    } else {
      currentKey = key;
      currentArray = null;
      frontmatter[key] = stripQuotes(value);
    }
  }

  // Flush final pending array
  if (currentKey !== null && currentArray !== null) {
    frontmatter[currentKey] = currentArray;
  }

  return Ok({ frontmatter, body });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an agent definition has required fields.
 *
 * Required: name (non-empty), description (non-empty), source, scope.
 * Optional: model, tools.
 */
export function validateAgentDef(def: Partial<AgentDefinition>): Result<AgentDefinition> {
  if (!def.name || def.name.length === 0) {
    return Err(new Error('Agent definition missing required field: name'));
  }
  if (!def.description || def.description.length === 0) {
    return Err(new Error('Agent definition missing required field: description'));
  }
  if (!def.source || def.source.length === 0) {
    return Err(new Error('Agent definition missing required field: source'));
  }
  if (!def.scope) {
    return Err(new Error('Agent definition missing required field: scope'));
  }

  const validated: AgentDefinition = {
    name: def.name,
    description: def.description,
    systemPrompt: def.systemPrompt ?? '',
    source: def.source,
    scope: def.scope,
    ...(def.model !== undefined ? { model: def.model } : {}),
    ...(def.tools !== undefined ? { tools: def.tools } : {}),
  };

  return Ok(validated);
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single agent markdown file into an AgentDefinition.
 *
 * Extracts YAML frontmatter for metadata and uses the markdown body
 * after frontmatter as the system prompt.
 */
export function parseAgentFile(
  content: string,
  source: string,
  scope: 'user' | 'project',
): Result<AgentDefinition> {
  const fmResult = parseFrontmatter(content);
  if (!fmResult.ok) {
    return Err(fmResult.error);
  }

  const { frontmatter, body } = fmResult.value;

  const partial: Partial<AgentDefinition> = {
    name: typeof frontmatter['name'] === 'string' ? frontmatter['name'] : undefined,
    description:
      typeof frontmatter['description'] === 'string' ? frontmatter['description'] : undefined,
    model: typeof frontmatter['model'] === 'string' ? frontmatter['model'] : undefined,
    tools: Array.isArray(frontmatter['tools'])
      ? (frontmatter['tools'] as string[])
      : undefined,
    systemPrompt: body.startsWith('\n') ? body.slice(1) : body,
    source,
    scope,
  };

  return validateAgentDef(partial);
}

// ---------------------------------------------------------------------------
// Directory scanning
// ---------------------------------------------------------------------------

/**
 * Read all .md files from a directory and parse them as agent definitions.
 * Returns successfully parsed agents; silently skips failures.
 */
async function scanDirectory(
  dir: string,
  scope: 'user' | 'project',
): Promise<AgentDefinition[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    // Directory doesn't exist or not readable -- not an error
    return [];
  }

  const mdFiles = entries.filter((name) => name.endsWith('.md'));
  const agents: AgentDefinition[] = [];

  for (const file of mdFiles) {
    const filePath = join(dir, file);
    try {
      const content = await readFile(filePath, 'utf-8');
      const result = parseAgentFile(content, filePath, scope);
      if (result.ok) {
        agents.push(result.value);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return agents;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Discover agent definitions from filesystem.
 *
 * Scans user-level (~/.tmesh/agents/) and project-level (.tmesh/agents/)
 * directories for markdown files with YAML frontmatter defining agents.
 */
export async function discoverAgents(
  options?: DiscoverAgentsOptions,
): Promise<Result<AgentDefinition[]>> {
  const home = process.env['HOME'] ?? '~';
  const userDir = options?.userDir ?? join(home, '.tmesh', 'agents');
  const projectDir = options?.projectDir ?? join(process.cwd(), '.tmesh', 'agents');
  const scope = options?.scope ?? 'both';

  const agents: AgentDefinition[] = [];

  if (scope === 'user' || scope === 'both') {
    const userAgents = await scanDirectory(userDir, 'user');
    agents.push(...userAgents);
  }

  if (scope === 'project' || scope === 'both') {
    const projectAgents = await scanDirectory(projectDir, 'project');
    agents.push(...projectAgents);
  }

  return Ok(agents);
}
