import { describe, test, expect } from "bun:test";

/**
 * Tests for scripts/record.ts -- the nano-creative-gif wrapper.
 *
 * These tests verify that the nano-creative-gif SDK is correctly linked
 * and that imports resolve. The actual GIF pipeline requires system tools
 * (agg, gifsicle, ffmpeg) so full integration tests are left to CI with
 * those tools installed.
 */

// ---------------------------------------------------------------------------
// Import resolution -- proves the file: link works
// ---------------------------------------------------------------------------

describe("nano-creative-gif SDK link", () => {
  test("cast exports resolve", async () => {
    const cast = await import("@kaosmaps/nano-creative-gif/cast");
    expect(typeof cast.compress).toBe("function");
    expect(typeof cast.detectIdle).toBe("function");
    expect(typeof cast.injectFiller).toBe("function");
    expect(typeof cast.parseCast).toBe("function");
    expect(typeof cast.writeCast).toBe("function");
    expect(typeof cast.formatTime).toBe("function");
    expect(typeof cast.totalDuration).toBe("function");
  });

  test("render exports resolve", async () => {
    const render = await import("@kaosmaps/nano-creative-gif/render");
    expect(typeof render.pipeline).toBe("function");
    expect(typeof render.render).toBe("function");
    expect(typeof render.optimize).toBe("function");
    expect(typeof render.preview).toBe("function");
    expect(typeof render.countFrames).toBe("function");
  });

  test("cli exports resolve", async () => {
    const cli = await import("@kaosmaps/nano-creative-gif/cli");
    expect(typeof cli.checkTools).toBe("function");
    expect(typeof cli.printCheckReport).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Cast compression -- unit-level, no system tools needed
// ---------------------------------------------------------------------------

describe("cast compression via SDK", () => {
  test("parseCast handles v2 cast content", async () => {
    const { parseCast } = await import("@kaosmaps/nano-creative-gif/cast");

    const content = [
      JSON.stringify({ version: 2, width: 80, height: 24 }),
      JSON.stringify([0.0, "o", "hello "]),
      JSON.stringify([0.5, "o", "world"]),
      JSON.stringify([5.0, "o", "!"]),
    ].join("\n");

    const { header, events } = parseCast(content);
    expect(header.version).toBe(2);
    expect(events).toHaveLength(3);
    expect(events[0][2]).toBe("hello ");
    expect(events[2][0]).toBe(5.0);
  });

  test("compress squashes idle gaps", async () => {
    const { parseCast, compress, totalDuration } = await import(
      "@kaosmaps/nano-creative-gif/cast"
    );

    const content = [
      JSON.stringify({ version: 2, width: 80, height: 24, duration: 15 }),
      JSON.stringify([0.0, "o", "start"]),
      JSON.stringify([1.0, "o", "typing"]),
      JSON.stringify([10.0, "o", "after-idle"]),   // 9s gap
      JSON.stringify([10.5, "o", "more"]),
      JSON.stringify([15.0, "o", "end"]),           // 4.5s gap
    ].join("\n");

    const { header, events } = parseCast(content);
    const original = totalDuration(header, events);
    expect(original).toBe(15.0);

    const result = compress(header, events, { maxIdle: 2 });
    const compressed = totalDuration(result.header, result.events);

    // Should be significantly shorter than 15s
    expect(compressed).toBeLessThan(original);
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  test("writeCast round-trips through parseCast", async () => {
    const { parseCast, writeCast } = await import("@kaosmaps/nano-creative-gif/cast");

    const content = [
      JSON.stringify({ version: 2, width: 80, height: 24 }),
      JSON.stringify([0.0, "o", "hello"]),
      JSON.stringify([1.5, "o", "world"]),
    ].join("\n");

    const { header, events } = parseCast(content);
    const serialized = writeCast(header, events);
    const reparsed = parseCast(serialized);

    expect(reparsed.header.version).toBe(2);
    expect(reparsed.events).toHaveLength(2);
    expect(reparsed.events[0][2]).toBe("hello");
    expect(reparsed.events[1][2]).toBe("world");
  });

  test("injectFiller adds events at gap positions", async () => {
    const { parseCast, compress, injectFiller } = await import(
      "@kaosmaps/nano-creative-gif/cast"
    );

    const content = [
      JSON.stringify({ version: 2, width: 80, height: 24 }),
      JSON.stringify([0.0, "o", "start"]),
      JSON.stringify([1.0, "o", "typing"]),
      JSON.stringify([10.0, "o", "after-idle"]),
    ].join("\n");

    const { header, events } = parseCast(content);
    const result = compress(header, events, { maxIdle: 2 });
    expect(result.gaps.length).toBeGreaterThan(0);

    const withFiller = injectFiller(result.events, result.gaps, { version: 2 });
    // Filler injection adds 2 events per gap (show + cleanup)
    expect(withFiller.length).toBe(result.events.length + result.gaps.length * 2);
  });
});

// ---------------------------------------------------------------------------
// System check -- runs without external tools
// ---------------------------------------------------------------------------

describe("system check", () => {
  test("checkTools returns a structured result", async () => {
    const { checkTools } = await import("@kaosmaps/nano-creative-gif/cli");

    const result = checkTools();
    expect(result).toHaveProperty("ready");
    expect(result).toHaveProperty("tools");
    expect(result).toHaveProperty("missing");
    expect(Array.isArray(result.tools)).toBe(true);
    expect(Array.isArray(result.missing)).toBe(true);
  });
});
