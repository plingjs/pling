#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.mjs";
import { createSurfaceServer } from "./server.mjs";

const defaultConfig = fileURLToPath(new URL("../config.example.json", import.meta.url));
const configPath = process.env.SURFACE_CONFIG?.trim() || defaultConfig;
const adminToken = process.env.SURFACE_ADMIN_TOKEN?.trim();
const publicBaseUrl = process.env.SURFACE_PUBLIC_BASE_URL?.trim();
const host = process.env.SURFACE_HOST?.trim() || "127.0.0.1";
const port = numberFromEnv("SURFACE_PORT", 5219);
const demoTenantId = process.env.SURFACE_DEMO_TENANT_ID?.trim() || "demo";

if (!adminToken) {
  process.stderr.write(
    "[surface-gateway] SURFACE_ADMIN_TOKEN is required. This token creates page sessions and reads admin state; never expose it to browsers.\n",
  );
  process.exit(1);
}

if (publicBaseUrl) {
  let parsed;
  try {
    parsed = new URL(publicBaseUrl);
  } catch {
    process.stderr.write("[surface-gateway] SURFACE_PUBLIC_BASE_URL must be an absolute http(s) URL.\n");
    process.exit(1);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    process.stderr.write("[surface-gateway] SURFACE_PUBLIC_BASE_URL must use http or https.\n");
    process.exit(1);
  }
}

let config;
try {
  config = await loadConfig(configPath);
} catch (error) {
  process.stderr.write(`[surface-gateway] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

const server = createSurfaceServer({
  config,
  adminToken,
  publicBaseUrl,
  host,
  port,
  demoTenantId,
});

try {
  const address = await server.start();
  process.stderr.write(`[surface-gateway] config ${configPath}\n`);
  process.stderr.write(`[surface-gateway] page WebSocket ${address.baseUrl.replace(/^http/, "ws")}/surface\n`);
  process.stderr.write(`[surface-gateway] remote MCP ${address.baseUrl}/mcp\n`);
} catch (error) {
  process.stderr.write(`[surface-gateway] failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  process.stderr.write(`[surface-gateway] ${signal}: stopping\n`);
  try {
    await server.stop();
    process.exit(0);
  } catch (error) {
    process.stderr.write(`[surface-gateway] shutdown failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));

function numberFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    process.stderr.write(`[surface-gateway] ${name} must be a TCP port.\n`);
    process.exit(1);
  }
  return number;
}
