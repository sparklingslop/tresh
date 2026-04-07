// tresh -- core library
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

function resolveDir(): string {
  return process.env.TRESH_DIR ?? join(process.env.HOME ?? "/tmp", ".tresh");
}

export function meshDir(): string {
  return resolveDir();
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export function identity(): string | undefined {
  return process.env.TRESH_ID;
}

export function identify(name: string): void {
  process.env.TRESH_ID = name;
  // Register pane TTY for true push delivery
  const dir = join(resolveDir(), name);
  mkdirSync(dir, { recursive: true });
  if (process.env.TMUX) {
    try {
      execSync(`tmux setenv TRESH_ID ${esc(name)}`, { stdio: "pipe" });
      const tty = execSync("tmux display-message -p '#{pane_tty}'", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (tty) writeFileSync(join(dir, "tty"), tty + "\n");
    } catch {
      // Not in tmux or tmux unavailable
    }
  }
}

export function paneTty(name: string): string | undefined {
  try {
    return readFileSync(join(resolveDir(), name, "tty"), "utf8").trim() || undefined;
  } catch {
    return undefined;
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
          `tmux show-environment -t ${esc(session)} TRESH_ID`,
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

  const inboxDir = join(resolveDir(), target, "inbox");
  mkdirSync(inboxDir, { recursive: true });

  const filename = `${ts}-${randomSuffix()}.json`;
  writeFileSync(join(inboxDir, filename), JSON.stringify(signal) + "\n");

  // Wake push-mode watchers (for structured consumption via watch)
  try {
    execSync(`tmux wait-for -S tresh-inbox-${esc(target)}`, {
      stdio: "pipe",
      timeout: 2000,
    });
  } catch {
    // No waiter or no tmux
  }

  // True push: write directly to target's pane TTY (no watcher needed)
  try {
    const tty = paneTty(target);
    if (tty) {
      const time = new Date(ts).toISOString().slice(11, 19);
      const notification = `\r\n\x1b[33m[${time}] ${from}: ${body}\x1b[0m\r\n`;
      writeFileSync(tty, notification);
    }
  } catch {
    // TTY not available or not writable
  }

  return signal;
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

export function broadcast(body: string, targets: string[]): Signal[] {
  const self = identity();
  return targets
    .filter((t) => t !== self)
    .map((target) => send(target, body));
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
// Hooks (after-send-keys detection)
// ---------------------------------------------------------------------------

export function hookChannel(id: string): string {
  return `tresh-keystroke-${id}`;
}

export function installHook(session: string): () => void {
  const id = identity() ?? session;
  const channel = hookChannel(id);
  const hookCmd = `run-shell "tmux wait-for -S ${channel}"`;
  execSync(
    `tmux set-hook -t ${esc(session)} after-send-keys ${esc(hookCmd)}`,
    { stdio: "pipe" },
  );
  return () => {
    try {
      execSync(
        `tmux set-hook -u -t ${esc(session)} after-send-keys`,
        { stdio: "pipe" },
      );
    } catch {
      // Session may be gone
    }
  };
}

// ---------------------------------------------------------------------------
// Stream (named pipe output capture via pipe-pane)
// ---------------------------------------------------------------------------

export function streamPath(paneId: string): string {
  const dir = join(resolveDir(), "streams");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${paneId}.fifo`);
}

export function startStream(paneId: string): { path: string; stop: () => void } {
  const fifo = streamPath(paneId);
  // Create named pipe (FIFO)
  try {
    execSync(`mkfifo ${esc(fifo)}`, { stdio: "pipe" });
  } catch {
    // FIFO may already exist
  }
  // Pipe pane output to the FIFO
  execSync(`tmux pipe-pane -O -t ${esc(paneId)} "cat > ${esc(fifo)}"`, {
    stdio: "pipe",
  });
  return {
    path: fifo,
    stop: () => {
      try {
        execSync(`tmux pipe-pane -t ${esc(paneId)}`, { stdio: "pipe" });
      } catch {
        // Pane may be gone
      }
      try {
        unlinkSync(fifo);
      } catch {
        // FIFO may be gone
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Watch (receive signals)
// ---------------------------------------------------------------------------

export function watch(handler: SignalHandler, opts?: WatchOptions): () => void {
  const id = identity();
  if (!id) throw new Error("TRESH_ID not set. Call identify() first.");

  const mode = opts?.mode ?? "auto";
  const interval = opts?.interval ?? 500;
  const inboxDir = join(resolveDir(), id, "inbox");
  mkdirSync(inboxDir, { recursive: true });

  let stopped = false;
  let activeChild: ReturnType<typeof spawn> | null = null;
  const stop = () => {
    stopped = true;
    if (activeChild) {
      activeChild.kill();
      activeChild = null;
    }
  };

  // Drain existing signals first
  drainInbox(inboxDir, handler);

  const setChild = (child: ReturnType<typeof spawn> | null) => {
    activeChild = child;
  };

  if (mode === "push" || mode === "auto") {
    startPushWatch(inboxDir, id, handler, () => stopped, interval, mode, setChild);
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

  const dir = join(resolveDir(), id, "inbox");
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
  setChild: (child: ReturnType<typeof spawn> | null) => void,
): void {
  const loop = () => {
    if (isStopped()) return;

    const channel = `tresh-inbox-${id}`;
    const child = spawn("tmux", ["wait-for", channel], { stdio: "pipe" });
    setChild(child);

    child.on("error", () => {
      setChild(null);
      if (mode === "auto") {
        startPollWatch(inboxDir, handler, isStopped, pollInterval);
      }
    });

    child.on("close", () => {
      setChild(null);
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
