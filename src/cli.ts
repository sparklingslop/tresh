#!/usr/bin/env bun
// tresh -- CLI
// Thin wrapper around the core library.
// Uses process.stdout/stderr directly (this is a CLI tool, not a service).

import { discover, send, broadcast, inject, watch, inbox, identify, identity } from "./tresh";
import { harness } from "./harness";
import pkg from "../package.json";

const VERSION: string = pkg.version;

const HELP = `tresh -- tmux-native agent mesh

Usage: tresh <command> [args]

Commands:
  ls                      List mesh nodes (tmux sessions)
  send <target> <body>    Send a signal to target's inbox
  broadcast <body>        Send to all identified nodes
  inject <target> <text>  Push text into target's tmux pane
  watch [--push|--poll N]  Watch inbox for incoming signals
  inbox                   Read and print pending signals (one-shot)
  identify <name>         Set this session's mesh identity

Options (watch/inbox):
  --ack                   Force ack on (overrides harness default)

Environment:
  TRESH_HARNESS=NAME      Harness provider: terminal (default), claude-code
  TRESH_ACK=1|0           Override ack mode (otherwise: harness default)
  TRESH_ID=NAME           Set identity without calling identify
  TRESH_DIR=PATH          Override storage directory (default: ~/.tresh)

General:
  --help, -h              Show this help
  --version, -v           Show version`;

function out(msg: string): void {
  process.stdout.write(msg + "\n");
}

function err(msg: string): void {
  process.stderr.write(msg + "\n");
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    out(HELP);
    return 0;
  }

  if (cmd === "--version" || cmd === "-v") {
    out(VERSION);
    return 0;
  }

  switch (cmd) {
    case "ls":
      return cmdLs();
    case "send":
      return cmdSend(args.slice(1));
    case "broadcast":
      return cmdBroadcast(args.slice(1));
    case "inject":
      return cmdInject(args.slice(1));
    case "watch":
      return cmdWatch(args.slice(1));
    case "inbox":
      return cmdInbox(args.slice(1));
    case "identify":
      return cmdIdentify(args.slice(1));
    default:
      err(`tresh: unknown command '${cmd}'. Run tresh --help`);
      return 1;
  }
}

function cmdLs(): number {
  const nodes = discover();
  if (nodes.length === 0) {
    out("No tmux sessions found.");
    return 0;
  }
  for (const node of nodes) {
    const id = node.identity ? ` (${node.identity})` : "";
    out(`${node.session}${id}`);
  }
  return 0;
}

function cmdSend(args: string[]): number {
  const target = args[0];
  const body = args.slice(1).join(" ");
  if (!target || !body) {
    err("tresh send: usage: tresh send <target> <body>");
    return 1;
  }
  const signal = send(target, body);
  out(harness().sent(signal));
  return 0;
}

function cmdBroadcast(args: string[]): number {
  const body = args.join(" ");
  if (!body) {
    err("tresh broadcast: usage: tresh broadcast <body>");
    return 1;
  }
  const nodes = discover();
  const targets = nodes
    .filter((n) => n.identity)
    .map((n) => n.identity!);

  if (targets.length === 0) {
    out("no identified nodes found.");
    return 0;
  }

  const signals = broadcast(body, targets);
  for (const signal of signals) {
    out(harness().sent(signal));
  }
  return 0;
}

function cmdInject(args: string[]): number {
  const target = args[0];
  const text = args.slice(1).join(" ");
  if (!target || !text) {
    err("tresh inject: usage: tresh inject <target> <text>");
    return 1;
  }
  try {
    inject(target, text);
    out(`injected into ${target}`);
    return 0;
  } catch (e) {
    err(`tresh inject: failed -- ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

async function cmdWatch(args: string[]): Promise<number> {
  const id = identity();
  if (!id) {
    err("tresh watch: TRESH_ID not set. Run: tresh identify <name>");
    return 1;
  }

  let mode: "push" | "poll" | "auto" = "auto";
  let interval = 500;
  let ack: boolean | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--poll") {
      mode = "poll";
      const next = args[i + 1];
      if (next && /^\d+$/.test(next)) {
        interval = parseInt(next, 10);
        i++;
      }
    }
    if (args[i] === "--push") {
      mode = "push";
    }
    if (args[i] === "--ack") {
      ack = true;
    }
  }

  out(`watching inbox as ${id} (${mode} mode)...`);
  const h = harness();
  watch(
    (signal) => {
      out(h.received(signal));
    },
    { mode, interval, ack },
  );

  // Block forever — watch runs until killed
  return new Promise<number>(() => {});
}

function cmdInbox(args: string[]): number {
  const id = identity();
  if (!id) {
    err("tresh inbox: TRESH_ID not set. Run: tresh identify <name>");
    return 1;
  }

  const ack = args.includes("--ack") ? true : undefined;
  const signals = inbox({ ack });
  if (signals.length === 0) {
    out("inbox empty.");
    return 0;
  }
  const h = harness();
  for (const signal of signals) {
    out(h.received(signal));
  }
  return 0;
}

function cmdIdentify(args: string[]): number {
  const name = args[0];
  if (!name) {
    err("tresh identify: usage: tresh identify <name>");
    return 1;
  }
  identify(name);
  out(`identity set: ${name}`);
  return 0;
}

main().then((code) => {
  if (typeof code === "number") process.exit(code);
});
