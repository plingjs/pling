import { DelegationError } from "./errors";
import { hashToken, randomId, randomToken } from "./tokens";
import type {
  DelegationCredentialView,
  DelegationStore,
  IssueDelegationInput,
  IssuedDelegation,
} from "./types";

const DEFAULT_TTL_MS = 10 * 60_000;
const DEFAULT_MAX_TTL_MS = 60 * 60_000;
const MAX_SCOPE_ITEMS = 64;
const MAX_SCOPE_LENGTH = 200;

export interface MemoryDelegationStoreOptions {
  now?: () => number;
  ttlMs?: number;
  maxTtlMs?: number;
}

interface CredentialRecord extends DelegationCredentialView {
  tokenHash: string;
  revokedAt?: number;
}

function invalid(message: string): never {
  throw new DelegationError("DELEGATION_INVALID_REQUEST", message);
}

function requiredString(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || !value.trim()) invalid(`${field} 必须是非空字符串`);
  const text = value.trim();
  if (text.length > max) invalid(`${field} 不能超过 ${max} 个字符`);
  return text;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) invalid(`${field} 必须是正整数`);
  return value as number;
}

function normalizeScope(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) invalid("scope 必须是非空的字符串数组");
  if (raw.length > MAX_SCOPE_ITEMS) invalid(`scope 最多包含 ${MAX_SCOPE_ITEMS} 项`);

  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = requiredString(item, "scope 中的能力 id", MAX_SCOPE_LENGTH);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function safeView(record: CredentialRecord): DelegationCredentialView {
  return {
    credentialId: record.credentialId,
    delegationId: record.delegationId,
    sessionId: record.sessionId,
    userId: record.userId,
    agentId: record.agentId,
    scope: [...record.scope],
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    ...(record.revokedAt === undefined ? {} : { revokedAt: record.revokedAt }),
  };
}

/**
 * 单进程参考实现。
 *
 * 页面 / Agent 只拿到 opaque token；本实现只保存 token 的 SHA-256 哈希。生产环境
 * 应实现同一个 `DelegationStore` port，把同样的约束交给数据库事务与唯一索引。
 */
export function createMemoryDelegationStore(options: MemoryDelegationStoreOptions = {}): DelegationStore & {
  size(): number;
} {
  const now = options.now ?? (() => Date.now());
  const defaultTtlMs = positiveInteger(options.ttlMs ?? DEFAULT_TTL_MS, "ttlMs");
  const maxTtlMs = positiveInteger(options.maxTtlMs ?? DEFAULT_MAX_TTL_MS, "maxTtlMs");
  if (defaultTtlMs > maxTtlMs) invalid("ttlMs 不能大于 maxTtlMs");

  const byHash = new Map<string, CredentialRecord>();
  const byId = new Map<string, CredentialRecord>();

  const lookup = async (token: unknown): Promise<CredentialRecord> => {
    if (typeof token !== "string" || !token) {
      throw new DelegationError("DELEGATION_INVALID_CREDENTIAL");
    }
    const record = byHash.get(await hashToken(token));
    if (!record) throw new DelegationError("DELEGATION_INVALID_CREDENTIAL");
    return record;
  };

  const assertActive = (record: CredentialRecord): void => {
    if (record.revokedAt !== undefined) throw new DelegationError("DELEGATION_REVOKED");
    if (record.expiresAt <= now()) throw new DelegationError("DELEGATION_EXPIRED");
  };

  const assertOwner = (record: CredentialRecord, userId: unknown): void => {
    if (requiredString(userId, "userId") !== record.userId) {
      throw new DelegationError("DELEGATION_BINDING_MISMATCH");
    }
  };

  const issue = async (input: IssueDelegationInput = {} as IssueDelegationInput): Promise<IssuedDelegation> => {
    const userId = requiredString(input?.userId, "userId");
    const agentId = requiredString(input?.agentId, "agentId");
    const scope = normalizeScope(input?.scope);
    const ttlMs = input?.ttlMs === undefined ? defaultTtlMs : positiveInteger(input.ttlMs, "ttlMs");
    if (ttlMs > maxTtlMs) invalid(`ttlMs 不能超过 ${maxTtlMs}`);

    const at = now();
    const token = randomToken();
    const record: CredentialRecord = {
      credentialId: randomId("dcr"),
      delegationId: randomId("del"),
      sessionId: randomId("ses"),
      tokenHash: await hashToken(token),
      userId,
      agentId,
      scope,
      issuedAt: at,
      expiresAt: at + ttlMs,
    };
    byHash.set(record.tokenHash, record);
    byId.set(record.credentialId, record);
    return { token, ...safeView(record) };
  };

  const introspect = async ({ token }: { token: string } = {} as { token: string }): Promise<DelegationCredentialView> => {
    const record = await lookup(token);
    assertActive(record);
    return safeView(record);
  };

  const refresh = async (
    { token, userId }: { token: string; userId: string } = {} as { token: string; userId: string },
  ): Promise<IssuedDelegation> => {
    const current = await lookup(token);
    assertActive(current);
    assertOwner(current, userId);

    const at = now();
    const nextToken = randomToken();
    const nextHash = await hashToken(nextToken);
    current.revokedAt = at;
    const next: CredentialRecord = {
      ...current,
      credentialId: randomId("dcr"),
      tokenHash: nextHash,
      issuedAt: at,
    };
    delete next.revokedAt;
    byHash.set(next.tokenHash, next);
    byId.set(next.credentialId, next);
    return { token: nextToken, ...safeView(next) };
  };

  const revoke = async (
    { token, userId }: { token: string; userId: string } = {} as { token: string; userId: string },
  ): Promise<DelegationCredentialView> => {
    const record = await lookup(token);
    assertActive(record);
    assertOwner(record, userId);
    record.revokedAt = now();
    return safeView(record);
  };

  return {
    issue,
    introspect,
    refresh,
    revoke,
    /** 仅供测试与运维检查；不返回 token 或哈希。 */
    size: () => byId.size,
  };
}
