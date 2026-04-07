import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Signal, Node } from "../types";

// Use a temp directory for all tests
const TEST_DIR = join(import.meta.dir, ".tmp-test-mesh");

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  process.env.TMESH_DIR = TEST_DIR;
  delete process.env.TMESH_IDENTITY;
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  delete process.env.TMESH_DIR;
  delete process.env.TMESH_IDENTITY;
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

describe("types", () => {
  test("Signal interface has required fields", () => {
    const signal: Signal = { from: "alice", to: "bob", body: "hello", ts: 1 };
    expect(signal.from).toBe("alice");
    expect(signal.to).toBe("bob");
    expect(signal.body).toBe("hello");
    expect(signal.ts).toBe(1);
  });

  test("Node interface allows optional fields", () => {
    const minimal: Node = { session: "my-session" };
    expect(minimal.session).toBe("my-session");
    expect(minimal.identity).toBeUndefined();
    expect(minimal.pid).toBeUndefined();

    const full: Node = {
      session: "s",
      identity: "alice",
      pid: 123,
      command: "claude",
      created: "2026-01-01",
    };
    expect(full.identity).toBe("alice");
  });
});

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

describe("identity", () => {
  test("identity() returns undefined when not set", async () => {
    const { identity } = await import("../tmesh");
    expect(identity()).toBeUndefined();
  });

  test("identify() sets TMESH_IDENTITY env var", async () => {
    const { identify, identity } = await import("../tmesh");
    identify("alice");
    expect(identity()).toBe("alice");
    expect(process.env.TMESH_IDENTITY).toBe("alice");
  });
});

// ---------------------------------------------------------------------------
// meshDir
// ---------------------------------------------------------------------------

describe("meshDir", () => {
  test("returns TMESH_DIR when set", async () => {
    const { meshDir } = await import("../tmesh");
    expect(meshDir()).toBe(TEST_DIR);
  });
});

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

describe("send", () => {
  test("creates signal file in target inbox", async () => {
    const { send, identify } = await import("../tmesh");
    identify("alice");

    const signal = send("bob", "hello world");

    expect(signal.from).toBe("alice");
    expect(signal.to).toBe("bob");
    expect(signal.body).toBe("hello world");
    expect(signal.ts).toBeGreaterThan(0);

    // Verify file was written
    const inbox = join(TEST_DIR, "bob", "inbox");
    const files = readdirSync(inbox);
    expect(files.length).toBe(1);
    expect(files[0]).toEndWith(".json");

    // Verify file content
    const content = JSON.parse(readFileSync(join(inbox, files[0]!), "utf8"));
    expect(content.from).toBe("alice");
    expect(content.body).toBe("hello world");
  });

  test("uses 'anonymous' when identity not set", async () => {
    const { send } = await import("../tmesh");
    const signal = send("bob", "hi");
    expect(signal.from).toBe("anonymous");
  });

  test("creates inbox directory if missing", async () => {
    const { send, identify } = await import("../tmesh");
    identify("alice");
    send("newnode", "test");
    const inbox = join(TEST_DIR, "newnode", "inbox");
    expect(readdirSync(inbox).length).toBe(1);
  });

  test("signal files sort chronologically", async () => {
    const { send, identify } = await import("../tmesh");
    identify("alice");

    send("bob", "first");
    send("bob", "second");
    send("bob", "third");

    const inbox = join(TEST_DIR, "bob", "inbox");
    const files = readdirSync(inbox).sort();
    expect(files.length).toBe(3);

    const bodies = files.map((f) => {
      const content = JSON.parse(readFileSync(join(inbox, f), "utf8"));
      return content.body;
    });
    expect(bodies).toEqual(["first", "second", "third"]);
  });
});

// ---------------------------------------------------------------------------
// Inbox (one-shot read)
// ---------------------------------------------------------------------------

describe("inbox", () => {
  test("returns empty array when no signals", async () => {
    const { inbox, identify } = await import("../tmesh");
    identify("alice");
    expect(inbox()).toEqual([]);
  });

  test("reads and consumes pending signals", async () => {
    const { inbox, identify } = await import("../tmesh");
    identify("bob");

    // Manually place signals in bob's inbox
    const dir = join(TEST_DIR, "bob", "inbox");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "100-aaa.json"),
      JSON.stringify({ from: "alice", to: "bob", body: "msg1", ts: 100 }),
    );
    writeFileSync(
      join(dir, "200-bbb.json"),
      JSON.stringify({ from: "alice", to: "bob", body: "msg2", ts: 200 }),
    );

    const signals = inbox();
    expect(signals.length).toBe(2);
    expect(signals[0]!.body).toBe("msg1");
    expect(signals[1]!.body).toBe("msg2");

    // Signals consumed — inbox now empty
    expect(readdirSync(dir).length).toBe(0);
  });

  test("returns empty array when identity not set", async () => {
    const { inbox } = await import("../tmesh");
    expect(inbox()).toEqual([]);
  });

  test("skips corrupted files", async () => {
    const { inbox, identify } = await import("../tmesh");
    identify("bob");

    const dir = join(TEST_DIR, "bob", "inbox");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "100-aaa.json"), "not json{{{");
    writeFileSync(
      join(dir, "200-bbb.json"),
      JSON.stringify({ from: "a", to: "b", body: "ok", ts: 200 }),
    );

    const signals = inbox();
    expect(signals.length).toBe(1);
    expect(signals[0]!.body).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Watch
// ---------------------------------------------------------------------------

describe("watch", () => {
  test("throws when identity not set", async () => {
    const { watch } = await import("../tmesh");
    expect(() => watch(() => {})).toThrow("TMESH_IDENTITY not set");
  });

  test("drains existing signals on start", async () => {
    const { watch, identify } = await import("../tmesh");
    identify("watcher");

    // Pre-place a signal
    const dir = join(TEST_DIR, "watcher", "inbox");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "100-aaa.json"),
      JSON.stringify({ from: "x", to: "watcher", body: "pre", ts: 100 }),
    );

    const received: string[] = [];
    const stop = watch((s) => received.push(s.body), { mode: "poll", interval: 50 });

    // Wait for drain
    await new Promise((r) => setTimeout(r, 100));
    stop();

    expect(received).toContain("pre");
  });

  test("poll mode picks up new signals", async () => {
    const { watch, identify, send } = await import("../tmesh");
    identify("poller");

    const received: string[] = [];
    const stop = watch((s) => received.push(s.body), { mode: "poll", interval: 50 });

    // Send after watch starts
    await new Promise((r) => setTimeout(r, 30));

    // Manually place a signal (send() would try wait-for which may fail)
    const dir = join(TEST_DIR, "poller", "inbox");
    writeFileSync(
      join(dir, `${Date.now()}-test.json`),
      JSON.stringify({ from: "x", to: "poller", body: "live", ts: Date.now() }),
    );

    await new Promise((r) => setTimeout(r, 200));
    stop();

    expect(received).toContain("live");
  });

  test("stop() halts watching", async () => {
    const { watch, identify } = await import("../tmesh");
    identify("stopper");

    let count = 0;
    const stop = watch(() => { count++; }, { mode: "poll", interval: 50 });
    stop();

    // Place a signal after stop
    const dir = join(TEST_DIR, "stopper", "inbox");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "100-aaa.json"),
      JSON.stringify({ from: "x", to: "stopper", body: "late", ts: 100 }),
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(count).toBe(0);
  });

  test("AbortSignal stops watching", async () => {
    const { watch, identify } = await import("../tmesh");
    identify("aborter");

    const ac = new AbortController();
    let count = 0;
    watch(() => { count++; }, { mode: "poll", interval: 50, signal: ac.signal });

    ac.abort();
    await new Promise((r) => setTimeout(r, 200));

    // Place signal after abort
    const dir = join(TEST_DIR, "aborter", "inbox");
    writeFileSync(
      join(dir, "100-aaa.json"),
      JSON.stringify({ from: "x", to: "aborter", body: "late", ts: 100 }),
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Discover (requires tmux — skip if not available)
// ---------------------------------------------------------------------------

describe("discover", () => {
  test("returns array (empty if tmux not running)", async () => {
    const { discover } = await import("../tmesh");
    const nodes = discover();
    expect(Array.isArray(nodes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Inject (requires tmux — skip if not available)
// ---------------------------------------------------------------------------

describe("inject", () => {
  test("throws when target session missing", async () => {
    const { inject } = await import("../tmesh");
    expect(() => inject("nonexistent-session-xyz-999", "hello")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Integration: send + inbox round-trip
// ---------------------------------------------------------------------------

describe("send + inbox round-trip", () => {
  test("signal sent by alice is received by bob", async () => {
    const { send, inbox, identify } = await import("../tmesh");

    // Alice sends
    identify("alice");
    send("bob", "ping");

    // Bob reads
    identify("bob");
    const signals = inbox();
    expect(signals.length).toBe(1);
    expect(signals[0]!.from).toBe("alice");
    expect(signals[0]!.body).toBe("ping");
    expect(signals[0]!.to).toBe("bob");
  });

  test("multiple senders, single receiver", async () => {
    const { send, inbox, identify } = await import("../tmesh");

    identify("alice");
    send("hub", "from-alice");

    identify("bob");
    send("hub", "from-bob");

    identify("hub");
    const signals = inbox();
    expect(signals.length).toBe(2);

    const bodies = signals.map((s) => s.body).sort();
    expect(bodies).toEqual(["from-alice", "from-bob"]);
  });
});
