/**
 * tmesh shared type definitions.
 *
 * Branded types, Result monad, and core data model interfaces.
 * Zero dependencies -- pure TypeScript.
 */

// ---------------------------------------------------------------------------
// Branded types
// ---------------------------------------------------------------------------

/** Compile-time brand tag. Never appears at runtime. */
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** A tmux session name. Non-empty string. */
export type SessionName = Brand<string, 'SessionName'>;

/** A mesh node identity. Alphanumeric start, may contain dots/hyphens/underscores. */
export type Identity = Brand<string, 'Identity'>;

/** A ULID string (26 Crockford base32 characters). */
export type Ulid = Brand<string, 'Ulid'>;

// ---------------------------------------------------------------------------
// Branded type constructors (validate at boundaries)
// ---------------------------------------------------------------------------

const IDENTITY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/** Validate and brand a session name. */
export function SessionName(value: string): SessionName {
  if (value.length === 0) {
    throw new TypeError('SessionName cannot be empty');
  }
  return value as SessionName;
}

/** Validate and brand an identity string. */
export function Identity(value: string): Identity {
  if (value.length === 0) {
    throw new TypeError('Identity cannot be empty');
  }
  if (!IDENTITY_PATTERN.test(value)) {
    throw new TypeError(
      `Identity must start with alphanumeric and contain only alphanumeric, dots, hyphens, underscores: "${value}"`,
    );
  }
  return value as Identity;
}

// ---------------------------------------------------------------------------
// Result type (no thrown exceptions in core)
// ---------------------------------------------------------------------------

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Node status
// ---------------------------------------------------------------------------

export type NodeStatus = 'active' | 'idle' | 'detached';

// ---------------------------------------------------------------------------
// TmeshNode -- a discovered tmux session with mesh metadata
// ---------------------------------------------------------------------------

export interface TmeshNode {
  readonly sessionName: SessionName;
  readonly identity: Identity | null;
  readonly pid: number;
  readonly command: string;
  readonly startedAt: string;
  readonly status: NodeStatus;
}

// ---------------------------------------------------------------------------
// Signal types (data model for Phase 2, type definitions needed now)
// ---------------------------------------------------------------------------

export type SignalType = 'message' | 'command' | 'event';

export interface TmeshSignal {
  readonly id: Ulid;
  readonly sender: Identity;
  readonly target: Identity | '*';
  readonly type: SignalType;
  readonly channel: string;
  readonly content: string;
  readonly timestamp: string;
  readonly ttl?: number;
  readonly replyTo?: Ulid;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TmeshConfig {
  readonly home: string;
}

/**
 * Resolve the tmesh home directory.
 * Priority: TMESH_HOME env var > ~/.tmesh
 */
export function resolveHome(): string {
  return process.env['TMESH_HOME'] ?? `${process.env['HOME'] ?? '~'}/.tmesh`;
}
