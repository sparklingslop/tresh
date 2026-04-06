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
  resolveEffectiveIdentity,
  resolveNodeHome,
  resolveMyNodeHome,
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

// Mesh factory (Phase 4 -- primary API)
export { createTmesh } from './core/mesh';
export type { Tmesh, TmeshOptions, SendOptions, BroadcastOptions } from './core/mesh';

// Nodes
export {
  listNodes,
} from './core/nodes';

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

// Inject (Phase 5 -- Layer 1 raw tmux)
export {
  inject,
  peek,
  escapeForTmux,
  validateSessionTarget,
  buildInjectCommand,
  buildPeekCommand,
} from './core/inject';

// Display formatting + parsing
export {
  formatOutbound,
  formatInbound,
  parseLogLine,
} from './core/display';

export type {
  OutboundDisplay,
  InboundDisplay,
  ParsedLogLine,
} from './core/display';

// Conversation log
export {
  appendOutbound,
  appendInbound,
  readLog,
} from './core/conversation';

export type {
  OutboundEntry,
  InboundEntry,
} from './core/conversation';

// Watch pane
export {
  openWatchPane,
  closeWatchPane,
  hasWatchPane,
  buildWatchPaneCommand,
} from './core/watchpane';

// Wire format (agent-to-agent protocol)
export {
  formatWireMessage,
  parseWireMessage,
  WIRE_PREFIX,
} from './core/wire';

export type {
  WireMessage,
  ParsedWireMessage,
} from './core/wire';

// Mention (@ routing)
export {
  parseMentions,
} from './core/mention';

// Hooks (auto-registration)
export {
  installHooks,
  uninstallHooks,
  buildInstallCommands,
  buildUninstallCommands,
  HOOK_NAMES,
} from './core/hooks';

export type {
  InjectOptions,
  PeekOptions,
  InjectResult,
  PeekResult,
} from './core/inject';

// Pane Registry (Phase 7.1 -- name-based addressing)
export {
  registerPane,
  resolvePane,
  listRegisteredPanes,
  unregisterPane,
  isValidPaneName,
} from './core/pane-registry';

export type {
  PaneRegistryOptions,
} from './core/pane-registry';

// Pane Lifecycle (Phase 7.2 -- spawn, kill, health)
export {
  spawnPane,
  killPane,
  isPaneDead,
  getPaneMode,
  paneExists,
  getPaneCommand,
  isValidPaneId,
} from './core/pane-lifecycle';

export type {
  SpawnPaneOptions,
  PaneMode,
  PaneHealth,
} from './core/pane-lifecycle';

// Synchronization (Phase 7.3 -- tmux wait-for)
export {
  waitFor,
  signalWait,
  isValidChannel,
  buildWaitForCommand,
  buildSignalWaitCommand,
} from './core/sync';

export type {
  WaitForOptions,
  WaitForResult,
} from './core/sync';

// Output Streaming (Phase 7.4 -- pipe-pane)
export {
  streamPane,
  buildPipePaneCommand,
  buildStopPipePaneCommand,
  streamOutputPath,
} from './core/stream';

export type {
  StreamOptions,
  StreamHandle,
  StreamResult,
} from './core/stream';

// Safety Layer (Phase 7.5 -- guards for send-keys)
export {
  safeSend,
  detectHumanTyping,
  waitForCopyModeExit,
} from './core/safety';

export type {
  SafeSendOptions,
  SafeSendResult,
  SafeSendError,
} from './core/safety';

// Supervision (Phase 7.6 -- transparent pane observation)
export {
  supervise,
} from './core/supervisor';

export type {
  SuperviseOptions,
  SuperviseHandle,
  SuperviseResult,
} from './core/supervisor';

// Task Orchestration (Phase 8 -- single/parallel/chain)
export {
  runTask,
  runParallel,
  runChain,
  mapWithConcurrency,
} from './core/orchestrator';

export type {
  TaskDef,
  TaskResult,
  ParallelOptions,
} from './core/orchestrator';

// Agent Definitions (Phase 9 -- markdown frontmatter discovery)
export {
  discoverAgents,
  parseAgentFile,
  parseFrontmatter,
  validateAgentDef,
} from './core/agent-defs';

export type {
  AgentDefinition,
  DiscoverAgentsOptions,
} from './core/agent-defs';
