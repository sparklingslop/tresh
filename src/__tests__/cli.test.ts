import { describe, test, expect } from "bun:test";
import { join } from "node:path";

const CLI = join(import.meta.dir, "../cli.ts");

async function run(...args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, TMESH_SKIP_TMUX_ENV: "1" },
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, out: out.trim(), err: err.trim() };
}

// ---------------------------------------------------------------------------
// Help / Version
// ---------------------------------------------------------------------------

describe("cli basics", () => {
  test("--help shows usage", async () => {
    const { code, out } = await run("--help");
    expect(code).toBe(0);
    expect(out).toContain("tmesh");
    expect(out).toContain("ls");
    expect(out).toContain("send");
    expect(out).toContain("inject");
    expect(out).toContain("watch");
  });

  test("--version shows version", async () => {
    const { code, out } = await run("--version");
    expect(code).toBe(0);
    expect(out).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("no args shows help", async () => {
    const { code, out } = await run();
    expect(code).toBe(0);
    expect(out).toContain("tmesh");
  });

  test("unknown command exits 1", async () => {
    const { code, err } = await run("nonexistent");
    expect(code).toBe(1);
    expect(err).toContain("unknown command");
  });
});

// ---------------------------------------------------------------------------
// ls
// ---------------------------------------------------------------------------

describe("cli ls", () => {
  test("ls runs without error", async () => {
    const { code } = await run("ls");
    // May output nothing if no tmux, but should not crash
    expect(code).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// identify
// ---------------------------------------------------------------------------

describe("cli identify", () => {
  test("identify without name exits 1", async () => {
    const { code, err } = await run("identify");
    expect(code).toBe(1);
    expect(err).toContain("usage");
  });
});

// ---------------------------------------------------------------------------
// send
// ---------------------------------------------------------------------------

describe("cli send", () => {
  test("send without args exits 1", async () => {
    const { code, err } = await run("send");
    expect(code).toBe(1);
    expect(err).toContain("usage");
  });

  test("send with only target exits 1", async () => {
    const { code, err } = await run("send", "bob");
    expect(code).toBe(1);
    expect(err).toContain("usage");
  });
});

// ---------------------------------------------------------------------------
// inject
// ---------------------------------------------------------------------------

describe("cli inject", () => {
  test("inject without args exits 1", async () => {
    const { code, err } = await run("inject");
    expect(code).toBe(1);
    expect(err).toContain("usage");
  });
});

// ---------------------------------------------------------------------------
// inbox
// ---------------------------------------------------------------------------

describe("cli inbox", () => {
  test("inbox without identity exits 1", async () => {
    const { code, err } = await run("inbox");
    expect(code).toBe(1);
    expect(err).toContain("TMESH_IDENTITY");
  });
});
