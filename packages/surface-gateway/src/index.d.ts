export const BRIDGE_PROTOCOL: "pling.bridge/0.1";
export const SURFACE_PROTOCOL: "pling.surface/0.1";
export const PACKAGE_VERSION: string;

export interface SurfacePublicDemoConfig {
  origins: string[];
  scope: string[];
  pageSessionTtlMs: number;
  maxSessionsPerWindow: number;
  windowMs: number;
  maxActiveSessions: number;
  userIdPrefix: string;
}

export interface SurfaceTenantConfig {
  id: string;
  displayName: string;
  origins: string[];
  maxPageSessionTtlMs: number;
  maxAgentSessionTtlMs: number;
  publicDemo: SurfacePublicDemoConfig | null;
}

export interface SurfaceConfig {
  tenants: SurfaceTenantConfig[];
}

export interface SurfaceAuditEvent {
  type: string;
  at: string;
  [key: string]: unknown;
}

export interface SurfacePageSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface SurfacePageSession {
  id: string;
  tenantId: string;
  userId: string;
  allowedScope: string[];
  token: string;
  createdAt: number;
  expiresAt: number;
  connectedAt: number | null;
  socket: SurfacePageSocket | null;
  activeAgentSessionId: string | null;
}

export interface SurfaceAgentSession {
  id: string;
  token: string;
  tenantId: string;
  pageSessionId: string;
  agentId: string;
  userId: string;
  scope: string[];
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

export interface PublicPageSession {
  pageSessionId: string;
  token: string;
  expiresAt: number;
  tenantId: string;
  surfaceUrl: string;
  pairingUrl: string;
  agentSessionsUrl: string;
  mcpUrl: string;
  scope: string[];
}

export interface SurfacePairing {
  code: string;
  tenantId: string;
  tenantName: string;
  mcpUrl: string;
  expiresAt: number;
  scope: string[];
}

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

export type SurfaceRequestState = "waiting" | "pending_approval" | "done" | "not_found";

export interface SurfaceProtocolFailure {
  protocol: typeof SURFACE_PROTOCOL;
  id: string;
  ok: false;
  error: { code: string; message: string };
}

export interface SurfaceProtocolSuccess<T = unknown> {
  protocol: typeof SURFACE_PROTOCOL;
  id: string;
  ok: true;
  result: T;
}

export type SurfaceProtocolResponse<T = unknown> = SurfaceProtocolSuccess<T> | SurfaceProtocolFailure;

export interface SurfaceApprovalView {
  description: string;
  args: Record<string, unknown>;
  kind: string;
  expiresAt: number;
  flow?: Record<string, unknown>;
}

export interface SurfaceInvocationResult {
  state: SurfaceRequestState;
  requestId: string;
  capability?: string;
  approval?: SurfaceApprovalView;
  response?: SurfaceProtocolResponse;
}

export interface SurfaceGatewayOptions {
  config: SurfaceConfig;
  publicBaseUrl: string;
  now?: () => number;
  requestTimeoutMs?: number;
  approvalTimeoutMs?: number;
  pageSessionTtlMs?: number;
  pairingTtlMs?: number;
  agentSessionTtlMs?: number;
  resultTtlMs?: number;
  revokedSessionRetentionMs?: number;
  maxPairingClaimsPerWindow?: number;
  pairingClaimWindowMs?: number;
  onAudit?: (event: SurfaceAuditEvent) => void | Promise<void>;
}

export interface SurfaceGateway {
  readonly version: string;
  readonly config: SurfaceConfig;
  createPageSession(input: { tenantId: string; userId: string; scope: string[]; ttlMs?: number }): PublicPageSession;
  createPublicDemoPageSession(input: { tenantId: string; origin: string; clientKey?: string }): PublicPageSession;
  authenticatePage(token: string | null | undefined, origin: string | null | undefined): SurfacePageSession;
  attachPage(session: SurfacePageSession, socket: SurfacePageSocket, origin: string | null | undefined): void;
  disconnectPage(session: SurfacePageSession, reason?: string, socket?: SurfacePageSocket | null): void;
  createPairing(input: { pageToken: string; ttlMs?: number }): SurfacePairing;
  claimPairing(input: { code: string; agentId: string; scope?: string[]; ttlMs?: number; clientKey?: string }): SurfaceAgentAccess;
  authenticateAgent(token: string | null | undefined): SurfaceAgentSession;
  revokeAgentSession(id: string, reason?: string): Record<string, unknown>;
  revokePageSession(id: string, reason?: string): { pageSessionId: string; revoked: true };
  describe(agentToken: string): Promise<SurfaceProtocolResponse>;
  invoke(agentToken: string, capability: string, input?: Record<string, unknown>): Promise<SurfaceInvocationResult>;
  status(agentToken: string, requestId: string): SurfaceInvocationResult;
  notePageMessage(page: SurfacePageSession, message: unknown): void;
  discover(tenantId: string): Record<string, unknown>;
  listSessions(): {
    tenants: Array<Pick<SurfaceTenantConfig, "id" | "displayName" | "origins">>;
    pageSessions: Array<{
      id: string;
      tenantId: string;
      userId: string;
      connected: boolean;
      scope: string[];
      expiresAt: number;
      activeAgentSessionId: string | null;
    }>;
    agentSessions: Array<{
      id: string;
      tenantId: string;
      pageSessionId: string;
      agentId: string;
      userId: string;
      scope: string[];
      expiresAt: number;
      revokedAt: number | null;
    }>;
  };
  expire(): void;
  shutdown(): void;
}

export interface SurfaceGatewaySubOptions {
  now?: () => number;
  requestTimeoutMs?: number;
  approvalTimeoutMs?: number;
  pageSessionTtlMs?: number;
  pairingTtlMs?: number;
  agentSessionTtlMs?: number;
  resultTtlMs?: number;
  revokedSessionRetentionMs?: number;
  maxPairingClaimsPerWindow?: number;
  pairingClaimWindowMs?: number;
  onAudit?: (event: SurfaceAuditEvent) => void | Promise<void>;
}

export interface SurfaceServerOptions {
  config: SurfaceConfig;
  adminToken: string;
  publicBaseUrl?: string;
  host?: string;
  port?: number;
  demoTenantId?: string;
  trustProxy?: boolean;
  logger?: (message: string) => void;
  gateway?: SurfaceGatewaySubOptions;
}

export interface SurfaceServer {
  readonly gateway: SurfaceGateway | null;
  readonly baseUrl: string | null;
  start(): Promise<{ baseUrl: string; port: number }>;
  stop(): Promise<void>;
}

export interface McpRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpHandler {
  handle(body: McpRequest, context?: { agentToken?: string }): Promise<Record<string, unknown> | null>;
}

export interface SurfaceMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface SurfaceCliRun {
  server: SurfaceServer;
  config: SurfaceConfig;
  configPath: string;
  baseUrl: string;
  port: number;
  stop(signal?: string): Promise<void>;
}

export class ConfigError extends Error {
  readonly code: string;
}

export class GatewayError extends Error {
  readonly code: string;
  readonly status: number;
}

export function normalizeConfig(raw: unknown): SurfaceConfig;
export function loadConfig(file: string): Promise<SurfaceConfig>;
export function normalizeOrigin(value: string): string;
export function createSurfaceGateway(options: SurfaceGatewayOptions): SurfaceGateway;
export function createSurfaceServer(options: SurfaceServerOptions): SurfaceServer;
export function createMcpHandler(gateway: SurfaceGateway, options?: { version?: string }): McpHandler;
export function asGatewayError(error: unknown): GatewayError;
export function runSurfaceGatewayCli(options?: {
  env?: Record<string, string | undefined>;
  stderr?: { write(chunk: string): unknown };
}): Promise<SurfaceCliRun>;
export function cliHelp(): string;

export const TOOLS: SurfaceMcpTool[];
