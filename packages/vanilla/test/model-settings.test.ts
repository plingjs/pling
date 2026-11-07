import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_CONFIG } from "@plingjs/agent";
import {
  MODEL_SETTINGS_STORAGE_KEY,
  applyUserModelSettings,
  clearUserModelSettings,
  readUserModelSettings,
  resolveModelSettings,
  validateUserModelSettings,
  writeUserModelSettings,
} from "../src";

const BASE_CONFIG = { baseUrl: "/llm/v1", model: "app-model", stream: false } as const;

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("Vanilla model settings", () => {
  it("defaults to off and only persists keys in an explicit byok session", () => {
    expect(resolveModelSettings()).toEqual({ mode: "off", persist: "memory" });
    expect(resolveModelSettings("readonly")).toEqual({ mode: "readonly", persist: "memory" });
    expect(resolveModelSettings({ mode: "readonly", persist: "session" })).toEqual({
      mode: "readonly",
      persist: "memory",
    });
    expect(resolveModelSettings({ mode: "byok", persist: "session" })).toEqual({
      mode: "byok",
      persist: "session",
    });
  });

  it("round-trips complete settings and ignores malformed or partial entries", () => {
    const storage = new MemoryStorage();
    expect(readUserModelSettings(storage)).toBeNull();

    storage.setItem(MODEL_SETTINGS_STORAGE_KEY, "{bad json");
    expect(readUserModelSettings(storage)).toBeNull();

    storage.setItem(MODEL_SETTINGS_STORAGE_KEY, JSON.stringify({ baseUrl: "https://example.test/v1" }));
    expect(readUserModelSettings(storage)).toBeNull();

    writeUserModelSettings({ baseUrl: " https://example.test/v1 ", model: "own-model", apiKey: "sk-test" }, storage);
    expect(readUserModelSettings(storage)).toEqual({
      baseUrl: "https://example.test/v1",
      model: "own-model",
      apiKey: "sk-test",
    });

    clearUserModelSettings(storage);
    expect(readUserModelSettings(storage)).toBeNull();
  });

  it("overlays only the connection fields and validates direct endpoints", () => {
    const base = { ...DEFAULT_AGENT_CONFIG, ...BASE_CONFIG, temperature: 0.2 };
    const next = applyUserModelSettings(base, {
      baseUrl: "https://example.test/v1",
      model: "own-model",
      apiKey: "sk-test",
    });
    expect(next).toMatchObject({
      baseUrl: "https://example.test/v1",
      model: "own-model",
      apiKey: "sk-test",
      temperature: 0.2,
    });
    expect(validateUserModelSettings({ baseUrl: "", model: "m", apiKey: "" })).toBe("base_url");
    expect(validateUserModelSettings({ baseUrl: "/llm/v1", model: "", apiKey: "" })).toBe("model");
    expect(validateUserModelSettings({ baseUrl: "https://example.test/v1", model: "m", apiKey: "" })).toBe("api_key");
    expect(validateUserModelSettings({ baseUrl: "/llm/v1", model: "m", apiKey: "" })).toBeNull();
  });
});
