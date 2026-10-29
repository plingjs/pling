import Vue, { type CreateElement } from "vue";
import { createPling, type AgentSetup, type VanillaDock, type Vue2Pling } from "@plingjs/vue2";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";

export interface SetupOptions {
  locale?: DemoLocale;
  agent?: AgentSetup;
  presence?: boolean;
  onWarn?: (message: string) => void;
}

export interface SetupApp {
  pling: Vue2Pling;
  dock: VanillaDock | null;
  vm: Vue;
  destroy(): void;
}

export function mountSetup(root: HTMLElement, options: SetupOptions = {}): SetupApp {
  const locale = options.locale ?? resolveDemoLocale();
  const copy = copyFor(locale);
  document.documentElement.lang = plingLocale(locale);
  document.title = copy.documentTitle;

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
  Vue.use(pling.plugin);

  const mountNode = document.createElement("div");
  root.replaceChildren(mountNode);
  let dock: VanillaDock | null = null;
  const vm = new Vue({
    mounted() {
      dock = pling.dock({ title: copy.dockTitle, quick: [...copy.quick] });
    },
    beforeDestroy() {
      dock?.destroy();
      dock = null;
    },
    render(this: Vue, h: CreateElement) {
      return h("main", { class: "page" }, [
        h("section", { class: "setup" }, [
          h("header", { class: "setup__header" }, [
            h("div", [
              h("p", { class: "setup__eyebrow" }, copy.eyebrow),
              h("h1", copy.heading),
            ]),
            h("span", { class: "setup__count" }, copy.actionCount),
          ]),
          h("p", { class: "setup__lead" }, copy.lead),
          h("ol", { class: "checks" }, copy.checks.map((label, index) => h("li", {
            key: label,
            class: index < 3 ? undefined : "is-pending",
          }, [
            h("span", { class: "checks__mark", attrs: { "aria-hidden": "true" } }, index < 3 ? "✓" : "→"),
            h("span", label),
          ]))),
          h("aside", { class: "next" }, [h("strong", copy.nextLabel), ` ${copy.nextText}`]),
        ]),
      ]);
    },
  }).$mount(mountNode) as Vue;

  return {
    pling,
    vm,
    get dock() { return dock; },
    destroy() {
      dock?.destroy();
      dock = null;
      vm.$destroy();
      pling.destroy();
      root.replaceChildren();
    },
  };
}
