import { createPling, type AgentSetup, type VanillaDock, type VanillaPling } from "@plingjs/vanilla";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";

export interface SetupAppOptions {
  locale?: DemoLocale;
  agent?: AgentSetup;
  presence?: boolean;
  onWarn?: (message: string) => void;
}

export interface SetupApp {
  pling: VanillaPling;
  dock: VanillaDock;
  destroy(): void;
}

export function mountSetup(root: HTMLElement, options: SetupAppOptions = {}): SetupApp {
  const locale = options.locale ?? resolveDemoLocale();
  const copy = copyFor(locale);
  document.documentElement.lang = plingLocale(locale);
  document.title = copy.documentTitle;

  root.innerHTML = `
    <main class="page" data-locale="${locale}">
      <section class="setup">
        <header class="setup__header">
          <div>
            <p class="setup__eyebrow">${copy.eyebrow}</p>
            <h1>${copy.heading}</h1>
          </div>
          <span class="setup__count">${copy.actionCount}</span>
        </header>
        <p class="setup__lead">${copy.lead}</p>
        <ol class="checks">
          ${copy.checks.map((label, index) => `
            <li class="${index < 3 ? "" : "is-pending"}">
              <span class="checks__mark" aria-hidden="true">${index < 3 ? "✓" : "→"}</span>
              <span>${label}</span>
            </li>`).join("")}
        </ol>
        <aside class="next"><strong>${copy.nextLabel}</strong> ${copy.nextText}</aside>
      </section>
    </main>
  `;

  const pling = createPling({
    ui: { locale: plingLocale(locale) },
    presence: options.presence ?? true,
    onWarn: options.onWarn ?? ((message) => console.warn(message)),
    agent: options.agent ?? {
      config: {
        systemPrompt: copy.systemPrompt,
        limits: { maxTurns: 100 },
      },
    },
  });

  const dock = pling.dock({ title: copy.dockTitle, quick: copy.quick });

  return {
    pling,
    dock,
    destroy() {
      pling.destroy();
      root.replaceChildren();
    },
  };
}
