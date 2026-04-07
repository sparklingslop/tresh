#!/usr/bin/env bun
/**
 * Recording pipeline using nano-creative-gif.
 *
 * Reads an asciinema .cast file, compresses idle gaps, renders to GIF,
 * optimizes, and generates a preview thumbnail.
 *
 * Usage:
 *   bun run scripts/record.ts <input.cast> <output.gif> [options]
 *
 * Options:
 *   --max-idle=N     Maximum idle gap in seconds (default: 2)
 *   --speed=N        Playback speed multiplier (default: 1)
 *   --theme=NAME     agg theme name (default: monokai)
 *   --font-size=N    Font size in pixels (default: 14)
 *   --filler=TEXT    Filler text for compressed gaps (default: ...)
 *   --no-filler      Skip filler injection
 *   --preview-pos=P  Preview frame position: number, "last", or "75%" (default: 75%)
 *   --preview-w=N    Preview thumbnail width (default: 300)
 *   --keep-raw       Keep the raw unoptimized GIF
 *   --compress-only  Only compress the cast file, skip GIF rendering
 */

import { readFileSync, writeFileSync } from "node:fs";

import {
  compress,
  injectFiller,
  parseCast,
  writeCast,
  totalDuration,
  formatTime,
} from "@kaosmaps/nano-creative-gif/cast";
import { pipeline } from "@kaosmaps/nano-creative-gif/render";
import { checkTools } from "@kaosmaps/nano-creative-gif/cli";

// -- Argument parsing --------------------------------------------------------

interface RecordArgs {
  input: string;
  output: string;
  maxIdle: number;
  speed: number;
  theme: string;
  fontSize: number;
  fillerText: string;
  noFiller: boolean;
  previewPos: string;
  previewWidth: number;
  keepRaw: boolean;
  compressOnly: boolean;
}

function parseArgs(argv: string[]): RecordArgs {
  const positional: string[] = [];
  let maxIdle = 2;
  let speed = 1;
  let theme = "monokai";
  let fontSize = 14;
  let fillerText = "...";
  let noFiller = false;
  let previewPos = "75%";
  let previewWidth = 300;
  let keepRaw = false;
  let compressOnly = false;

  for (const arg of argv) {
    if (arg.startsWith("--max-idle=")) {
      maxIdle = parseFloat(arg.split("=")[1]);
    } else if (arg.startsWith("--speed=")) {
      speed = parseFloat(arg.split("=")[1]);
    } else if (arg.startsWith("--theme=")) {
      theme = arg.split("=")[1];
    } else if (arg.startsWith("--font-size=")) {
      fontSize = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--filler=")) {
      fillerText = arg.split("=")[1];
    } else if (arg === "--no-filler") {
      noFiller = true;
    } else if (arg.startsWith("--preview-pos=")) {
      previewPos = arg.split("=")[1];
    } else if (arg.startsWith("--preview-w=")) {
      previewWidth = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--keep-raw") {
      keepRaw = true;
    } else if (arg === "--compress-only") {
      compressOnly = true;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    process.stderr.write(
      "Usage: bun run scripts/record.ts <input.cast> <output.gif> [options]\n",
    );
    process.exit(1);
  }

  return {
    input: positional[0],
    output: positional[1],
    maxIdle,
    speed,
    theme,
    fontSize,
    fillerText,
    noFiller,
    previewPos,
    previewWidth,
    keepRaw,
    compressOnly,
  };
}

// -- Main --------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));

// Step 0: Check system tools (unless compress-only)
if (!args.compressOnly) {
  const check = checkTools();
  if (!check.ready) {
    process.stderr.write(
      `Missing required tools: ${check.missing.join(", ")}\n`,
    );
    process.stderr.write("Install with: brew install agg gifsicle ffmpeg\n");
    process.exit(1);
  }
}

// Step 1: Read and parse cast file
const raw = readFileSync(args.input, "utf-8");
const { header, events } = parseCast(raw);

const originalDur = totalDuration(header, events);
process.stderr.write(`[record] Input: ${args.input}\n`);
process.stderr.write(
  `[record] Original duration: ${formatTime(originalDur)} (${events.length} events)\n`,
);

// Step 2: Compress idle gaps
const {
  header: compHeader,
  events: compEvents,
  gaps,
} = compress(header, events, {
  maxIdle: args.maxIdle,
});

const compressedDur = totalDuration(compHeader, compEvents);
process.stderr.write(
  `[record] Compressed: ${formatTime(compressedDur)} (${gaps.length} gaps removed)\n`,
);

// Step 3: Inject filler text at gap locations
let finalEvents = compEvents;
if (!args.noFiller && gaps.length > 0) {
  const version = header.version === 3 ? 3 : 2;
  finalEvents = injectFiller(compEvents, gaps, {
    fillerText: args.fillerText,
    version,
  });
  process.stderr.write(
    `[record] Filler injected at ${gaps.length} gaps\n`,
  );
}

// Step 4: Write compressed cast file
const compressedCastPath = args.input.replace(/\.cast$/, ".compressed.cast");
const castContent = writeCast(compHeader, finalEvents);
writeFileSync(compressedCastPath, castContent);
process.stderr.write(`[record] Compressed cast: ${compressedCastPath}\n`);

if (args.compressOnly) {
  process.stderr.write("[record] Done (compress-only mode).\n");
  process.exit(0);
}

// Step 5: Run the full GIF pipeline (render -> optimize -> preview)
process.stderr.write("[record] Rendering GIF...\n");

const result = pipeline(compressedCastPath, args.output, {
  theme: args.theme,
  fontSize: args.fontSize,
  speed: args.speed,
  keepRaw: args.keepRaw,
  previewPosition: args.previewPos,
  previewWidth: args.previewWidth,
});

// Step 6: Report
const sizeMB = (result.gifSizeBytes / (1024 * 1024)).toFixed(2);
process.stderr.write(
  `[record] GIF: ${result.gifPath} (${sizeMB} MB, ${result.frameCount ?? "?"} frames)\n`,
);
if (result.previewPath) {
  process.stderr.write(`[record] Preview: ${result.previewPath}\n`);
}
process.stderr.write(`[record] Pipeline completed in ${result.elapsedMs}ms\n`);
