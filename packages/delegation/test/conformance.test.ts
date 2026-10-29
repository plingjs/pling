import { describe, expect, it } from "vitest";
import {
  assertDelegationEventBusConformance,
  assertDelegationStoreConformance,
  DelegationConformanceError,
  runDelegationStoreConformance,
} from "../src/testing";
import { createMemoryDelegationEventBus } from "../src/events";
import { createMemoryDelegationStore } from "../src/store";
import type { DelegationStore } from "../src/types";

const fast = { expiryTtlMs: 20, expiryWaitMs: 50 };

describe("@plingjs/delegation · adapter conformance", () => {
  it("accepts the reference store and event bus", async () => {
    const store = createMemoryDelegationStore({ ttlMs: 60_000 });
    const events = createMemoryDelegationEventBus();

    const storeReport = await assertDelegationStoreConformance(store, fast);
    const eventReport = await assertDelegationEventBusConformance(events);

    expect(storeReport.ok).toBe(true);
    expect(eventReport.ok).toBe(true);
    expect(storeReport.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "issue:normalizes-scope",
        "refresh:rotates-token-and-preserves-identity",
        "revoke:invalidates-immediately",
        "expiry:fails-closed",
      ]),
    );
    expect(eventReport.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining(["event-bus:isolates-users", "event-bus:strips-unknown-fields"]),
    );
  });

  it("reports each broken invariant instead of stopping at the first failure", async () => {
    const reference = createMemoryDelegationStore({ ttlMs: 60_000 });
    const store: DelegationStore = {
      issue: async (input) => ({ ...(await reference.issue(input)), scope: ["not-the-requested-scope"] }),
      introspect: (input) => reference.introspect(input),
      refresh: (input) => reference.refresh(input),
      revoke: (input) => reference.revoke(input),
    };

    const report = await runDelegationStoreConformance(store, fast);
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "issue:normalizes-scope")).toMatchObject({
      ok: false,
      error: expect.stringContaining("scope"),
    });
    expect(report.checks.length).toBeGreaterThan(5);
    expect(report.checks.some((check) => check.name === "introspect:rejects-forged-token" && check.ok)).toBe(true);

    await expect(assertDelegationStoreConformance(store, fast)).rejects.toBeInstanceOf(DelegationConformanceError);
  });
});
