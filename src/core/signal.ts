/**
 * Signal creation and ULID generation for tmesh.
 *
 * Monotonic ULID generator, validation, timestamp decoding, and signal factory.
 * Zero dependencies -- uses only Node.js built-ins and shared types.
 */

import {
  Identity,
  Ok,
  Err,
  type Ulid,
  type TmeshSignal,
  type SignalType,
  type Result,
} from '../types';

// ---------------------------------------------------------------------------
// Crockford Base32
// ---------------------------------------------------------------------------

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const CROCKFORD_DECODE: Record<string, number> = {};
for (let i = 0; i < CROCKFORD.length; i++) {
  CROCKFORD_DECODE[CROCKFORD[i]!] = i;
}

// ---------------------------------------------------------------------------
// Module-level monotonic state
// ---------------------------------------------------------------------------

let lastTime = 0;
let lastRandom: number[] = new Array<number>(16).fill(0);

function fillRandom(arr: number[]): void {
  const bytes = new Uint8Array(10); // 80 bits = 16 base32 digits * 5 bits
  crypto.getRandomValues(bytes);
  let bitBuffer = 0;
  let bitsInBuffer = 0;
  let byteIdx = 0;
  for (let i = 0; i < 16; i++) {
    while (bitsInBuffer < 5) {
      bitBuffer = (bitBuffer << 8) | (bytes[byteIdx++] ?? 0);
      bitsInBuffer += 8;
    }
    bitsInBuffer -= 5;
    arr[i] = (bitBuffer >> bitsInBuffer) & 0x1f;
  }
}

function incrementRandom(arr: number[]): void {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]! < 31) {
      arr[i] = arr[i]! + 1;
      return;
    }
    arr[i] = 0;
  }
  // Overflow -- astronomically unlikely. Reset with fresh randomness.
  fillRandom(arr);
}

// ---------------------------------------------------------------------------
// ULID generation
// ---------------------------------------------------------------------------

/**
 * Generate a monotonic ULID.
 *
 * - 48-bit millisecond timestamp in the first 10 Crockford base32 chars
 * - 80-bit random portion in the last 16 chars
 * - Same-millisecond calls increment the random portion
 */
export function generateUlid(): Ulid {
  const now = Date.now();

  if (now === lastTime) {
    incrementRandom(lastRandom);
  } else {
    lastTime = now;
    fillRandom(lastRandom);
  }

  // Encode 48-bit timestamp into 10 chars (big-endian)
  let result = '';
  let t = now;
  for (let i = 9; i >= 0; i--) {
    result = CROCKFORD[t & 0x1f]! + result;
    t = Math.floor(t / 32);
  }

  // Encode random portion (16 base32 digits)
  for (let i = 0; i < 16; i++) {
    result += CROCKFORD[lastRandom[i]!]!;
  }

  return result as Ulid;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Check whether a string is a valid ULID (26 Crockford base32 characters).
 */
export function isValidUlid(value: string): boolean {
  return ULID_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Timestamp decoding
// ---------------------------------------------------------------------------

/**
 * Decode the millisecond epoch timestamp from the first 10 characters of a ULID.
 */
export function decodeUlidTimestamp(ulid: string): number {
  let timestamp = 0;
  for (let i = 0; i < 10; i++) {
    const char = ulid[i]!;
    const val = CROCKFORD_DECODE[char];
    if (val === undefined) {
      return 0;
    }
    timestamp = timestamp * 32 + val;
  }
  return timestamp;
}

// ---------------------------------------------------------------------------
// Signal factory
// ---------------------------------------------------------------------------

export interface CreateSignalInput {
  readonly sender: string;
  readonly target: string;
  readonly type: SignalType;
  readonly content: string;
  readonly channel?: string;
  readonly ttl?: number;
  readonly replyTo?: Ulid;
}

/**
 * Create a new TmeshSignal.
 *
 * Validates sender and target identities, auto-generates ULID and timestamp.
 */
export function createSignal(input: CreateSignalInput): Result<TmeshSignal> {
  // Validate sender
  let sender: ReturnType<typeof Identity>;
  try {
    sender = Identity(input.sender);
  } catch (e) {
    const message = e instanceof TypeError ? e.message : String(e);
    return Err(new Error(`Invalid sender: ${message}`));
  }

  // Validate target -- '*' is broadcast, skip validation
  let target: ReturnType<typeof Identity> | '*';
  if (input.target === '*') {
    target = '*';
  } else {
    try {
      target = Identity(input.target);
    } catch (e) {
      const message = e instanceof TypeError ? e.message : String(e);
      return Err(new Error(`Invalid target: ${message}`));
    }
  }

  const signal: TmeshSignal = {
    id: generateUlid(),
    sender,
    target,
    type: input.type,
    channel: input.channel ?? 'default',
    content: input.content,
    timestamp: new Date().toISOString(),
    ...(input.ttl !== undefined ? { ttl: input.ttl } : {}),
    ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
  };

  return Ok(signal);
}
