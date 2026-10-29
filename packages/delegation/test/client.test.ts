import { describe, expect, it, vi } from "vitest";
import {
  createDelegationClient,
  type DelegationEventSourceConstructor,
} from "../src/client";
import { toSurfaceSession } from "../src/session";

describe("@plingjs/delegation · browser client", () => {
  it("coalesces concurrent ensureSession calls", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, userId: "u1", expiresAt: Date.now() + 60_000 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createDelegationClient({ fetch: fetchMock });

    const [first, second] = await Promise.all([client.ensureSession(), client.ensureSession()]);
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps only the safe view into SurfaceSession", () => {
    const credential = {
      credentialId: "dcr_1",
      delegationId: "del_1",
      sessionId: "ses_1",
      agentId: "codex",
      userId: "u1",
      scope: ["search_orders"],
      issuedAt: 1,
      expiresAt: 2,
      token: "plg_dlg_secret",
    };
    const session = toSurfaceSession(credential);

    expect(session).toEqual({
      agentId: "codex",
      sessionId: "ses_1",
      userId: "u1",
      expiresAt: 2,
      scope: ["search_orders"],
      delegationId: "del_1",
    });
    expect(JSON.stringify(session)).not.toContain("plg_dlg_");
  });

  it("does not accept a malformed issued credential", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          credential: {
            credentialId: "dcr_1",
            delegationId: "del_1",
            sessionId: "ses_1",
            agentId: "codex",
            userId: "u1",
            scope: ["read"],
            issuedAt: 1,
            expiresAt: 2,
            token: "not-a-delegation-token",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createDelegationClient({ fetch: fetchMock });

    await expect(client.issue({ agentId: "codex", scope: ["read"] })).rejects.toMatchObject({
      code: "DELEGATION_BACKEND_ERROR",
    });
  });

  it("passes only allowlisted invalidation fields and manages connection state", () => {
    const instances: FakeEventSource[] = [];

    class FakeEventSource extends EventTarget {
      readonly url: string;
      readonly init?: EventSourceInit;
      closed = false;
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string | URL, init?: EventSourceInit) {
        super();
        this.url = String(url);
        this.init = init;
        instances.push(this);
      }

      close(): void {
        this.closed = true;
      }

      emit(name: string, value: unknown): void {
        this.dispatchEvent(new MessageEvent(name, { data: JSON.stringify(value) }));
      }
    }

    const received: unknown[] = [];
    const states: string[] = [];
    const client = createDelegationClient({
      eventSource: FakeEventSource as unknown as DelegationEventSourceConstructor,
    });
    const connection = client.openEvents(
      (event) => received.push(event),
      (state) => states.push(state),
    );
    const source = instances[0]!;
    expect(source.url).toBe("/delegation/events");
    expect(source.init).toEqual({ withCredentials: true });

    source.onopen?.(new Event("open"));
    source.emit("credential_revoked", {
      type: "credential_revoked",
      reason: "revoked",
      at: 123,
      credentialId: "dcr_1",
      delegationId: "del_1",
      sessionId: "ses_1",
      userId: "u1",
      agentId: "codex",
      token: "plg_dlg_should_not_escape",
    });

    expect(received).toEqual([
      {
        type: "credential_revoked",
        reason: "revoked",
        at: 123,
        credentialId: "dcr_1",
        delegationId: "del_1",
        sessionId: "ses_1",
        userId: "u1",
        agentId: "codex",
      },
    ]);
    expect(JSON.stringify(received)).not.toContain("plg_dlg_");
    expect(states).toEqual(["connecting", "open"]);

    connection.close();
    expect(source.closed).toBe(true);
    expect(states).toContain("closed");
  });
});
