/**
 * tmesh -- tmux-native agent mesh
 *
 * SDK entry point. Re-exports all Phase 1 modules for programmatic use.
 * This is the primary interface -- CLI is a thin wrapper over this SDK.
 */

// Types
export type {
  TmeshNode,
  TmeshSignal,
  TmeshConfig,
  SignalType,
  NodeStatus,
  Ulid,
  Result,
} from './types';

// Value exports (SessionName and Identity are both types and constructor functions)
export { Ok, Err, resolveHome, SessionName, Identity } from './types';

// Discovery
export {
  discover,
  parseTmuxSessions,
  parseTmuxPanes,
  discoverNodes,
} from './core/discovery';

export type {
  ParsedSession,
  ParsedPane,
} from './core/discovery';

// Identity
export {
  readIdentity,
  writeIdentity,
  identify,
  resolveSessionIdentity,
  ensureHome,
} from './core/identity';

// Signal
export {
  generateUlid,
  isValidUlid,
  decodeUlidTimestamp,
  createSignal,
} from './core/signal';

export type {
  CreateSignalInput,
} from './core/signal';

// Transport (Phase 2)
export {
  deliverSignal,
  listInbox,
  readSignalFile,
  ackSignal,
  cleanExpired,
  ensureInbox,
} from './core/transport';

export type {
  DeliverOptions,
} from './core/transport';

// Watch (Phase 2)
export {
  watchInbox,
} from './core/watch';

export type {
  WatchOptions,
} from './core/watch';
