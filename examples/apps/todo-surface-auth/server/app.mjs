import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { AuthError, AuthStore } from "./auth.mjs";
import { SurfaceProvisionError, provisionPageSession } from "./surface.mjs";
import { TodoError, TodoStore } from "./todos.mjs";

const COOKIE_NAME = "pling_todo_session";
const MAX_BODY_BYTES = 64 * 1024;

class HttpError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = status;
  }
}

/** HTTP BFF for the demo. Authentication and todo writes stay same-origin. */
export function createTodoServer(options = {}) {
  const auth = options.auth ?? new AuthStore();
  const todos = options.todos ?? new TodoStore();
  const cookieSecure = options.cookieSecure ?? false;
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const provision = options.provision ?? ((input) => provisionPageSession(input));
  const surface = options.surface ?? null;
  const staticDir = options.staticDir ? resolve(options.staticDir) : null;
  const logger = options.logger ?? ((message) => process.stderr.write(`${message}\n`));

  const server = createServer((request, response) => {
    void route(request, response).catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const failure = normalizeError(error);
      sendApiError(response, failure);
    });
  });

  async function route(request, response) {
    setSecurityHeaders(response);
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      response.setHeader("cache-control", "no-store");
      applyCors(request, response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        return response.end();
      }
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson(response, 200, { ok: true, service: "pling-todo-demo", surfaceConfigured: Boolean(surface?.adminToken) });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register") {
      assertSameOrigin(request);
      const body = await readJson(request);
      const user = auth.register(body);
      const session = auth.createSession(user.id);
      setSessionCookie(response, session, cookieSecure);
      return sendJson(response, 201, { user, todos: todos.list(user.id), expiresAt: session.expiresAt });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      assertSameOrigin(request);
      const body = await readJson(request);
      const user = auth.login(body);
      const session = auth.createSession(user.id);
      setSessionCookie(response, session, cookieSecure);
      return sendJson(response, 200, { user, todos: todos.list(user.id), expiresAt: session.expiresAt });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      assertSameOrigin(request);
      auth.revoke(cookieValue(request, COOKIE_NAME));
      clearSessionCookie(response, cookieSecure);
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      const user = currentUser(request);
      if (!user) return sendJson(response, 401, { user: null });
      return sendJson(response, 200, { user, todos: todos.list(user.id) });
    }

    if (url.pathname.startsWith("/api/todos") || url.pathname === "/api/surface/page-session") {
      assertSameOrigin(request);
    }

    if (request.method === "GET" && url.pathname === "/api/todos") {
      const user = requireUser(request);
      return sendJson(response, 200, { todos: todos.list(user.id) });
    }

    if (request.method === "POST" && url.pathname === "/api/todos") {
      const user = requireUser(request);
      const body = await readJson(request);
      const todo = todos.create(user.id, body.text);
      return sendJson(response, 201, { todo });
    }

    if (request.method === "POST" && url.pathname === "/api/todos/clear-completed") {
      const user = requireUser(request);
      return sendJson(response, 200, todos.clearCompleted(user.id));
    }

    const toggle = url.pathname.match(/^\/api\/todos\/([^/]+)\/toggle$/);
    if (request.method === "POST" && toggle) {
      const user = requireUser(request);
      return sendJson(response, 200, { todo: todos.toggle(user.id, decodeURIComponent(toggle[1])) });
    }

    const remove = url.pathname.match(/^\/api\/todos\/([^/]+)$/);
    if (request.method === "DELETE" && remove) {
      const user = requireUser(request);
      return sendJson(response, 200, { todo: todos.remove(user.id, decodeURIComponent(remove[1])) });
    }

    if (request.method === "POST" && url.pathname === "/api/surface/page-session") {
      const user = requireUser(request);
      if (!surface) {
        throw new SurfaceProvisionError(
          "SURFACE_NOT_CONFIGURED",
          "Surface Gateway is not configured for this demo server.",
          503,
        );
      }
      const page = await provision({
        gatewayUrl: surface.gatewayUrl,
        adminToken: surface.adminToken,
        tenantId: surface.tenantId ?? "demo",
        userId: user.id,
        scope: surface.scope,
        fetchImpl: surface.fetchImpl,
      });
      logger(`[todo-demo] page session created for ${user.id}: ${page.pageSessionId}`);
      return sendJson(response, 201, page);
    }

    if (url.pathname.startsWith("/api/")) throw new HttpError("NOT_FOUND", "API route not found", 404);

    if (staticDir && (request.method === "GET" || request.method === "HEAD")) {
      return serveStatic(request, response, url, staticDir);
    }
    throw new HttpError("NOT_FOUND", "Not found", 404);
  }

  function currentUser(request) {
    return auth.authenticate(cookieValue(request, COOKIE_NAME));
  }

  function requireUser(request) {
    const user = currentUser(request);
    if (!user) throw new HttpError("UNAUTHORIZED", "Sign in first", 401);
    return user;
  }

  function assertSameOrigin(request) {
    const origin = request.headers.origin;
    if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) return;
    throw new HttpError("ORIGIN_NOT_ALLOWED", "Request Origin is not allowed", 403);
  }

  function applyCors(request, response) {
    const origin = request.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) return;
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("access-control-allow-headers", "content-type");
    response.setHeader("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.setHeader("vary", "Origin");
  }

  async function start(port, host = "127.0.0.1") {
    await new Promise((resolveStart, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolveStart();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, host);
    });
    const address = server.address();
    return { port: typeof address === "object" && address ? address.port : port };
  }

  async function stop() {
    if (!server.listening) return;
    await new Promise((resolveStop, reject) => server.close((error) => (error ? reject(error) : resolveStop())));
  }

  return { start, stop, auth, todos };
}

async function readJson(request) {
  const type = String(request.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json", 415);
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new HttpError("BODY_TOO_LARGE", "Request body is too large", 413);
    chunks.push(chunk);
  }
  if (total === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value;
  } catch {
    throw new HttpError("INVALID_JSON", "Request body must be a JSON object", 400);
  }
}

function setSessionCookie(response, session, secure) {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1_000));
  response.setHeader(
    "set-cookie",
    `${COOKIE_NAME}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureSuffix(secure)}`,
  );
}

function clearSessionCookie(response, secure) {
  response.setHeader("set-cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureSuffix(secure)}`);
}

function secureSuffix(secure) {
  return secure || process.env.NODE_ENV === "production" ? "; Secure" : "";
}

function cookieValue(request, name) {
  const header = String(request.headers.cookie ?? "");
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return "";
}

function setSecurityHeaders(response) {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss: http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendApiError(response, error) {
  sendJson(response, error.status ?? 500, { error: { code: error.code ?? "INTERNAL_ERROR", message: error.message } });
}

function normalizeError(error) {
  if (error instanceof AuthError || error instanceof TodoError || error instanceof SurfaceProvisionError || error instanceof HttpError) {
    return error;
  }
  return new HttpError("INTERNAL_ERROR", error instanceof Error ? error.message : String(error), 500);
}

async function serveStatic(request, response, url, root) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new HttpError("BAD_PATH", "Invalid path", 400);
  }
  // Vite receives demo/index.html as its entry, so the built page lives under
  // demo/ while fingerprinted assets remain at the dist root.
  const relative = pathname === "/" ? "demo/index.html" : pathname.replace(/^\//, "");
  let file = resolve(root, normalize(relative));
  if (file !== root && !file.startsWith(`${root}${sep}`)) throw new HttpError("BAD_PATH", "Invalid path", 400);
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = join(file, "index.html");
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) {
    // Single-page app fallback. API routes were handled above.
    file = join(root, "demo", "index.html");
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) throw new HttpError("NOT_FOUND", "Not found", 404);
  response.writeHead(200, {
    "content-type": mimeType(file),
    "content-length": info.size,
    "cache-control": file.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
  });
  if (request.method === "HEAD") return response.end();
  createReadStream(file).pipe(response);
}

function mimeType(file) {
  switch (extname(file).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}
