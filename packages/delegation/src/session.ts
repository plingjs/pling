import type { SurfaceSession } from "@plingjs/surface";
import type { DelegationCredentialView } from "./types";

/** 把后端验证过的安全视图映射成 SurfaceSession；token 不在这份对象里。 */
export function toSurfaceSession(credential: DelegationCredentialView): SurfaceSession {
  return {
    agentId: credential.agentId,
    sessionId: credential.sessionId,
    userId: credential.userId,
    expiresAt: credential.expiresAt,
    scope: [...credential.scope],
    delegationId: credential.delegationId,
    ...(credential.revokedAt === undefined ? {} : { revokedAt: credential.revokedAt }),
  };
}

export function maskToken(token: string | null | undefined): string {
  if (!token) return "未签发";
  return `${token.slice(0, 10)}…${token.slice(-6)}`;
}
