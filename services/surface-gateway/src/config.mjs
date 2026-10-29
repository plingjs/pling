import { readFile } from "node:fs/promises";

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

export async function loadConfig(file) {
  let raw;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new ConfigError(`无法读取 Surface Gateway 配置 ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return normalizeConfig(raw);
}

export function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.tenants)) {
    throw new ConfigError("配置必须包含 tenants 数组");
  }
  const seen = new Set();
  const tenants = raw.tenants.map((tenant, index) => {
    if (!tenant || typeof tenant !== "object") throw new ConfigError(`tenants[${index}] 必须是对象`);
    const id = typeof tenant.id === "string" ? tenant.id.trim() : "";
    if (!id) throw new ConfigError(`tenants[${index}].id 不能为空`);
    if (seen.has(id)) throw new ConfigError(`重复的 tenant id: ${id}`);
    seen.add(id);
    const origins = Array.isArray(tenant.origins)
      ? tenant.origins
      : typeof tenant.origin === "string"
        ? [tenant.origin]
        : [];
    if (origins.length === 0 || origins.some((origin) => typeof origin !== "string" || !origin.trim())) {
      throw new ConfigError(`tenant ${id} 必须至少配置一个 origin`);
    }
    return {
      id,
      displayName: typeof tenant.displayName === "string" && tenant.displayName.trim() ? tenant.displayName.trim() : id,
      origins: origins.map((origin) => normalizeOrigin(origin)),
      maxPageSessionTtlMs: positiveInt(tenant.maxPageSessionTtlMs, 24 * 60 * 60_000),
      maxAgentSessionTtlMs: positiveInt(tenant.maxAgentSessionTtlMs, 24 * 60 * 60_000),
      publicDemo: normalizePublicDemo(tenant.publicDemo, id, origins.map((origin) => normalizeOrigin(origin)), tenant.maxPageSessionTtlMs),
    };
  });
  if (tenants.length === 0) throw new ConfigError("至少需要一个 tenant");
  return { tenants };
}

function normalizePublicDemo(value, tenantId, tenantOrigins, maxPageSessionTtlMs) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigError(`tenant ${tenantId}.publicDemo 必须是对象`);
  }
  const allowedOrigins = new Set(tenantOrigins);
  const origins = Array.isArray(value.origins) ? value.origins : [];
  if (origins.length === 0 || origins.some((origin) => typeof origin !== "string" || !origin.trim())) {
    throw new ConfigError(`tenant ${tenantId}.publicDemo 必须至少配置一个 origin`);
  }
  const normalizedOrigins = origins.map(normalizeOrigin);
  const unknownOrigin = normalizedOrigins.find((origin) => !allowedOrigins.has(origin));
  if (unknownOrigin) {
    throw new ConfigError(`tenant ${tenantId}.publicDemo origin 必须也出现在 tenant.origins 中: ${unknownOrigin}`);
  }
  const scope = Array.isArray(value.scope)
    ? [...new Set(value.scope.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))]
    : [];
  if (scope.length === 0) throw new ConfigError(`tenant ${tenantId}.publicDemo.scope 不能为空`);
  return {
    origins: normalizedOrigins,
    scope,
    pageSessionTtlMs: Math.min(positiveInt(value.pageSessionTtlMs, 24 * 60 * 60_000), maxPageSessionTtlMs),
    maxSessionsPerWindow: positiveInt(value.maxSessionsPerWindow, 30),
    windowMs: positiveInt(value.windowMs, 10 * 60_000),
    maxActiveSessions: positiveInt(value.maxActiveSessions, 40),
    userIdPrefix: typeof value.userIdPrefix === "string" && value.userIdPrefix.trim() ? value.userIdPrefix.trim() : "public-demo",
  };
}

export function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`无效的 origin: ${value}`);
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new ConfigError(`origin 必须是纯 origin，不含路径、查询或凭据: ${value}`);
  }
  return url.origin;
}

function positiveInt(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
