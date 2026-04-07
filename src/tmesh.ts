// tmesh -- core library
// Three primitives: discover, send/recv, inject
// Two watch modes: push (wait-for) and poll (setInterval)

import { execSync, spawn } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import type { Node, Signal, SignalHandler, WatchOptions } from "./types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TMESH_DIR =
  process.env.TMESH_DIR ?? join(process.env.HOME ?? "/tmp", ".tmesh");

export function meshDir(): string {
  return TMESH_DIR;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export function identity(): string | undefined {
  return process.env.TMESH_IDENTITY;
}

export function identify(name: string): void {
  process.env.TMESH_IDENTITY = name;
  if (process.env.TMUX) {
    try {
      execSync(`tmux setenv TMESH_IDENTITY ${esc(name)}`, { stdio: "pipe" });
    } catch {
      // Not in tmux or tmux unavailable
    }
  }
}

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------

export function discover(): Node[] {
  let raw: string;
  try {
    raw = execSync(
      'tmux list-sessions -F "#{session_name}\t#{session_id}\t#{session_created}"',
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch {
    return [];
  }

  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [session, _id, created] = line.split("\t");
      if (!session) return null;
      const node: Node = { session, created };
      try {
        const env = execSync(
          `tmux show-environment -t ${esc(session)} TMESH_IDENTITY`,
          { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
        );
        const val = env.trim().split("=")[1];
        if (val) node.identity = val;
      } catch {
        // No identity set
      }
      return node;
    })
    .filter((n): n is Node => n !== null);
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export function send(target: string, body: string): Signal {
  const from = identity() ?? "anonymous";
  const ts = Date.now();
  const signal: Signal = { from, to: target, body, ts };

  const inboxDir = join(TMESH_DIR, target, "inbox");
  mkdirSync(inboxDir, { recursive: true });

  const filename = `${ts}-${randomSuffix()}.json`;
  writeFileSync(join(inboxDir, filename), JSON.stringify(signal) + "\n");

  // Wake push-mode watchers
  try {
    execSync(`tmux wait-for -S tmesh-inbox-${esc(target)}`, {
      stdio: "pipe",
      timeout: 2000,
    });
  } catch {
    // No waiter or no tmux
  }

  return signal;
}

// ---------------------------------------------------------------------------
// Inject (direct push via tmux send-keys)
// ---------------------------------------------------------------------------

export function inject(target: string, text: string): void {
  execSync(`tmux send-keys -t ${esc(target)} ${esc(text)} Enter`, {
    stdio: "pipe",
  });
}

// ---------------------------------------------------------------------------
// Watch (receive signals)
// ---------------------------------------------------------------------------

export function watch(handler: SignalHandler, opts?: WatchOptions): () => void {
  const id = identity();
  if (!id) throw new Error("TMESH_IDENTITY not set. Call identify() first.");

  const mode = opts?.mode ?? "auto";
  const interval = opts?.interval ?? 500;
  const inboxDir = join(TMESH_DIR, id, "inbox");
  mkdirSync(inboxDir, { recursive: true });

  let stopped = false;
  const stop = () => {
    stopped = true;
  };

  // Drain existing signals first
  drainInbox(inboxDir, handler);

  if (mode === "push" || mode === "auto") {
    startPushWatch(inboxDir, id, handler, () => stopped, interval, mode);
  } else {
    startPollWatch(inboxDir, handler, () => stopped, interval);
  }

  if (opts?.signal) {
    opts.signal.addEventListener("abort", stop, { once: true });
  }

  return stop;
}

// One-shot: read all pending signals and return them
export function inbox(): Signal[] {
  const id = identity();
  if (!id) return [];

  const dir = join(TMESH_DIR, id, "inbox");
  mkdirSync(dir, { recursive: true });

  return readSignals(dir);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function readSignals(dir: string): Signal[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const signals: Signal[] = [];
  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf8");
      const signal = JSON.parse(raw) as Signal;
      unlinkSync(join(dir, file));
      signals.push(signal);
    } catch {
      // Corrupted or already consumed
    }
  }
  return signals;
}

function drainInbox(dir: string, handler: SignalHandler): void {
  for (const signal of readSignals(dir)) {
    handler(signal);
  }
}

function startPushWatch(
  inboxDir: string,
  id: string,
  handler: SignalHandler,
  isStopped: () => boolean,
  pollInterval: number,
  mode: "push" | "auto",
): void {
  const loop = () => {
    if (isStopped()) return;

    const channel = `tmesh-inbox-${id}`;
    const child = spawn("tmux", ["wait-for", channel], { stdio: "pipe" });

    child.on("error", () => {
      if (mode === "auto") {
        startPollWatch(inboxDir, handler, isStopped, pollInterval);
      }
    });

    child.on("close", () => {
      if (isStopped()) return;
      drainInbox(inboxDir, handler);
      loop();
    });
  };

  loop();
}

function startPollWatch(
  inboxDir: string,
  handler: SignalHandler,
  isStopped: () => boolean,
  interval: number,
): void {
  const tick = () => {
    if (isStopped()) return;
    drainInbox(inboxDir, handler);
    setTimeout(tick, interval);
  };
  setTimeout(tick, interval);
}

function esc(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
