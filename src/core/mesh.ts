/**
 * createTmesh() -- the main library API factory.
 *
 * Provides a high-level, ergonomic interface for mesh operations.
 * Wraps the lower-level core modules (identity, signal, transport, watch, nodes).
 * Zero dependencies -- only internal tmesh modules.
 */

import type { TmeshSignal, SignalType, Ulid } from '../types';
import { ensureHome, writeIdentity } from './identity';
import {
  inject as rawInject,
  peek as rawPeek,
} from './inject';
import type { InjectOptions, PeekOptions, InjectResult, PeekResult } from './inject';
import { createSignal } from './signal';
import { deliverSignal, listInbox, readSignalFile, ackSignal, cleanExpired } from './transport';
import { watchInbox } from './watch';
import type { WatchOptions } from './watch';
import { listNodes } from './nodes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TmeshOptions {
  /** The identity for this mesh node. */
  readonly identity: string;
  /** Home directory for this node (default: ~/.tmesh). */
  readonly home?: string;
}

export interface SendOptions {
  readonly type: SignalType;
  readonly content: string;
  readonly channel?: string;
  readonly ttl?: number;
  readonly replyTo?: Ulid;
}

export interface BroadcastOptions {
  readonly type: SignalType;
  readonly content: string;
  readonly channel?: string;
  readonly ttl?: number;
}

export interface Tmesh {
  /** This node's identity. */
  readonly identity: string;
  /** This node's home directory. */
  readonly home: string;
  /** Send a signal to a specific node. Returns the signal ID. */
  send(target: string, options: SendOptions): Promise<string>;
  /** Broadcast a signal to all known nodes. Returns the signal ID. */
  broadcast(options: BroadcastOptions): Promise<string>;
  /** List known peer node identities. */
  discover(): Promise<string[]>;
  /** List all signals in the inbox. */
  inbox(): Promise<TmeshSignal[]>;
  /** Read a specific signal by ID. */
  read(signalId: string): Promise<TmeshSignal | null>;
  /** Acknowledge (delete) a signal from the inbox. */
  ack(signalId: string): Promise<void>;
  /** Clean expired signals from the inbox. Returns count cleaned. */
  clean(): Promise<number>;
  /** Watch inbox for new signals. Returns an async iterator. */
  watch(options?: WatchOptions): AsyncGenerator<TmeshSignal, void, undefined>;
  /** Inject text into a tmux session via send-keys (Layer 1). */
  inject(session: string, message: string, options?: InjectOptions): InjectResult;
  /** Peek at a tmux session's screen content via capture-pane (Layer 1). */
  peek(session: string, options?: PeekOptions): PeekResult;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a tmesh instance.
 *
 * Initializes the home directory and writes the identity file.
 */
export async function createTmesh(options: TmeshOptions): Promise<Tmesh> {
  const home = options.home ?? `${process.env['HOME'] ?? '~'}/.tmesh`;

  // Initialize home and identity
  const homeResult = await ensureHome(home);
  if (!homeResult.ok) {
    throw new Error(`Failed to create home directory: ${homeResult.error.message}`);
  }

  const identityResult = await writeIdentity(options.identity, home);
  if (!identityResult.ok) {
    throw new Error(`Failed to write identity: ${identityResult.error.message}`);
  }

  const identity = options.identity;

  return {
    identity,
    home,

    async send(target: string, opts: SendOptions): Promise<string> {
      const signalResult = createSignal({
        sender: identity,
        target,
        type: opts.type,
        content: opts.content,
        ...(opts.channel !== undefined ? { channel: opts.channel } : {}),
        ...(opts.ttl !== undefined ? { ttl: opts.ttl } : {}),
        ...(opts.replyTo !== undefined ? { replyTo: opts.replyTo } : {}),
      });

      if (!signalResult.ok) {
        throw new Error(`Failed to create signal: ${signalResult.error.message}`);
      }

      const targetHome = `${home}/nodes/${target}`;
      const deliverResult = await deliverSignal(signalResult.value, targetHome, {
        senderHome: home,
      });

      if (!deliverResult.ok) {
        throw new Error(`Failed to deliver signal: ${deliverResult.error.message}`);
      }

      return signalResult.value.id;
    },

    async broadcast(opts: BroadcastOptions): Promise<string> {
      const signalResult = createSignal({
        sender: identity,
        target: '*',
        type: opts.type,
        content: opts.content,
        ...(opts.channel !== undefined ? { channel: opts.channel } : {}),
        ...(opts.ttl !== undefined ? { ttl: opts.ttl } : {}),
      });

      if (!signalResult.ok) {
        throw new Error(`Failed to create signal: ${signalResult.error.message}`);
      }

      const nodes = await listNodes(home);
      for (const node of nodes) {
        const targetHome = `${home}/nodes/${node}`;
        await deliverSignal(signalResult.value, targetHome);
      }

      return signalResult.value.id;
    },

    async discover(): Promise<string[]> {
      return listNodes(home);
    },

    async inbox(): Promise<TmeshSignal[]> {
      const result = await listInbox(home);
      if (!result.ok) {
        throw new Error(`Failed to list inbox: ${result.error.message}`);
      }
      return result.value;
    },

    async read(signalId: string): Promise<TmeshSignal | null> {
      const result = await readSignalFile(signalId, home);
      if (!result.ok) return null;
      return result.value;
    },

    async ack(signalId: string): Promise<void> {
      const result = await ackSignal(signalId, home);
      if (!result.ok) {
        throw new Error(`Failed to ack signal: ${result.error.message}`);
      }
    },

    async clean(): Promise<number> {
      const result = await cleanExpired(home);
      if (!result.ok) {
        throw new Error(`Failed to clean expired signals: ${result.error.message}`);
      }
      return result.value;
    },

    async *watch(opts?: WatchOptions): AsyncGenerator<TmeshSignal, void, undefined> {
      yield* watchInbox(home, opts);
    },

    inject(session: string, message: string, opts?: InjectOptions): InjectResult {
      const result = rawInject(session, message, opts);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    },

    peek(session: string, opts?: PeekOptions): PeekResult {
      const result = rawPeek(session, opts);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    },
  };
}
