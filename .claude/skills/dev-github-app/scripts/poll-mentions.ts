#!/usr/bin/env bun
/**
 * Poll for @sloppy-bot mentions across sparklingslop repos.
 *
 * Usage: bun run scripts/poll-mentions.ts
 */

import { execSync } from 'node:child_process';

// Get token
const token = execSync('bun run ' + import.meta.dir + '/get-token.ts', {
  encoding: 'utf-8',
}).trim();

async function pollMentions() {
  const res = await fetch(
    'https://api.github.com/search/issues?q=mentions:sloppy-bot[bot]+org:sparklingslop+is:open&sort=updated&order=desc',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (!res.ok) {
    process.stderr.write(`Search failed: ${res.status}\n`);
    process.exit(1);
  }

  const data = await res.json() as {
    total_count: number;
    items: Array<{
      number: number;
      title: string;
      html_url: string;
      repository_url: string;
      updated_at: string;
      user: { login: string };
    }>;
  };

  if (data.total_count === 0) {
    process.stdout.write('No pending @mentions found.\n');
    return;
  }

  process.stdout.write(`Found ${data.total_count} mention(s):\n\n`);

  for (const item of data.items) {
    const repo = item.repository_url.split('/').slice(-2).join('/');
    process.stdout.write(`  #${item.number} [${repo}] ${item.title}\n`);
    process.stdout.write(`  by @${item.user.login} -- updated ${item.updated_at}\n`);
    process.stdout.write(`  ${item.html_url}\n\n`);
  }
}

await pollMentions();
