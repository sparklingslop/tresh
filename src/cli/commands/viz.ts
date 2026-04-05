/**
 * tmesh viz -- visual mesh dashboard powered by gum.
 *
 * Usage: tmesh viz [--json]
 *
 * Renders a colorful mesh visualization using charmbracelet/gum.
 * Falls back to JSON output if gum is not installed.
 * Use --json to get raw viz data as JSON.
 */

import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { registerCommand } from '../registry';
import { collectVizData } from '../../core/viz';
import { resolveHome } from '../../types';

function whichSync(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function findVizScript(): string | null {
  // Try multiple paths relative to process.cwd() and import.meta
  const candidates = [
    join(process.cwd(), 'src', 'cli', 'viz.sh'),
    join(new URL('.', import.meta.url).pathname, '..', 'viz.sh'),
    join(new URL('.', import.meta.url).pathname, '..', '..', 'cli', 'viz.sh'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

registerCommand('viz', async (_args, flags) => {
  const home = resolveHome();
  const data = await collectVizData(home);
  const json = JSON.stringify(data, null, 2);

  // --json flag: just output raw data
  if (flags.get('json') === true) {
    process.stdout.write(json + '\n');
    return 0;
  }

  // Check for gum + jq
  if (!whichSync('gum') || !whichSync('jq')) {
    if (!whichSync('gum')) process.stderr.write('gum not found. Install: brew install gum\n');
    if (!whichSync('jq')) process.stderr.write('jq not found. Install: brew install jq\n');
    process.stderr.write('Falling back to JSON output:\n\n');
    process.stdout.write(json + '\n');
    return 0;
  }

  const scriptPath = findVizScript();
  if (scriptPath === null) {
    process.stderr.write('viz.sh not found. Falling back to JSON output:\n\n');
    process.stdout.write(json + '\n');
    return 0;
  }

  try {
    const output = execFileSync('bash', [scriptPath], {
      input: json,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });
    process.stdout.write(output);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`viz render failed: ${msg}\n`);
    process.stderr.write('Falling back to JSON output:\n\n');
    process.stdout.write(json + '\n');
  }

  return 0;
});
