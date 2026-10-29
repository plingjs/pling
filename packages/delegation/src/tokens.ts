import { DelegationError } from "./errors";
import { DELEGATION_TOKEN_PREFIX } from "./types";

const encoder = new TextEncoder();

function webCrypto(): Crypto {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto.subtle) {
    throw new DelegationError("DELEGATION_INTERNAL_ERROR", "当前运行时缺少 Web Crypto");
  }
  return globalThis.crypto;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  webCrypto().getRandomValues(value);
  return `${DELEGATION_TOKEN_PREFIX}${base64Url(value)}`;
}

export function randomId(prefix: string, bytes = 16): string {
  const value = new Uint8Array(bytes);
  webCrypto().getRandomValues(value);
  return `${prefix}_${base64Url(value)}`;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await webCrypto().subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hasTokenPrefix(token: unknown): token is string {
  return typeof token === "string" && token.startsWith(DELEGATION_TOKEN_PREFIX);
}
