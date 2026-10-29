import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { mountSetup, type SetupApp } from "../src/app";
import { DEMO_LOCALES, copyFor, normalizeDemoLocale, type DemoLocale } from "../src/copy";

let host: HTMLDivElement;
let app: SetupApp | null = null;

const requestedLocale = normalizeDemoLocale(import.meta.env.VITE_DEMO_LOCALE);
const locales: readonly DemoLocale[] = requestedLocale ? [requestedLocale] : DEMO_LOCALES;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  app?.destroy();
  app = null;
  host.remove();
  document.body.innerHTML = "";
});

describe.each(locales)("J-02 · vanilla first mount (%s)", (locale) => {
  const copy = copyFor(locale);

  it("mounts the assistant over existing HTML without exposing page actions", () => {
    const warnings: string[] = [];
    app = mountSetup(host, {
      locale,
      presence: false,
      onWarn: (message) => warnings.push(message),
      agent: { llm: createReplayLlm([]) },
    });

    expect(host.querySelector("h1")?.textContent).toBe(copy.heading);
    expect(document.querySelector(".pling-dock__launcher")).not.toBeNull();
    expect(app.pling.registry.snapshot().actions).toEqual([]);
    expect(app.pling.registry.snapshot().records).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("keeps the host DOM as the source of truth", () => {
    app = mountSetup(host, { locale, presence: false, onWarn: () => {}, agent: { llm: createReplayLlm([]) } });

    expect(host.querySelectorAll(".checks li")).toHaveLength(4);
    expect(host.querySelector(".checks li.is-pending")?.textContent).toContain(copy.checks[3]!);
    expect(host.querySelector("main")?.getAttribute("data-locale")).toBe(locale);
  });
});
