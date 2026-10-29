import type { ConfirmRequest } from "@plingjs/core";
import type { AgentSurface, SurfaceSession } from "@plingjs/surface";

export type SurfaceConnectionState = "connecting" | "connected" | "disconnected" | "closed";

/** A page session returned by the gateway or by an application BFF. */
export interface SurfacePageSession {
  pageSessionId: string;
  pageToken: string;
  expiresAt: number;
  tenantId: string;
  surfaceUrl: string;
  pairingUrl: string;
  agentSessionsUrl: string;
  mcpUrl: string;
  scope: string[];
}

/** A one-time code that binds one external Agent to this page session. */
export interface SurfacePairing {
  code: string;
  tenantId: string;
  tenantName: string;
  mcpUrl: string;
  expiresAt: number;
  scope: string[];
}

/** The public result of claiming a pairing. Treat the token as a credential. */
export interface SurfaceAgentAccess {
  agentSessionId: string;
  token: string;
  tenantId: string;
  pageSessionId: string;
  agentId: string;
  scope: string[];
  expiresAt: number;
  mcpUrl: string;
}

/** A confirmation request the page-side bridge can relay to the gateway. */
export interface SurfaceApprovalRequest extends ConfirmRequest {
  expiresAt: number;
}

/**
 * The page owns the confirmation UI. The bridge only needs a subscription; it
 * never gets a `decide()` method and cannot approve an Agent request itself.
 */
export interface SurfaceApprovalSource {
  subscribe(listener: (request: SurfaceApprovalRequest | null) => void): () => void;
}

/** Minimal WebSocket surface used by the transport; makes tests possible without a browser. */
export interface SurfaceWebSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

export type SurfaceWebSocketFactory = (url: string) => SurfaceWebSocket;

export interface SurfaceTransport {
  readonly state: SurfaceConnectionState;
  readonly agent: SurfaceSession | null;
  post(message: unknown): void;
  subscribe(handler: (message: unknown) => void): () => void;
  subscribeState(handler: (state: SurfaceConnectionState) => void): () => void;
  close(): void;
}

export interface SurfaceGatewayClientOptions {
  /** Gateway origin, without a trailing slash. */
  baseUrl?: string;
  fetch?: typeof fetch;
  credentials?: RequestCredentials;
}

export interface SurfacePublicPageSessionInput {
  tenantId?: string;
  origin?: string;
  clientKey?: string;
}

export interface SurfaceClaimInput {
  agentId?: string;
  ttlMs?: number;
  pairing?: SurfacePairing;
}

export interface SurfaceGatewayClient {
  createPublicPageSession(input?: SurfacePublicPageSessionInput): Promise<SurfacePageSession>;
  createPairing(page: SurfacePageSession): Promise<SurfacePairing>;
  claimAgent(page: SurfacePageSession, input?: SurfaceClaimInput): Promise<SurfaceAgentAccess>;
  revokeAgent(page: SurfacePageSession, agentSessionId: string): Promise<void>;
}

export type SurfaceGatewaySurface = AgentSurface;
