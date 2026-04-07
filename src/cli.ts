#!/usr/bin/env bun
// tmesh -- CLI
// Thin wrapper around the core library.
// Uses process.stdout/stderr directly (this is a CLI tool, not a service).

import { discover, send, inject, watch, inbox, identify, identity } from "./tmesh";
import pkg from "../package.json";

const VERSION: string = pkg.version;

const HELP = `tmesh -- tmux-native agent mesh

Usage: tmesh <command> [args]

Commands:
  ls                      List mesh nodes (tmux sessions)
  send <target> <body>    Send a signal to target's inbox
  inject <target> <text>  Push text into target's tmux pane
  watch [--poll <ms>]     Watch inbox for incoming signals
  inbox                   Read and print pending signals (one-shot)
  identify <name>         Set this session's mesh identity

Options:
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
    case "inject":
      return cmdInject(args.slice(1));
    case "watch":
      return cmdWatch(args.slice(1));
    case "inbox":
      return cmdInbox();
    case "identify":
      return cmdIdentify(args.slice(1));
    default:
      err(`tmesh: unknown command '${cmd}'. Run tmesh --help`);
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
    err("tmesh send: usage: tmesh send <target> <body>");
    return 1;
  }
  const signal = send(target, body);
  out(`sent to ${signal.to}: ${signal.body}`);
  return 0;
}

function cmdInject(args: string[]): number {
  const target = args[0];
  const text = args.slice(1).join(" ");
  if (!target || !text) {
    err("tmesh inject: usage: tmesh inject <target> <text>");
    return 1;
  }
  try {
    inject(target, text);
    out(`injected into ${target}`);
    return 0;
  } catch (e) {
    err(`tmesh inject: failed -- ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

async function cmdWatch(args: string[]): Promise<number> {
  const id = identity();
  if (!id) {
    err("tmesh watch: TMESH_IDENTITY not set. Run: tmesh identify <name>");
    return 1;
  }

  let mode: "push" | "poll" | "auto" = "auto";
  let interval = 500;

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
  }

  out(`watching inbox as ${id} (${mode} mode)...`);
  watch(
    (signal) => {
      const ts = new Date(signal.ts).toISOString().slice(11, 19);
      out(`[${ts}] ${signal.from}: ${signal.body}`);
    },
    { mode, interval },
  );

  // Block forever — watch runs until killed
  return new Promise<number>(() => {});
}

function cmdInbox(): number {
  const id = identity();
  if (!id) {
    err("tmesh inbox: TMESH_IDENTITY not set. Run: tmesh identify <name>");
    return 1;
  }

  const signals = inbox();
  if (signals.length === 0) {
    out("inbox empty.");
    return 0;
  }
  for (const signal of signals) {
    const ts = new Date(signal.ts).toISOString().slice(11, 19);
    out(`[${ts}] ${signal.from}: ${signal.body}`);
  }
  return 0;
}

function cmdIdentify(args: string[]): number {
  const name = args[0];
  if (!name) {
    err("tmesh identify: usage: tmesh identify <name>");
    return 1;
  }
  identify(name);
  out(`identity set: ${name}`);
  return 0;
}

main().then((code) => {
  if (typeof code === "number") process.exit(code);
});
