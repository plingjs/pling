import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 8 * 60 * 60_000;
const MAX_PASSWORD_LENGTH = 200;

export class AuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

/** In-memory demo identity store. Replace with the application's SSO/database. */
export class AuthStore {
  #usersById = new Map();
  #usersByEmail = new Map();
  #sessions = new Map();
  #now;

  constructor(options = {}) {
    this.#now = options.now ?? Date.now;
  }

  register(input = {}) {
    const email = normalizeEmail(input.email);
    const name = normalizeName(input.name, email);
    const password = normalizePassword(input.password);
    if (this.#usersByEmail.has(email)) throw new AuthError("EMAIL_IN_USE", "That email is already registered", 409);

    const user = { id: `u_${randomUUID()}`, email, name, createdAt: this.#now(), password: hashPassword(password) };
    this.#usersById.set(user.id, user);
    this.#usersByEmail.set(email, user);
    return publicUser(user);
  }

  login(input = {}) {
    const email = normalizeEmail(input.email);
    const password = normalizePassword(input.password);
    const user = this.#usersByEmail.get(email);
    if (!user || !verifyPassword(password, user.password)) {
      throw new AuthError("INVALID_CREDENTIALS", "Email or password is incorrect", 401);
    }
    return publicUser(user);
  }

  createSession(userId) {
    const user = this.#usersById.get(userId);
    if (!user) throw new AuthError("USER_NOT_FOUND", "User not found", 404);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = this.#now() + SESSION_TTL_MS;
    this.#sessions.set(token, { userId, expiresAt });
    return { token, expiresAt };
  }

  authenticate(token) {
    if (!token) return null;
    const session = this.#sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= this.#now()) {
      this.#sessions.delete(token);
      return null;
    }
    const user = this.#usersById.get(session.userId);
    return user ? publicUser(user) : null;
  }

  revoke(token) {
    if (token) this.#sessions.delete(token);
  }
}

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AuthError("INVALID_EMAIL", "Enter a valid email address", 400);
  }
  return email;
}

function normalizeName(value, email) {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length > 80) throw new AuthError("INVALID_NAME", "Name is too long", 400);
  return name || email.split("@", 1)[0];
}

function normalizePassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > MAX_PASSWORD_LENGTH) {
    throw new AuthError("INVALID_PASSWORD", "Password must be between 8 and 200 characters", 400);
  }
  return value;
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

function verifyPassword(password, stored) {
  const expected = Buffer.from(stored.hash, "base64");
  const actual = scryptSync(password, Buffer.from(stored.salt, "base64"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}
