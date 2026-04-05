/**
 * Tests for the tmesh PostToolUse hook.
 */

import { describe, test, expect } from 'bun:test';
import { extractTmeshLines } from '../post-tool-tmesh';

describe('extractTmeshLines', () => {
  test('extracts --> outbound line from bash output', () => {
    const input = `  ⎿  [tmesh 2026-04-05 14:50:05] --> tmesh-hq: Arrow seen.  (delivered)`;
    const lines = extractTmeshLines(input);
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe('[tmesh 2026-04-05 14:50:05] --> tmesh-hq: Arrow seen.  (delivered)');
  });

  test('ignores non-tmesh output', () => {
    const input = `some random bash output\nanother line`;
    const lines = extractTmeshLines(input);
    expect(lines.length).toBe(0);
  });

  test('extracts multiple tmesh lines', () => {
    const input = [
      'other stuff',
      '  ⎿  [tmesh 2026-04-05 14:50:05] --> bob: first  (delivered)',
      'more stuff',
      '  ⎿  [tmesh 2026-04-05 14:50:06] --> charlie: second  (delivered)',
    ].join('\n');
    const lines = extractTmeshLines(input);
    expect(lines.length).toBe(2);
  });

  test('does not extract <-- inbound lines (only outbound)', () => {
    const input = `[tmesh 2026-04-05 14:50:05] <-- tmesh-hq: incoming message`;
    const lines = extractTmeshLines(input);
    expect(lines.length).toBe(0);
  });

  test('cleans leading whitespace and symbols', () => {
    const input = `     ⎿  [tmesh 2026-04-05 14:50:05] --> bob: clean me  (delivered)`;
    const lines = extractTmeshLines(input);
    expect(lines[0]).toMatch(/^\[tmesh/);
  });

  test('returns empty for empty input', () => {
    expect(extractTmeshLines('')).toEqual([]);
  });
});
