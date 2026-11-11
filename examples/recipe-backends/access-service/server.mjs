#!/usr/bin/env node
/**
 * Local backend for the recipe demos.
 *
 * It is intentionally small and dependency-free. It demonstrates the request
 * boundaries used by the pages; it is not an identity provider, database, job
 * queue, or production approval system.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.RECIPE_API_PORT ?? 5193);
const host = process.env.RECIPE_API_HOST?.trim() || "127.0.0.1";
const allowedOrigins = new Set([
  "http://127.0.0.1:5190",
  "http://localhost:5190",
  "http://127.0.0.1:5191",
  "http://localhost:5191",
  ...(process.env.RECIPE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);

const users = new Map([
  [
    "demo@example.com",
    {
      id: "user_demo",
      email: "demo@example.com",
      name: "Lin Chen",
      passwordHash: hash("pling-demo"),
    },
  ],
]);

const invoices = new Map([
  ["INV-2041", { id: "INV-2041", ownerId: "user_demo", customer: "Northwind", amount: 4800, status: "open", note: "" }],
  ["INV-2042", { id: "INV-2042", ownerId: "user_demo", customer: "Globex", amount: 12600, status: "open", note: "" }],
  ["INV-2043", { id: "INV-2043", ownerId: "user_demo", customer: "Initech", amount: 3100, status: "paid", note: "Paid by transfer" }],
]);

const sessions = new Map();
const delegations = new Map();
const approvals = new Map();
const uploads = new Map();
const audit = [];

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function now() {
  return Date.now();
}

function id(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function auditEvent(type, fields = {}) {
  const event = { id: id("evt"), at: new Date().toISOString(), type, ...fields };
  audit.unshift(event);
  if (audit.length > 80) audit.length = 80;
  return event;
}

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function fail(res, status, code, message) {
  json(res, status, { error: { code, message } });
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-file-name");
}

async function readBody(req, limit = 2_500_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request body is too large"), { status: 413, code: "BODY_TOO_LARGE" });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const raw = await readBody(req, 200_000);
  if (raw.length === 0) return {};
  try {
    const value = JSON.parse(raw.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
    return value;
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400, code: "INVALID_JSON" });
  }
}

function sessionFrom(req) {
  const cookie = String(req.headers.cookie ?? "");
  const match = cookie.match(/(?:^|;\s*)recipe_session=([^;]+)/);
  if (!match) return null;
  const session = sessions.get(decodeURIComponent(match[1]));
  if (!session) return null;
  if (session.expiresAt <= now()) {
    sessions.delete(session.id);
    return null;
  }
  return session;
}

function requireSession(req, res) {
  const session = sessionFrom(req);
  if (!session) {
    fail(res, 401, "SESSION_EXPIRED", "Sign in again; the demo session is missing or expired.");
    return null;
  }
  const user = users.get(session.email);
  if (!user) {
    fail(res, 401, "SESSION_REVOKED", "The user no longer exists.");
    return null;
  }
  return { session, user };
}

function userInvoices(ownerId) {
  return [...invoices.values()].filter((invoice) => invoice.ownerId === ownerId);
}

function delegationView(value) {
  return {
    id: value.id,
    agent: value.agent,
    scopes: value.scopes,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    revokedAt: value.revokedAt ?? null,
  };
}

function uploadView(job) {
  return {
    id: job.id,
    name: job.name,
    size: job.size,
    type: job.type,
    state: job.state,
    progress: job.progress,
    error: job.error ?? null,
    createdAt: job.createdAt,
  };
}

function advanceUpload(job) {
  if (job.timer) clearInterval(job.timer);
  if (job.state !== "queued" && job.state !== "processing") return;
  job.state = "processing";
  job.error = null;
  job.timer = setInterval(() => {
    if (job.state !== "processing") return;
    job.progress = Math.min(100, job.progress + 12 + Math.floor(Math.random() * 10));
    if (job.progress < 100) return;
    job.progress = 100;
    job.state = job.name.toLowerCase().includes("virus") ? "failed" : "ready";
    job.error = job.state === "failed" ? "The file was rejected by the demo scanner." : null;
    clearInterval(job.timer);
    job.timer = null;
  }, 420);
}

function routeOf(pathname) {
  return pathname.replace(/^\/api\/recipe/, "") || "/";
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = routeOf(url.pathname);

    if (req.method === "GET" && path === "/health") {
      json(res, 200, { ok: true, service: "pling-recipe-access", now: new Date().toISOString() });
      return;
    }

    if (req.method === "POST" && path === "/session/login") {
      const body = await readJson(req);
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const user = users.get(email);
      if (!user || user.passwordHash !== hash(password)) {
        fail(res, 401, "LOGIN_REJECTED", "Email or password is incorrect.");
        return;
      }
      const sessionId = randomBytes(18).toString("base64url");
      const session = {
        id: sessionId,
        email,
        expiresAt: now() + 30 * 60_000,
        createdAt: now(),
      };
      sessions.set(sessionId, session);
      auditEvent("session.created", { actor: user.id, sessionId });
      json(
        res,
        200,
        { user: { id: user.id, email: user.email, name: user.name }, expiresAt: session.expiresAt },
        { "set-cookie": `recipe_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/api/recipe; Max-Age=1800` },
      );
      return;
    }

    if (req.method === "GET" && path === "/session/me") {
      const current = requireSession(req, res);
      if (!current) return;
      json(res, 200, {
        user: { id: current.user.id, email: current.user.email, name: current.user.name },
        expiresAt: current.session.expiresAt,
        invoices: userInvoices(current.user.id),
      });
      return;
    }

    if (req.method === "POST" && path === "/session/expire") {
      const current = requireSession(req, res);
      if (!current) return;
      current.session.expiresAt = now() - 1;
      auditEvent("session.expired", { actor: current.user.id, sessionId: current.session.id });
      json(res, 200, { expired: true });
      return;
    }

    if (req.method === "POST" && path === "/session/logout") {
      const current = requireSession(req, res);
      if (!current) return;
      sessions.delete(current.session.id);
      auditEvent("session.logged_out", { actor: current.user.id, sessionId: current.session.id });
      json(res, 200, { signedOut: true }, { "set-cookie": "recipe_session=; HttpOnly; SameSite=Lax; Path=/api/recipe; Max-Age=0" });
      return;
    }

    if (req.method === "POST" && path === "/session/note") {
      const current = requireSession(req, res);
      if (!current) return;
      const body = await readJson(req);
      const invoice = invoices.get(String(body.record ?? ""));
      if (!invoice || invoice.ownerId !== current.user.id) {
        fail(res, 404, "RECORD_NOT_FOUND", "The invoice is absent or belongs to another user.");
        return;
      }
      const note = String(body.note ?? "").trim();
      if (!note) {
        fail(res, 400, "INVALID_PARAM", "note is required.");
        return;
      }
      invoice.note = note.slice(0, 500);
      auditEvent("invoice.note.updated", { actor: current.user.id, sessionId: current.session.id, record: invoice.id });
      json(res, 200, { invoice });
      return;
    }

    if (req.method === "POST" && path === "/delegations") {
      const current = requireSession(req, res);
      if (!current) return;
      const body = await readJson(req);
      const requested = Array.isArray(body.scopes) ? body.scopes.map(String) : [];
      const allowed = new Set(["invoice.list", "invoice.add_note", "report.export"]);
      if (requested.length === 0 || requested.some((scope) => !allowed.has(scope))) {
        fail(res, 400, "INVALID_SCOPE", "Choose one or more capabilities from the demo allowlist.");
        return;
      }
      const ttlSeconds = Math.max(15, Math.min(3600, Number(body.ttlSeconds) || 120));
      const token = `dlg_${randomBytes(24).toString("base64url")}`;
      const delegation = {
        id: id("dlg"),
        ownerId: current.user.id,
        agent: String(body.agent ?? "demo-agent").slice(0, 80),
        scopes: [...new Set(requested)],
        tokenHash: hash(token),
        createdAt: new Date().toISOString(),
        expiresAt: now() + ttlSeconds * 1000,
        revokedAt: null,
      };
      delegations.set(delegation.id, delegation);
      auditEvent("delegation.issued", { actor: current.user.id, delegationId: delegation.id, scopes: delegation.scopes });
      json(res, 201, { delegation: delegationView(delegation), token });
      return;
    }

    if (req.method === "GET" && path === "/delegations") {
      const current = requireSession(req, res);
      if (!current) return;
      json(res, 200, {
        delegations: [...delegations.values()]
          .filter((value) => value.ownerId === current.user.id)
          .map(delegationView),
      });
      return;
    }

    const delegationMatch = path.match(/^\/delegations\/([^/]+)$/);
    if (req.method === "DELETE" && delegationMatch) {
      const current = requireSession(req, res);
      if (!current) return;
      const delegation = delegations.get(decodeURIComponent(delegationMatch[1]));
      if (!delegation || delegation.ownerId !== current.user.id) {
        fail(res, 404, "DELEGATION_NOT_FOUND", "The delegation does not exist.");
        return;
      }
      delegation.revokedAt = new Date().toISOString();
      auditEvent("delegation.revoked", { actor: current.user.id, delegationId: delegation.id });
      json(res, 200, { delegation: delegationView(delegation) });
      return;
    }

    if (req.method === "POST" && path === "/delegations/invoke") {
      const bearer = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const delegation = [...delegations.values()].find((value) => value.tokenHash === hash(bearer));
      if (!delegation) {
        fail(res, 401, "SESSION_REVOKED", "The delegated credential is unknown.");
        return;
      }
      if (delegation.revokedAt) {
        fail(res, 401, "SESSION_REVOKED", "The delegated credential was revoked.");
        return;
      }
      if (delegation.expiresAt <= now()) {
        fail(res, 401, "SESSION_EXPIRED", "The delegated credential expired.");
        return;
      }
      const body = await readJson(req);
      const capability = String(body.capability ?? "");
      if (!delegation.scopes.includes(capability)) {
        auditEvent("delegation.denied", { actor: delegation.agent, delegationId: delegation.id, capability });
        fail(res, 403, "SCOPE_DENIED", `${capability} is outside this delegation's scope.`);
        return;
      }
      const ownerInvoices = userInvoices(delegation.ownerId);
      auditEvent("delegation.invoked", { actor: delegation.agent, delegationId: delegation.id, capability });
      if (capability === "invoice.list") {
        json(res, 200, { capability, result: { invoices: ownerInvoices } });
        return;
      }
      if (capability === "report.export") {
        json(res, 200, { capability, result: { rows: ownerInvoices.length, total: ownerInvoices.reduce((sum, item) => sum + item.amount, 0) } });
        return;
      }
      const input = body.input && typeof body.input === "object" ? body.input : {};
      const invoice = invoices.get(String(input.record ?? ""));
      if (!invoice || invoice.ownerId !== delegation.ownerId) {
        fail(res, 404, "RECORD_NOT_FOUND", "The invoice is absent or outside this delegation.");
        return;
      }
      const note = String(input.note ?? "").trim();
      if (!note) {
        fail(res, 400, "INVALID_PARAM", "note is required.");
        return;
      }
      invoice.note = note.slice(0, 500);
      json(res, 200, { capability, result: { invoice } });
      return;
    }

    if (req.method === "POST" && path === "/approvals") {
      const current = requireSession(req, res);
      if (!current) return;
      const body = await readJson(req);
      const capability = String(body.capability ?? "");
      const record = String(body.record ?? "");
      if (capability !== "invoice.delete" || !invoices.has(record)) {
        fail(res, 400, "INVALID_APPROVAL_REQUEST", "Only invoice.delete on an existing invoice is supported.");
        return;
      }
      const approval = {
        id: id("apr"),
        ownerId: current.user.id,
        capability,
        record,
        state: "pending",
        requestedBy: String(body.requestedBy ?? "codex"),
        createdAt: new Date().toISOString(),
      };
      approvals.set(approval.id, approval);
      auditEvent("approval.requested", { actor: current.user.id, requestId: approval.id, record });
      json(res, 201, { approval });
      return;
    }

    if (req.method === "GET" && path === "/approvals") {
      const current = requireSession(req, res);
      if (!current) return;
      json(res, 200, {
        approvals: [...approvals.values()].filter((value) => value.ownerId === current.user.id),
      });
      return;
    }

    const approvalMatch = path.match(/^\/approvals\/([^/]+)\/decision$/);
    if (req.method === "POST" && approvalMatch) {
      const current = requireSession(req, res);
      if (!current) return;
      const approval = approvals.get(decodeURIComponent(approvalMatch[1]));
      if (!approval || approval.ownerId !== current.user.id) {
        fail(res, 404, "APPROVAL_NOT_FOUND", "The approval request does not exist.");
        return;
      }
      if (approval.state !== "pending") {
        fail(res, 409, "APPROVAL_ALREADY_DECIDED", "This approval request was already decided.");
        return;
      }
      const body = await readJson(req);
      const decision = String(body.decision ?? "");
      if (decision !== "approve" && decision !== "reject") {
        fail(res, 400, "INVALID_DECISION", "decision must be approve or reject.");
        return;
      }
      approval.state = decision === "approve" ? "approved" : "rejected";
      approval.decidedAt = new Date().toISOString();
      if (decision === "approve") invoices.delete(approval.record);
      auditEvent(decision === "approve" ? "approval.approved" : "approval.rejected", {
        actor: current.user.id,
        requestId: approval.id,
        record: approval.record,
      });
      json(res, 200, { approval, invoices: userInvoices(current.user.id) });
      return;
    }

    if (req.method === "POST" && path === "/external/request") {
      const current = requireSession(req, res);
      if (!current) return;
      const body = await readJson(req);
      const snapshot = [...delegations.values()]
        .filter((value) => value.ownerId === current.user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!snapshot || snapshot.revokedAt || snapshot.expiresAt <= now()) {
        auditEvent("external.denied", { actor: current.user.id, capability: String(body.capability ?? "unknown") });
        fail(res, 403, "SESSION_REVOKED", "External access has been revoked.");
        return;
      }
      json(res, 200, { accepted: true, capability: String(body.capability ?? "invoice.list") });
      return;
    }

    if (req.method === "GET" && path === "/audit") {
      const current = requireSession(req, res);
      if (!current) return;
      json(res, 200, { events: audit });
      return;
    }

    if (req.method === "POST" && path === "/uploads") {
      const fileName = String(req.headers["x-file-name"] ?? "document.pdf").slice(0, 160);
      const body = await readBody(req);
      if (body.length === 0) {
        fail(res, 400, "EMPTY_FILE", "Choose a non-empty file.");
        return;
      }
      const job = {
        id: id("job"),
        name: fileName,
        size: body.length,
        type: String(req.headers["content-type"] ?? "application/octet-stream"),
        state: "queued",
        progress: 0,
        createdAt: new Date().toISOString(),
        timer: null,
      };
      uploads.set(job.id, job);
      advanceUpload(job);
      auditEvent("upload.queued", { record: job.id });
      json(res, 201, { upload: uploadView(job) });
      return;
    }

    if (req.method === "GET" && path === "/uploads") {
      json(res, 200, { uploads: [...uploads.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(uploadView) });
      return;
    }

    const uploadMatch = path.match(/^\/uploads\/([^/]+)(\/retry)?$/);
    if (uploadMatch && (req.method === "DELETE" || (req.method === "POST" && uploadMatch[2]))) {
      const job = uploads.get(decodeURIComponent(uploadMatch[1]));
      if (!job) {
        fail(res, 404, "UPLOAD_NOT_FOUND", "The upload job does not exist.");
        return;
      }
      if (req.method === "DELETE") {
        if (job.timer) clearInterval(job.timer);
        job.timer = null;
        job.state = "cancelled";
        auditEvent("upload.cancelled", { record: job.id });
        json(res, 200, { upload: uploadView(job) });
        return;
      }
      job.state = "queued";
      job.progress = 0;
      job.error = null;
      advanceUpload(job);
      auditEvent("upload.retried", { record: job.id });
      json(res, 200, { upload: uploadView(job) });
      return;
    }

    fail(res, 404, "NOT_FOUND", `No route for ${req.method} ${path}.`);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = String(error?.code ?? "INTERNAL_ERROR");
    fail(res, status, code, error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`[pling-recipe-api] http://${host}:${port}`);
  console.log("[pling-recipe-api] demo login: demo@example.com / pling-demo");
  console.log("[pling-recipe-api] in-memory storage; restart clears accounts, sessions, approvals, and uploads");
});
