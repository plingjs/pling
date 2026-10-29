import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENT_CONFIG, type AgentRuntime } from "@plingjs/agent";
import { createPling } from "../src/directive";
import AgentDock from "../src/components/AgentDock.vue";
import {
  MODEL_SETTINGS_STORAGE_KEY,
  applyUserModelSettings,
  clearUserModelSettings,
  readUserModelSettings,
  resolveModelSettings,
  validateUserModelSettings,
  writeUserModelSettings,
  type ModelSettingsSetting,
} from "../src/model-settings";

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

function optionalLocalStorage(): Storage | undefined {
  try {
    return window.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function host(modelSettings?: ModelSettingsSetting) {
  const pi = createPling({
    onWarn: () => {},
    ui: { locale: "en-US" },
    agent: {
      config: BASE_CONFIG,
      modelSettings,
      gate: () => false,
    },
  });
  const Host = defineComponent({
    template: `<AgentDock default-open />`,
    components: { AgentDock },
  });
  return mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
}

async function openActivity(wrapper: ReturnType<typeof host>): Promise<void> {
  const tab = wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("Activity"))!;
  await tab.trigger("click");
  await nextTick();
}

async function openSettings(wrapper: ReturnType<typeof host>): Promise<void> {
  await openActivity(wrapper);
  await wrapper.find('[data-testid="pling-model-settings-toggle"]').trigger("click");
  await nextTick();
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("model settings configuration", () => {
  it("defaults to off and resolves the two explicit modes", () => {
    expect(resolveModelSettings()).toEqual({ mode: "off", persist: "memory" });
    expect(resolveModelSettings("readonly")).toEqual({ mode: "readonly", persist: "memory" });
    expect(resolveModelSettings({ mode: "byok", persist: "session" })).toEqual({
      mode: "byok",
      persist: "session",
    });
    expect(resolveModelSettings({ mode: "readonly", persist: "session" })).toEqual({
      mode: "readonly",
      persist: "memory",
    });
  });

  it("only persists complete settings when a store is supplied", () => {
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

describe("<AgentDock> model settings", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    optionalLocalStorage()?.clear();
    vi.restoreAllMocks();
  });

  it("is absent by default", async () => {
    const wrapper = host();
    await openActivity(wrapper);
    expect(wrapper.find('[data-testid="pling-model-settings-toggle"]').exists()).toBe(false);
  });

  it("shows a read-only summary without exposing the application key", async () => {
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "en-US" },
      agent: {
        config: { baseUrl: "https://gateway.test/v1", model: "gateway-model", apiKey: "server-only-secret", stream: false },
        modelSettings: "readonly",
      },
    });
    const Host = defineComponent({ template: `<AgentDock default-open />`, components: { AgentDock } });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await openSettings(wrapper);

    const panel = wrapper.find('[data-testid="pling-model-settings"]');
    expect(panel.text()).toContain("Managed by this application");
    expect(panel.text()).toContain("https://gateway.test/v1");
    expect(panel.text()).toContain("gateway-model");
    expect(panel.find("input").exists()).toBe(false);
    expect(panel.text()).not.toContain("server-only-secret");
  });

  it("saves a BYOK connection, starts a fresh runtime, and keeps the key out of web storage by default", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ content?: string }> };
      const question = body.messages?.at(-1)?.content;
      const content = question === "second question" ? "second answer" : "first answer";
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = host("byok");
    const exposed = (target: ReturnType<typeof host>) =>
      (target.findComponent(AgentDock).vm as unknown as { runtime: AgentRuntime }).runtime;
    const oldRuntime = exposed(wrapper);

    await wrapper.find(".dock__chat .composer input").setValue("first question");
    await wrapper.find(".dock__chat form").trigger("submit");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("first answer"));
    expect(fetchMock).toHaveBeenCalledOnce();

    await openSettings(wrapper);
    await wrapper.find('[data-testid="pling-model-base-url"]').setValue("https://example.test/v1");
    await wrapper.find('[data-testid="pling-model-name"]').setValue("own-model");
    await wrapper.find('[data-testid="pling-model-api-key"]').setValue("sk-test");
    await wrapper.find(".model-settings__form").trigger("submit");
    await nextTick();

    const nextRuntime = exposed(wrapper);
    expect(nextRuntime).not.toBe(oldRuntime);
    expect(nextRuntime.config.baseUrl).toBe("https://example.test/v1");
    expect(nextRuntime.config.model).toBe("own-model");
    expect(nextRuntime.readiness.ready).toBe(true);
    expect(wrapper.find(".dock__chat").text()).toContain("Model changed to own-model");
    expect(wrapper.find(".dock__chat").text()).not.toContain("first question");
    expect(window.sessionStorage.getItem(MODEL_SETTINGS_STORAGE_KEY)).toBeNull();
    expect(optionalLocalStorage()?.getItem(MODEL_SETTINGS_STORAGE_KEY) ?? null).toBeNull();

    await wrapper.find(".dock__chat .composer input").setValue("second question");
    await wrapper.find(".dock__chat form").trigger("submit");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("second answer"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as { model?: string };
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect(body.model).toBe("own-model");
  });

  it("can restore a BYOK connection from sessionStorage when the developer opts in", async () => {
    const wrapper = host({ mode: "byok", persist: "session" });
    await openSettings(wrapper);
    await wrapper.find('[data-testid="pling-model-base-url"]').setValue("https://example.test/v1");
    await wrapper.find('[data-testid="pling-model-name"]').setValue("session-model");
    await wrapper.find('[data-testid="pling-model-api-key"]').setValue("sk-session");
    await wrapper.find(".model-settings__form").trigger("submit");
    await nextTick();

    expect(JSON.parse(window.sessionStorage.getItem(MODEL_SETTINGS_STORAGE_KEY) ?? "{}")).toEqual({
      baseUrl: "https://example.test/v1",
      model: "session-model",
      apiKey: "sk-session",
    });
    wrapper.unmount();

    const remounted = host({ mode: "byok", persist: "session" });
    await openSettings(remounted);
    expect((remounted.find('[data-testid="pling-model-base-url"]').element as HTMLInputElement).value).toBe(
      "https://example.test/v1",
    );
    expect((remounted.find('[data-testid="pling-model-name"]').element as HTMLInputElement).value).toBe(
      "session-model",
    );
    expect((remounted.find('[data-testid="pling-model-api-key"]').element as HTMLInputElement).value).toBe(
      "sk-session",
    );
  });
});
