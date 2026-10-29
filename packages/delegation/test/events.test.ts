import { describe, expect, it, vi } from "vitest";
import { createMemoryDelegationEventBus } from "../src/events";
import type { DelegationInvalidationEvent } from "../src/types";

const event = (userId: string, overrides: Partial<DelegationInvalidationEvent> = {}): DelegationInvalidationEvent => ({
  type: "credential_revoked",
  reason: "revoked",
  at: 123,
  credentialId: "dcr_1",
  delegationId: "del_1",
  sessionId: "ses_1",
  userId,
  agentId: "codex",
  ...overrides,
});

describe("@plingjs/delegation · memory event bus", () => {
  it("isolates subscribers by user and supports unsubscribe", () => {
    const bus = createMemoryDelegationEventBus();
    const a: DelegationInvalidationEvent[] = [];
    const b: DelegationInvalidationEvent[] = [];
    const off = bus.subscribe("user-a", (item) => a.push(item));
    bus.subscribe("user-b", (item) => b.push(item));

    bus.publish(event("user-a"));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);

    off();
    bus.publish(event("user-a"));
    expect(a).toHaveLength(1);
    expect(bus.size()).toBe(1);
  });

  it("normalizes events to an allowlist before delivery", () => {
    const bus = createMemoryDelegationEventBus();
    const received: unknown[] = [];
    bus.subscribe("u", (item) => received.push(item));

    bus.publish({
      ...event("u"),
      token: "plg_dlg_should_not_escape",
      internalHash: "secret",
    } as DelegationInvalidationEvent);

    expect(received).toEqual([event("u")]);
    expect(JSON.stringify(received)).not.toContain("plg_dlg_");
    expect(JSON.stringify(received)).not.toContain("internalHash");
  });

  it("does not let one broken subscriber block the others", () => {
    const bus = createMemoryDelegationEventBus();
    const received: DelegationInvalidationEvent[] = [];
    const broken = vi.fn(() => {
      throw new Error("socket gone");
    });
    bus.subscribe("u", broken);
    bus.subscribe("u", (item) => received.push(item));

    expect(() => bus.publish(event("u"))).not.toThrow();
    expect(broken).toHaveBeenCalledTimes(1);
    expect(received).toEqual([event("u")]);
  });
});
