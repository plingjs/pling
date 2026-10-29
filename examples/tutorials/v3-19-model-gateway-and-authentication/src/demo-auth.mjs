const COOKIE_NAME = "pling_demo_session";

function readCookie(headers, name) {
  const raw = headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

function newToken() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function createDemoAuth(options) {
  if (options.password.length < 6) throw new Error("Demo password must contain at least 6 characters");
  const origin = new URL(options.publicOrigin);
  if (origin.protocol === "https:" && !options.secureCookie) {
    throw new Error("An HTTPS origin requires a Secure session cookie");
  }
  const ttl = options.sessionTtlMs ?? 60 * 60 * 1000;
  const sessions = new Map();

  const cookieFor = (token) => {
    const parts = [
      `${COOKIE_NAME}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${Math.floor(ttl / 1000)}`,
    ];
    if (options.secureCookie) parts.push("Secure");
    return parts.join("; ");
  };

  const sessionToken = (headers) => {
    const token = readCookie(headers, COOKIE_NAME);
    if (!token) return undefined;
    const session = sessions.get(token);
    if (!session) return undefined;
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return undefined;
    }
    return token;
  };

  return {
    login(password) {
      if (password !== options.password) return null;
      const token = newToken();
      const user = { id: "demo-user" };
      sessions.set(token, { user, expiresAt: Date.now() + ttl });
      return { user, cookie: cookieFor(token) };
    },

    authorize({ headers }) {
      const token = sessionToken(headers);
      if (!token) return { ok: false, status: 401, message: "Sign in before calling the model gateway" };
      return { ok: true, user: sessions.get(token).user };
    },

    logout(headers) {
      const token = readCookie(headers, COOKIE_NAME);
      if (token) sessions.delete(token);
      return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${options.secureCookie ? "; Secure" : ""}`;
    },

    isSignedIn(headers) {
      return sessionToken(headers) !== undefined;
    },
  };
}
