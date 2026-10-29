import type { Pairing, PageSession } from "../api";

/** Ask the gateway for a one-time code. The page token authenticates this call. */
export async function createPairing(page: PageSession): Promise<Pairing> {
  return post<Pairing>(page.pairingUrl, { pageToken: page.pageToken });
}

/** Revoke one Agent session bound to this page. Other page sessions are unaffected. */
export async function revokeAgentSession(page: PageSession, agentSessionId: string): Promise<{ ok?: boolean }> {
  return post(`${page.agentSessionsUrl.replace(/\/$/, "")}/revoke`, {
    pageToken: page.pageToken,
    agentSessionId,
  });
}

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Surface Gateway returned HTTP ${response.status}`);
  }
  return payload as T;
}
