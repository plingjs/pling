import assert from "node:assert/strict";
import test from "node:test";
import { AuthError, AuthStore } from "../auth.mjs";

test("registers a user, hashes the password, and authenticates a session", () => {
  const auth = new AuthStore();
  const user = auth.register({ email: "Ada@Example.com", name: "Ada", password: "correct horse" });

  assert.equal(user.email, "ada@example.com");
  assert.equal(user.name, "Ada");
  assert.equal("password" in user, false);
  assert.equal(auth.login({ email: "ada@example.com", password: "correct horse" }).id, user.id);

  const session = auth.createSession(user.id);
  assert.equal(auth.authenticate(session.token)?.id, user.id);
  auth.revoke(session.token);
  assert.equal(auth.authenticate(session.token), null);
});

test("rejects duplicate emails, bad passwords, and expired sessions", () => {
  let now = 1_000;
  const auth = new AuthStore({ now: () => now });
  auth.register({ email: "ada@example.com", password: "correct horse" });

  assert.throws(
    () => auth.register({ email: "ADA@example.com", password: "another password" }),
    (error) => error instanceof AuthError && error.code === "EMAIL_IN_USE" && error.status === 409,
  );
  assert.throws(
    () => auth.login({ email: "ada@example.com", password: "wrong password" }),
    (error) => error instanceof AuthError && error.code === "INVALID_CREDENTIALS" && error.status === 401,
  );

  const session = auth.createSession(auth.login({ email: "ada@example.com", password: "correct horse" }).id);
  now = session.expiresAt + 1;
  assert.equal(auth.authenticate(session.token), null);
});
