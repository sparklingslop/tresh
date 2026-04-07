// tresh -- types

export interface Node {
  session: string;
  identity?: string;
  pid?: number;
  command?: string;
  created?: string;
}

export interface Signal {
  from: string;
  to: string;
  body: string;
  ts: number;
  type?: "message" | "ack";
}

export type WatchMode = "push" | "poll" | "auto";

export interface WatchOptions {
  mode?: WatchMode;
  interval?: number; // poll interval in ms (default: 500)
  signal?: AbortSignal;
  ack?: boolean; // auto-acknowledge incoming messages
}

export type SignalHandler = (signal: Signal) => void | Promise<void>;
