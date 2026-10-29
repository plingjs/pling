import type { SurfaceWebSocket, SurfaceWebSocketFactory } from "../src";

type Listener = (event: unknown) => void;

export class FakeSocket implements SurfaceWebSocket {
  readyState = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000, reason = ""): void {
    this.readyState = 3;
    this.emit("close", { type: "close", code, reason });
  }

  open(): void {
    this.readyState = 1;
    this.emit("open", { type: "open" });
  }

  message(value: unknown): void {
    this.emit("message", { type: "message", data: JSON.stringify(value) });
  }

  serverClose(code: number, reason = ""): void {
    this.readyState = 3;
    this.emit("close", { type: "close", code, reason });
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

export function sockets(): { factory: SurfaceWebSocketFactory; all: FakeSocket[] } {
  const all: FakeSocket[] = [];
  return {
    all,
    factory(url) {
      const socket = new FakeSocket(url);
      all.push(socket);
      return socket;
    },
  };
}
