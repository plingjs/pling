import { afterEach, describe, expect, it, vi } from "vitest";
import { createSurfaceTransport } from "../src";
import { sockets } from "./fake-socket";

afterEach(() => {
  vi.useRealTimers();
});

describe("createSurfaceTransport", () => {
  it("sends hello, tracks connection state and agent identity", () => {
    const fake = sockets();
    const transport = createSurfaceTransport({
      url: "wss://surface.example.com/surface?token=page",
      app: "todo",
      webSocket: fake.factory,
    });
    const socket = fake.all[0]!;
    expect(transport.state).toBe("connecting");

    socket.open();
    expect(JSON.parse(socket.sent[0]!)).toEqual({ type: "hello", protocol: "pling.bridge/0.1", app: "todo" });

    socket.message({ type: "hello_ack" });
    expect(transport.state).toBe("connected");

    socket.message({
      type: "agent_session",
      action: "opened",
      session: {
        agentId: "codex",
        sessionId: "as_1",
        userId: "u_1",
        scope: ["todo.add"],
        expiresAt: Date.now() + 60_000,
      },
    });
    expect(transport.agent).toMatchObject({ agentId: "codex", sessionId: "as_1", userId: "u_1" });

    socket.message({ type: "agent_session", action: "closed" });
    expect(transport.agent).toBeNull();
    transport.close();
  });

  it("reconnects after a transient close and stops on an authentication close", () => {
    vi.useFakeTimers();
    const fake = sockets();
    const transport = createSurfaceTransport({
      url: "wss://surface.example.com/surface?token=page",
      reconnectMs: 25,
      webSocket: fake.factory,
    });
    const states: string[] = [];
    transport.subscribeState((state) => states.push(state));

    fake.all[0]!.open();
    fake.all[0]!.message({ type: "hello_ack" });
    fake.all[0]!.serverClose(1006);
    expect(transport.state).toBe("disconnected");
    expect(states).toContain("disconnected");

    vi.advanceTimersByTime(25);
    expect(fake.all).toHaveLength(2);
    expect(transport.state).toBe("connecting");

    fake.all[1]!.serverClose(4001);
    expect(transport.state).toBe("closed");
    vi.advanceTimersByTime(100);
    expect(fake.all).toHaveLength(2);
  });

  it("ignores malformed messages and posts only on an open socket", () => {
    const fake = sockets();
    const received: unknown[] = [];
    const transport = createSurfaceTransport({ url: "ws://local", webSocket: fake.factory });
    transport.subscribe((message) => received.push(message));
    transport.post({ type: "ignored" });
    expect(fake.all[0]!.sent).toHaveLength(0);

    fake.all[0]!.open();
    fake.all[0]!.message({ type: "hello_ack" });
    transport.post({ type: "response", requestId: "r1" });
    expect(JSON.parse(fake.all[0]!.sent.at(-1)!)).toEqual({ type: "response", requestId: "r1" });
    expect(received).toEqual([{ type: "hello_ack" }]);
  });
});
