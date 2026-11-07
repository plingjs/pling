import { readFile } from "node:fs/promises";

const MAX_SCOPE_ENTRIES = 256;

export class ConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
  }
}

export async function loadConfig(file) {
  let raw;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new ConfigError(
      "CONFIG_READ_FAILED",
      `Cannot read Surface Gateway config ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return normalizeConfig(raw);
}

export function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Array.isArray(raw.tenants)) {
    throw new ConfigError("CONFIG_INVALID", "Config must be an object with a tenants array.");
  }

  const seen = new Set();
  const tenants = raw.tenants.map((tenant, index) => {
    if (!tenant || typeof tenant !== "object" || Array.isArray(tenant)) {
      throw new ConfigError("CONFIG_INVALID", `tenants[${index}] must be an object.`);
    }

    const id = stringValue(tenant.id, `tenants[${index}].id`);
    if (seen.has(id)) throw new ConfigError("CONFIG_INVALID", `Duplicate tenant id: ${id}`);
    seen.add(id);

    const rawOrigins = Array.isArray(tenant.origins)
      ? tenant.origins
      : typeof tenant.origin === "string"
        ? [tenant.origin]
        : [];
    if (rawOrigins.length === 0) {
      throw new ConfigError("CONFIG_INVALID", `tenant ${id} must configure at least one origin.`);
    }
    const origins = [...new Set(rawOrigins.map((origin, originIndex) => {
      if (typeof origin !== "string" || !origin.trim()) {
        throw new ConfigError("CONFIG_INVALID", `tenants[${index}].origins[${originIndex}] must be a non-empty string.`);
      }
      return normalizeOrigin(origin);
    }))];

    const maxPageSessionTtlMs = positiveInteger(
      tenant.maxPageSessionTtlMs,
      24 * 60 * 60_000,
      `tenant ${id}.maxPageSessionTtlMs`,
    );
    const maxAgentSessionTtlMs = positiveInteger(
      tenant.maxAgentSessionTtlMs,
      24 * 60 * 60_000,
      `tenant ${id}.maxAgentSessionTtlMs`,
    );

    return {
      id,
      displayName:
        typeof tenant.displayName === "string" && tenant.displayName.trim()
          ? tenant.displayName.trim()
          : id,
      origins,
      maxPageSessionTtlMs,
      maxAgentSessionTtlMs,
      publicDemo: normalizePublicDemo(
        tenant.publicDemo,
        id,
        origins,
        maxPageSessionTtlMs,
      ),
    };
  });

  if (tenants.length === 0) {
    throw new ConfigError("CONFIG_INVALID", "At least one tenant is required.");
  }
  return { tenants };
}

function normalizePublicDemo(value, tenantId, tenantOrigins, maxPageSessionTtlMs) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigError("CONFIG_INVALID", `tenant ${tenantId}.publicDemo must be an object.`);
  }

  if (!Array.isArray(value.origins) || value.origins.length === 0) {
    throw new ConfigError("CONFIG_INVALID", `tenant ${tenantId}.publicDemo must configure at least one origin.`);
  }
  const tenantOriginSet = new Set(tenantOrigins);
  const origins = [...new Set(value.origins.map((origin, index) => {
    if (typeof origin !== "string" || !origin.trim()) {
      throw new ConfigError(
        "CONFIG_INVALID",
        `tenant ${tenantId}.publicDemo.origins[${index}] must be a non-empty string.`,
      );
    }
    return normalizeOrigin(origin);
  }))];
  const unknownOrigin = origins.find((origin) => !tenantOriginSet.has(origin));
  if (unknownOrigin) {
    throw new ConfigError(
      "CONFIG_INVALID",
      `tenant ${tenantId}.publicDemo origins must also appear in tenant.origins: ${unknownOrigin}`,
    );
  }

  if (!Array.isArray(value.scope)) {
    throw new ConfigError("CONFIG_INVALID", `tenant ${tenantId}.publicDemo.scope must be an array.`);
  }
  const scope = [...new Set(value.scope.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new ConfigError(
        "CONFIG_INVALID",
        `tenant ${tenantId}.publicDemo.scope[${index}] must be a non-empty string.`,
      );
    }
    return item.trim();
  }))];
  if (scope.length === 0) {
    throw new ConfigError("CONFIG_INVALID", `tenant ${tenantId}.publicDemo.scope must not be empty.`);
  }
  if (scope.length > MAX_SCOPE_ENTRIES) {
    throw new ConfigError(
      "CONFIG_INVALID",
      `tenant ${tenantId}.publicDemo.scope must contain at most ${MAX_SCOPE_ENTRIES} entries.`,
    );
  }

  const pageSessionTtlMs = positiveInteger(
    value.pageSessionTtlMs,
    24 * 60 * 60_000,
    `tenant ${tenantId}.publicDemo.pageSessionTtlMs`,
  );
  if (pageSessionTtlMs > maxPageSessionTtlMs) {
    throw new ConfigError(
      "CONFIG_INVALID",
      `tenant ${tenantId}.publicDemo.pageSessionTtlMs cannot exceed tenant.maxPageSessionTtlMs.`,
    );
  }

  return {
    origins,
    scope,
    pageSessionTtlMs,
    maxSessionsPerWindow: positiveInteger(
      value.maxSessionsPerWindow,
      30,
      `tenant ${tenantId}.publicDemo.maxSessionsPerWindow`,
    ),
    windowMs: positiveInteger(
      value.windowMs,
      10 * 60_000,
      `tenant ${tenantId}.publicDemo.windowMs`,
    ),
    maxActiveSessions: positiveInteger(
      value.maxActiveSessions,
      40,
      `tenant ${tenantId}.publicDemo.maxActiveSessions`,
    ),
    userIdPrefix:
      typeof value.userIdPrefix === "string" && value.userIdPrefix.trim()
        ? value.userIdPrefix.trim()
        : "public-demo",
  };
}

export function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError("CONFIG_INVALID", `Invalid origin: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError("CONFIG_INVALID", `Origin must use http or https: ${value}`);
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new ConfigError(
      "CONFIG_INVALID",
      `Origin must not contain a path, query, fragment, or credentials: ${value}`,
    );
  }
  return url.origin;
}

function stringValue(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ConfigError("CONFIG_INVALID", `${path} must be a non-empty string.`);
  }
  const text = value.trim();
  if (text.length > 128) {
    throw new ConfigError("CONFIG_INVALID", `${path} must be at most 128 characters.`);
  }
  return text;
}

function positiveInteger(value, fallback, path) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConfigError("CONFIG_INVALID", `${path} must be a positive integer.`);
  }
  return value;
}
