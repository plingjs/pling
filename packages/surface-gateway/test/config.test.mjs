import assert from "node:assert/strict";
import test from "node:test";
import { ConfigError, normalizeConfig, normalizeOrigin } from "../src/config.mjs";

function tenant(overrides = {}) {
  return {
    id: "demo",
    origins: ["https://demo.example"],
    ...overrides,
  };
}

test("invalid positive limits fail closed instead of silently using defaults", () => {
  assert.throws(
    () => normalizeConfig({ tenants: [tenant({ maxPageSessionTtlMs: 0 })] }),
    (error) => error instanceof ConfigError && /positive integer/.test(error.message),
  );
  assert.throws(
    () => normalizeConfig({ tenants: [tenant({ maxAgentSessionTtlMs: "60000" })] }),
    (error) => error instanceof ConfigError && /positive integer/.test(error.message),
  );
});

test("origins must be http(s) origins without paths or credentials", () => {
  assert.equal(normalizeOrigin("https://Demo.Example:443/"), "https://demo.example");
  for (const value of ["ftp://demo.example", "https://demo.example/path", "https://user:pass@demo.example"]) {
    assert.throws(() => normalizeOrigin(value), (error) => error instanceof ConfigError);
  }
});

test("public demo configuration cannot escape the tenant origin or TTL limits", () => {
  assert.throws(
    () => normalizeConfig({
      tenants: [tenant({
        publicDemo: {
          origins: ["https://other.example"],
          scope: ["todo.add"],
        },
      })],
    }),
    (error) => error instanceof ConfigError && /also appear/.test(error.message),
  );
  assert.throws(
    () => normalizeConfig({
      tenants: [tenant({
        maxPageSessionTtlMs: 10_000,
        publicDemo: {
          origins: ["https://demo.example"],
          scope: ["todo.add"],
          pageSessionTtlMs: 20_000,
        },
      })],
    }),
    (error) => error instanceof ConfigError && /cannot exceed/.test(error.message),
  );
});
