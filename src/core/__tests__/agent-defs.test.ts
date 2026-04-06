/**
 * Tests for agent definitions module.
 *
 * Agent definitions are markdown files with YAML frontmatter.
 * Filesystem-based discovery from user-level and project-level directories.
 *
 * Tests are structured bottom-up: parseFrontmatter -> validateAgentDef ->
 * parseAgentFile -> discoverAgents.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  parseFrontmatter,
  validateAgentDef,
  parseAgentFile,
  discoverAgents,
} from '../agent-defs';

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  test('parses simple key-value frontmatter', () => {
    const content = `---
name: reviewer
description: Code review specialist
---

You are a code reviewer.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter['name']).toBe('reviewer');
    expect(result.value.frontmatter['description']).toBe('Code review specialist');
    expect(result.value.body.trim()).toBe('You are a code reviewer.');
  });

  test('parses frontmatter with array values', () => {
    const content = `---
name: builder
description: Build specialist
tools:
  - read
  - grep
  - glob
---

Build things.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter['tools']).toEqual(['read', 'grep', 'glob']);
  });

  test('handles optional fields gracefully', () => {
    const content = `---
name: simple
description: Simple agent
---

Do simple things.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter['model']).toBeUndefined();
    expect(result.value.frontmatter['tools']).toBeUndefined();
  });

  test('returns Err when no frontmatter delimiters', () => {
    const content = 'Just plain markdown without frontmatter.';
    const result = parseFrontmatter(content);
    expect(result.ok).toBe(false);
  });

  test('returns Err when only opening delimiter', () => {
    const content = `---
name: broken
`;
    const result = parseFrontmatter(content);
    expect(result.ok).toBe(false);
  });

  test('handles empty body after frontmatter', () => {
    const content = `---
name: empty-body
description: No body
---
`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body.trim()).toBe('');
  });

  test('handles multiline body with markdown formatting', () => {
    const content = `---
name: rich
description: Rich body
---

# Heading

- bullet 1
- bullet 2

Paragraph with **bold** and _italic_.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toContain('# Heading');
    expect(result.value.body).toContain('- bullet 1');
    expect(result.value.body).toContain('**bold**');
  });

  test('handles quoted string values', () => {
    const content = `---
name: "quoted-name"
description: "A description with: colons"
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter['name']).toBe('quoted-name');
    expect(result.value.frontmatter['description']).toBe('A description with: colons');
  });

  test('handles single-quoted string values', () => {
    const content = `---
name: 'single-quoted'
description: 'Another description'
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter['name']).toBe('single-quoted');
  });

  test('trims whitespace from values', () => {
    const content = `---
name:   spaced-out
description:   lots of space
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter['name']).toBe('spaced-out');
    expect(result.value.frontmatter['description']).toBe('lots of space');
  });

  test('returns Err for frontmatter that does not start at line 1', () => {
    const content = `
---
name: not-at-start
description: bad
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(false);
  });

  test('handles empty array', () => {
    const content = `---
name: no-tools
description: No tools
tools:
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // tools with no array items should be empty string or undefined
    const tools = result.value.frontmatter['tools'];
    expect(tools === '' || tools === undefined || tools === null).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAgentDef
// ---------------------------------------------------------------------------

describe('validateAgentDef', () => {
  test('validates a complete agent definition', () => {
    const result = validateAgentDef({
      name: 'reviewer',
      description: 'Code review specialist',
      model: 'claude-opus-4-6',
      tools: ['read', 'grep'],
      systemPrompt: 'You are a reviewer.',
      source: '/path/to/file.md',
      scope: 'user',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('reviewer');
    expect(result.value.model).toBe('claude-opus-4-6');
  });

  test('validates minimal agent definition (name + description only)', () => {
    const result = validateAgentDef({
      name: 'minimal',
      description: 'Minimal agent',
      systemPrompt: '',
      source: '/path/to/file.md',
      scope: 'project',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('minimal');
    expect(result.value.model).toBeUndefined();
    expect(result.value.tools).toBeUndefined();
  });

  test('returns Err when name is missing', () => {
    const result = validateAgentDef({
      description: 'No name',
      systemPrompt: '',
      source: '/path/to/file.md',
      scope: 'user',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('name');
  });

  test('returns Err when description is missing', () => {
    const result = validateAgentDef({
      name: 'no-desc',
      systemPrompt: '',
      source: '/path/to/file.md',
      scope: 'user',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('description');
  });

  test('returns Err when name is empty string', () => {
    const result = validateAgentDef({
      name: '',
      description: 'Empty name',
      systemPrompt: '',
      source: '/path/to/file.md',
      scope: 'user',
    });
    expect(result.ok).toBe(false);
  });

  test('returns Err when description is empty string', () => {
    const result = validateAgentDef({
      name: 'valid',
      description: '',
      systemPrompt: '',
      source: '/path/to/file.md',
      scope: 'user',
    });
    expect(result.ok).toBe(false);
  });

  test('returns Err when source is missing', () => {
    const result = validateAgentDef({
      name: 'test',
      description: 'Test agent',
      systemPrompt: '',
      scope: 'user',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('source');
  });

  test('returns Err when scope is missing', () => {
    const result = validateAgentDef({
      name: 'test',
      description: 'Test agent',
      systemPrompt: '',
      source: '/path/to/file.md',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('scope');
  });
});

// ---------------------------------------------------------------------------
// parseAgentFile
// ---------------------------------------------------------------------------

describe('parseAgentFile', () => {
  test('parses a complete agent file', () => {
    const content = `---
name: reviewer
description: Code review specialist
model: claude-opus-4-6
tools:
  - read
  - grep
  - glob
---

You are a code reviewer. Focus on:
- Security vulnerabilities
- Performance issues
- API design consistency`;

    const result = parseAgentFile(content, '/home/user/.tmesh/agents/reviewer.md', 'user');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('reviewer');
    expect(result.value.description).toBe('Code review specialist');
    expect(result.value.model).toBe('claude-opus-4-6');
    expect(result.value.tools).toEqual(['read', 'grep', 'glob']);
    expect(result.value.systemPrompt).toContain('You are a code reviewer.');
    expect(result.value.systemPrompt).toContain('Security vulnerabilities');
    expect(result.value.source).toBe('/home/user/.tmesh/agents/reviewer.md');
    expect(result.value.scope).toBe('user');
  });

  test('parses minimal agent file without optional fields', () => {
    const content = `---
name: helper
description: General purpose helper
---

Help with things.`;

    const result = parseAgentFile(content, '/project/.tmesh/agents/helper.md', 'project');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('helper');
    expect(result.value.model).toBeUndefined();
    expect(result.value.tools).toBeUndefined();
    expect(result.value.scope).toBe('project');
  });

  test('returns Err for file without frontmatter', () => {
    const content = 'Just plain text.';
    const result = parseAgentFile(content, '/path/file.md', 'user');
    expect(result.ok).toBe(false);
  });

  test('returns Err for file missing required fields', () => {
    const content = `---
model: claude-opus-4-6
---

No name or description.`;

    const result = parseAgentFile(content, '/path/file.md', 'user');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// discoverAgents -- filesystem integration tests
// ---------------------------------------------------------------------------

describe('discoverAgents', () => {
  let testDir: string;
  let userAgentsDir: string;
  let projectAgentsDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `tmesh-agent-defs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    userAgentsDir = join(testDir, 'user-agents');
    projectAgentsDir = join(testDir, 'project-agents');
    mkdirSync(userAgentsDir, { recursive: true });
    mkdirSync(projectAgentsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test('discovers agents from user directory', async () => {
    writeFileSync(
      join(userAgentsDir, 'reviewer.md'),
      `---
name: reviewer
description: Code review specialist
---

Review code.`,
    );

    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.name).toBe('reviewer');
    expect(result.value[0]!.scope).toBe('user');
  });

  test('discovers agents from project directory', async () => {
    writeFileSync(
      join(projectAgentsDir, 'builder.md'),
      `---
name: builder
description: Build specialist
---

Build things.`,
    );

    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.name).toBe('builder');
    expect(result.value[0]!.scope).toBe('project');
  });

  test('discovers agents from both directories', async () => {
    writeFileSync(
      join(userAgentsDir, 'reviewer.md'),
      `---
name: reviewer
description: Code review specialist
---

Review code.`,
    );
    writeFileSync(
      join(projectAgentsDir, 'builder.md'),
      `---
name: builder
description: Build specialist
---

Build things.`,
    );

    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    const names = result.value.map((a) => a.name).sort();
    expect(names).toEqual(['builder', 'reviewer']);
  });

  test('filters by scope: user only', async () => {
    writeFileSync(
      join(userAgentsDir, 'reviewer.md'),
      `---
name: reviewer
description: Code review specialist
---

Review code.`,
    );
    writeFileSync(
      join(projectAgentsDir, 'builder.md'),
      `---
name: builder
description: Build specialist
---

Build things.`,
    );

    const result = await discoverAgents({
      userDir: userAgentsDir,
      projectDir: projectAgentsDir,
      scope: 'user',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.scope).toBe('user');
  });

  test('filters by scope: project only', async () => {
    writeFileSync(
      join(userAgentsDir, 'reviewer.md'),
      `---
name: reviewer
description: Code review specialist
---

Review code.`,
    );
    writeFileSync(
      join(projectAgentsDir, 'builder.md'),
      `---
name: builder
description: Build specialist
---

Build things.`,
    );

    const result = await discoverAgents({
      userDir: userAgentsDir,
      projectDir: projectAgentsDir,
      scope: 'project',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.scope).toBe('project');
  });

  test('ignores non-md files', async () => {
    writeFileSync(
      join(userAgentsDir, 'reviewer.md'),
      `---
name: reviewer
description: Code review specialist
---

Review code.`,
    );
    writeFileSync(join(userAgentsDir, 'notes.txt'), 'not an agent');
    writeFileSync(join(userAgentsDir, 'config.yaml'), 'key: value');

    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });

  test('returns empty array when directories are empty', async () => {
    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  test('handles non-existent directories gracefully', async () => {
    const result = await discoverAgents({
      userDir: join(testDir, 'nonexistent-user'),
      projectDir: join(testDir, 'nonexistent-project'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  test('skips files that fail to parse', async () => {
    writeFileSync(
      join(userAgentsDir, 'good.md'),
      `---
name: good
description: Good agent
---

Good.`,
    );
    writeFileSync(join(userAgentsDir, 'bad.md'), 'No frontmatter at all.');

    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.name).toBe('good');
  });

  test('skips files missing required fields', async () => {
    writeFileSync(
      join(userAgentsDir, 'valid.md'),
      `---
name: valid
description: Valid agent
---

Valid.`,
    );
    writeFileSync(
      join(userAgentsDir, 'invalid.md'),
      `---
model: claude-opus-4-6
---

Missing name and description.`,
    );

    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.name).toBe('valid');
  });

  test('includes source path in discovered agents', async () => {
    const filePath = join(userAgentsDir, 'reviewer.md');
    writeFileSync(
      filePath,
      `---
name: reviewer
description: Code review specialist
---

Review code.`,
    );

    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]!.source).toBe(filePath);
  });

  test('discovers multiple agents from same directory', async () => {
    writeFileSync(
      join(userAgentsDir, 'alpha.md'),
      `---
name: alpha
description: Alpha agent
---

Alpha.`,
    );
    writeFileSync(
      join(userAgentsDir, 'beta.md'),
      `---
name: beta
description: Beta agent
---

Beta.`,
    );
    writeFileSync(
      join(userAgentsDir, 'gamma.md'),
      `---
name: gamma
description: Gamma agent
---

Gamma.`,
    );

    const result = await discoverAgents({ userDir: userAgentsDir, projectDir: projectAgentsDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
  });
});
