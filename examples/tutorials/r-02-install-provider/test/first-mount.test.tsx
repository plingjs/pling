import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";
import {
  DEMO_LOCALES,
  copyFor,
  normalizeDemoLocale,
  plingLocale,
  resolveDemoLocale,
  type DemoLocale,
} from "../src/copy";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const requestedLocale = normalizeDemoLocale(import.meta.env.VITE_DEMO_LOCALE);
const locales: readonly DemoLocale[] = requestedLocale ? [requestedLocale] : DEMO_LOCALES;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.innerHTML = "";
  root = null;
  host = null;
});

async function mountApp(locale: DemoLocale) {
  const llm = createReplayLlm([{ content: locale === "zh" ? "页面已连接。" : "The page is connected." }]);
  const warnings: string[] = [];
  const pling = createPling({
    presence: false,
    onWarn: (message) => warnings.push(message),
    ui: { locale: plingLocale(locale) },
    agent: { llm },
  });

  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <App locale={locale} />
      </PlingProvider>,
    );
  });

  return { llm, pling, warnings };
}

describe.each(locales)("R-02 · React install and first mount (%s)", (locale) => {
  const copy = copyFor(locale);

  it("mounts the assistant without exposing any page action", async () => {
    const { pling, warnings } = await mountApp(locale);

    expect(document.querySelector("h1")?.textContent).toBe(copy.heading);
    expect(document.querySelector("main")?.getAttribute("data-locale")).toBe(locale);
    expect(document.querySelector(".pling-dock__launcher")).not.toBeNull();
    expect(pling.registry.snapshot().actions).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("does not rewrite the business tree when Pling mounts", async () => {
    const { pling } = await mountApp(locale);

    expect(document.querySelectorAll(".checks li")).toHaveLength(4);
    expect(document.querySelector(".checks li.is-pending")?.textContent).toContain(copy.checks[3]!);
    expect(pling.registry.snapshot().records).toEqual([]);
    expect(pling.registry.snapshot().state).toEqual({});
  });
});

describe("R-02 · demo locale resolution", () => {
  it("prefers the explicit query parameter", () => {
    expect(resolveDemoLocale("?lang=zh", "en")).toBe("zh");
    expect(resolveDemoLocale("?lang=en-US", "zh")).toBe("en");
  });

  it("falls back to the build locale and then English", () => {
    expect(resolveDemoLocale("", "zh")).toBe("zh");
    expect(resolveDemoLocale("", "")).toBe("en");
  });
});
