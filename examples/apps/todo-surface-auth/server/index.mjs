#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { createTodoServer } from "./app.mjs";
import { csv, loadEnvFiles } from "./env.mjs";
import { parseSurfaceScopes } from "./surface.mjs";

const caseRoot = fileURLToPath(new URL("..", import.meta.url));
loadEnvFiles([`${caseRoot}.env.local`, `${caseRoot}.env`]);

const port = numberEnv("TODO_BFF_PORT", 5221);
const host = process.env.TODO_BFF_HOST?.trim() || "127.0.0.1";
const gatewayUrl = process.env.SURFACE_GATEWAY_URL?.trim() || "http://127.0.0.1:5219";
const adminToken = process.env.SURFACE_ADMIN_TOKEN?.trim() || "";
const tenantId = process.env.SURFACE_TENANT_ID?.trim() || "demo";
let surfaceScopes;
try {
  surfaceScopes = parseSurfaceScopes(process.env.TODO_SURFACE_SCOPES);
} catch (error) {
  process.stderr.write(`[todo-demo] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
const allowedOrigins = csv(process.env.TODO_ALLOWED_ORIGINS) || [
  "http://127.0.0.1:5220",
  "http://localhost:5220",
  "https://todo.plingjs.dev",
];
const staticDir = process.env.TODO_DIST?.trim() || `${caseRoot}dist`;

const server = createTodoServer({
  allowedOrigins,
  cookieSecure: process.env.NODE_ENV === "production",
  staticDir,
  surface: { gatewayUrl, adminToken, tenantId, scope: surfaceScopes },
});

if (!adminToken) {
  process.stderr.write(
    "[todo-demo] SURFACE_ADMIN_TOKEN is empty. Login and todos still work, but third-party Agent pairing is disabled.\n",
  );
}

try {
  const address = await server.start(port, host);
  process.stderr.write(`[todo-demo] BFF listening on http://${host}:${address.port}\n`);
} catch (error) {
  process.stderr.write(`[todo-demo] failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  process.stderr.write(`[todo-demo] ${signal}: stopping\n`);
  try {
    await server.stop();
    process.exit(0);
  } catch (error) {
    process.stderr.write(`[todo-demo] shutdown failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));

function numberEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    process.stderr.write(`[todo-demo] ${name} must be a TCP port.\n`);
    process.exit(1);
  }
  return number;
}
