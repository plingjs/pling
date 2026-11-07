import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig } from "./config.mjs";
import { createSurfaceServer } from "./server.mjs";

/**
 * The same module runs from `src/` during workspace development and from the
 * package root after publishing. Resolve both layouts instead of assuming one.
 */
export function resolveDefaultConfig(moduleUrl) {
  const candidates = [
    new URL("../config.example.json", moduleUrl),
    new URL("./config.example.json", moduleUrl),
  ];
  return fileURLToPath(candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]);
}

const DEFAULT_CONFIG = resolveDefaultConfig(import.meta.url);

/**
 * Start the gateway from environment variables.
 *
 * This function is also used by the thin deployment wrapper in services/. It
 * installs SIGINT/SIGTERM handlers by default so a container can stop cleanly.
 */
export async function runSurfaceGatewayCli(options = {}) {
  const env = options.env ?? process.env;
  const stderr = options.stderr ?? process.stderr;
  const configPath = env.SURFACE_CONFIG?.trim() || DEFAULT_CONFIG;
  const adminToken = env.SURFACE_ADMIN_TOKEN?.trim();
  const publicBaseUrl = env.SURFACE_PUBLIC_BASE_URL?.trim() || undefined;
  const host = env.SURFACE_HOST?.trim() || "127.0.0.1";
  const port = numberFromEnv(env, "SURFACE_PORT", 5219);
  const demoTenantId = env.SURFACE_DEMO_TENANT_ID?.trim() || "demo";
  const trustProxy = booleanFromEnv(env, "SURFACE_TRUST_PROXY", false);

  if (!adminToken) {
    throw new ConfigError(
      "SURFACE_ADMIN_TOKEN_REQUIRED",
      "SURFACE_ADMIN_TOKEN is required. It creates page sessions and reads admin state; never expose it to browsers.",
    );
  }

  const config = await loadConfig(configPath);
  const server = createSurfaceServer({
    config,
    adminToken,
    publicBaseUrl,
    host,
    port,
    demoTenantId,
    trustProxy,
  });

  let address;
  try {
    address = await server.start();
  } catch (error) {
    throw new ConfigError(
      "SURFACE_START_FAILED",
      `Failed to start Surface Gateway: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  stderr.write(`[surface-gateway] config ${configPath}\n`);
  stderr.write(`[surface-gateway] page WebSocket ${address.baseUrl.replace(/^http/, "ws")}/surface\n`);
  stderr.write(`[surface-gateway] remote MCP ${address.baseUrl}/mcp\n`);

  let stopping = false;
  async function stop(signal = "shutdown") {
    if (stopping) return;
    stopping = true;
    stderr.write(`[surface-gateway] ${signal}: stopping\n`);
    removeSignalHandlers();
    await server.stop();
  }

  const onSigint = () => void stop("SIGINT").catch((error) => handleStopFailure(stderr, error));
  const onSigterm = () => void stop("SIGTERM").catch((error) => handleStopFailure(stderr, error));
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  function removeSignalHandlers() {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  }

  return { server, config, configPath, ...address, stop };
}

export function cliHelp() {
  return [
    "Pling Surface Gateway",
    "",
    "Usage: pling-surface-gateway",
    "",
    "Required environment:",
    "  SURFACE_ADMIN_TOKEN       Server-to-server admin token",
    "",
    "Optional environment:",
    "  SURFACE_CONFIG            JSON config path (default: bundled config.example.json)",
    "  SURFACE_PUBLIC_BASE_URL   Public origin used in generated URLs",
    "  SURFACE_HOST              Listen host (default: 127.0.0.1)",
    "  SURFACE_PORT              Listen port (default: 5219)",
    "  SURFACE_DEMO_TENANT_ID    Tenant used by the public demo route (default: demo)",
    "  SURFACE_TRUST_PROXY       Set to 1 only behind a trusted proxy that overwrites X-Forwarded-For",
    "",
  ].join("\n");
}

function numberFromEnv(env, name, fallback) {
  const value = env[name];
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    throw new ConfigError("CONFIG_INVALID", `${name} must be a TCP port between 1 and 65535.`);
  }
  return number;
}

function booleanFromEnv(env, name, fallback) {
  const value = env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new ConfigError("CONFIG_INVALID", `${name} must be 1/0, true/false, yes/no, or on/off.`);
}

function handleStopFailure(stderr, error) {
  stderr.write(`[surface-gateway] shutdown failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
