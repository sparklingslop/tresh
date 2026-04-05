#!/usr/bin/env bun
/**
 * Generate a GitHub App installation access token.
 *
 * Reads App ID and private key from 1Password,
 * creates a JWT, and exchanges it for an installation token.
 *
 * Usage: bun run scripts/get-token.ts
 * Output: prints the token to stdout (for use with GH_TOKEN=...)
 */

import { execSync } from 'node:child_process';

function getFromOp(ref: string): string {
  return execSync(`op read "${ref}"`, { encoding: 'utf-8' }).trim();
}

function base64url(data: string | Uint8Array): string {
  const b64 = typeof data === 'string'
    ? Buffer.from(data).toString('base64')
    : Buffer.from(data).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60,
    exp: now + (10 * 60),
    iss: appId,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // GitHub generates PKCS#1 keys (BEGIN RSA PRIVATE KEY).
  // Use openssl CLI for signing since crypto.subtle needs PKCS#8.
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const keyPath = join(tmpdir(), `.sloppy-bot-key-${Date.now()}.pem`);

  try {
    writeFileSync(keyPath, privateKeyPem, { mode: 0o600 });
    const sig = execSync(
      `printf '%s' '${signingInput}' | openssl dgst -sha256 -sign '${keyPath}' -binary | base64`,
      { encoding: 'utf-8' },
    ).trim();
    const sigB64url = sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').replace(/\n/g, '');
    return `${signingInput}.${sigB64url}`;
  } finally {
    try { unlinkSync(keyPath); } catch {}
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getInstallationToken(jwt: string): Promise<string> {
  // List installations to find the sparklingslop org installation
  const installationsRes = await fetch('https://api.github.com/app/installations', {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!installationsRes.ok) {
    throw new Error(`Failed to list installations: ${installationsRes.status} ${await installationsRes.text()}`);
  }

  const installations = await installationsRes.json() as Array<{ id: number; account: { login: string } }>;
  const installation = installations.find(i => i.account.login === 'sparklingslop');

  if (!installation) {
    throw new Error('No installation found for sparklingslop org');
  }

  // Create installation access token
  const tokenRes = await fetch(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (!tokenRes.ok) {
    throw new Error(`Failed to create token: ${tokenRes.status} ${await tokenRes.text()}`);
  }

  const tokenData = await tokenRes.json() as { token: string };
  return tokenData.token;
}

// Main
const appId = getFromOp('op://Kai/c5nopcqmrysyiz4tiqufjckm5q/app-id');
const privateKey = getFromOp('op://Kai/c5nopcqmrysyiz4tiqufjckm5q/private-key');

const jwt = await createJwt(appId, privateKey);
const token = await getInstallationToken(jwt);

process.stdout.write(token);
