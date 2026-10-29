import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const exact: Record<string, string> = {
  "/guide/": "/start/",
  "/guide/introduction": "/about/mission/what-pling-is-and-is-not",
  "/guide/quick-start": "/vue/quick-start-add-pling-to-a-vue-app",
  "/guide/installation": "/vue/installation-and-model-configuration",
  "/guide/migration": "/vue/migrating-an-existing-vue-app",
  "/guide/concepts": "/concepts/",
  "/guide/react": "/react/",
  "/guide/vanilla": "/vanilla/",
  "/guide/inline-agent": "/operations/add-the-assistant-ui",
  "/guide/node-gateway": "/operations/connect-a-model-gateway",
  "/guide/theme-i18n": "/operations/theme-locale-and-accessibility",
  "/guide/external-agents": "/surface/surface-basics-describe-and-invoke",
  "/guide/offscreen": "/vue/long-lists-scrolling-and-offscreen-actions",
  "/guide/flows": "/vue/flows-async-work-and-recovery",
  "/guide/handoff": "/vue/confirmation-and-human-handoff",
  "/guide/trust": "/concepts/approval-and-human-handoff",
  "/guide/consistency": "/about/mission/from-single-site-bridge-to-open-protocol",
  "/guide/mixed-framework": "/about/mission/from-single-site-bridge-to-open-protocol",
  "/guide/projection": "/concepts/projection-shadow-dom-and-iframes",
  "/guide/derivation": "/vue/quick-start-add-pling-to-a-vue-app",
  "/guide/coverage": "/vue/quick-start-add-pling-to-a-vue-app",
  "/guide/expectations": "/concepts/execution-lifecycle",
  "/guide/timing": "/concepts/execution-lifecycle",
  "/guide/params": "/vue/actions-with-input-and-verified-results",
  "/guide/sequences": "/vue/flows-async-work-and-recovery",
  "/guide/resume": "/vue/flows-async-work-and-recovery",
  "/guide/presence": "/operations/add-the-assistant-ui",
  "/guide/sensitive": "/vue/sensitive-data",
  "/guide/store-state": "/vue/state-exposure",
  "/guide/function-tools": "/vue/function-level-tools",
  "/guide/hooks": "/reference/core-declarations-actions-records-regions-state",
  "/guide/feedback": "/vue/inspect-one-agent-run",
  "/guide/regions": "/vue/regions-visibility-and-overlays",
  "/guide/page-identity": "/vue/page-identity-and-routing",
  "/guide/mpa-continuity": "/vue/page-identity-and-routing",
  "/guide/cross-tab-continuity": "/reference/continuity-and-projection",
  "/guide/production-deployment": "/operations/deploy-to-production",
  "/guide/release": "/releases/",
  "/guide/evaluation": "/reference/surface-conformance-and-interoperability",
  "/vue/add-pling-to-an-existing-vue-app": "/vue/migrating-an-existing-vue-app",
  "/vue/assistant-surfaces-theme-and-i18n": "/vue/assistant-surfaces-layout-and-task-entry-points",
  "/vue/confirmation-human-handoff-and-guidance": "/vue/confirmation-and-human-handoff",
  "/vue/connect-vue-to-the-model-gateway": "/vue/model-gateway-and-authentication",
  "/vue/expose-selected-capabilities-to-external-agents": "/vue/exposing-selected-capabilities-to-external-agents",
  "/vue/flows-and-sequences": "/vue/flows-async-work-and-recovery",
  "/vue/install-model-configuration-and-first-render": "/vue/installation-and-model-configuration",
  "/zh/vue/install-model-configuration-and-first-render": "/zh/vue/installation-and-model-configuration",
  "/vue/your-first-declared-action": "/vue/inspect-one-agent-run",
  "/zh/vue/your-first-declared-action": "/zh/vue/inspect-one-agent-run",
  "/vue/nuxt-and-ssr-considerations": "/vue/nuxt-and-ssr",
  "/vue/production-checklist-for-vue-apps": "/vue/production-release",
  "/vue/records-and-row-actions": "/vue/records-row-actions-and-change-evidence",
  "/vue/records-row-actions-and-long-lists": "/vue/records-row-actions-and-change-evidence",
  "/vue/regions-dialogs-and-scopes": "/vue/regions-visibility-and-overlays",
  "/vue/routing-mpa-and-continuity": "/vue/page-identity-and-routing",
  "/vue/routing-page-identity-mpa-and-continuity": "/vue/page-identity-and-routing",
  "/vue/test-debug-and-evaluate-vue-capabilities": "/vue/testing-coverage-and-evaluation",
  "/react/your-first-declared-action": "/react/inspect-one-agent-run",
  "/zh/react/your-first-declared-action": "/zh/react/inspect-one-agent-run",
  "/react/records-and-row-actions": "/react/records-row-actions-and-change-evidence",
  "/zh/react/records-and-row-actions": "/zh/react/records-row-actions-and-change-evidence",
  "/react/regions-dialogs-and-scopes": "/react/regions-visibility-and-overlays",
  "/zh/react/regions-dialogs-and-scopes": "/zh/react/regions-visibility-and-overlays",
  "/react/flows-and-sequences": "/react/flows-async-and-recovery",
  "/zh/react/flows-and-sequences": "/zh/react/flows-async-and-recovery",
  "/react/mount-the-assistant-ui": "/react/assistant-surfaces-layout-and-task-entry-points",
  "/zh/react/mount-the-assistant-ui": "/zh/react/assistant-surfaces-layout-and-task-entry-points",
  "/react/router-and-continuity": "/react/page-identity-and-routing",
  "/zh/react/router-and-continuity": "/zh/react/page-identity-and-routing",
  "/react/connect-react-to-the-model-gateway": "/react/model-gateway-and-authentication",
  "/zh/react/connect-react-to-the-model-gateway": "/zh/react/model-gateway-and-authentication",
  "/react/test-and-debug-react-capabilities": "/react/testing-coverage-and-evaluation",
  "/zh/react/test-and-debug-react-capabilities": "/zh/react/testing-coverage-and-evaluation",
  "/react/production-checklist-for-react-apps": "/react/production-release",
  "/zh/react/production-checklist-for-react-apps": "/zh/react/production-release",
  "/react/next-js-and-ssr-considerations": "/react/nextjs-and-ssr",
  "/zh/react/next-js-and-ssr-considerations": "/zh/react/nextjs-and-ssr",
  "/react/add-pling-to-an-existing-react-app": "/react/migrating-an-existing-react-app",
  "/zh/react/add-pling-to-an-existing-react-app": "/zh/react/migrating-an-existing-react-app",
  "/react/expose-selected-capabilities-to-external-agents": "/react/expose-capabilities-to-external-agents",
  "/zh/react/expose-selected-capabilities-to-external-agents": "/zh/react/expose-capabilities-to-external-agents",
  "/reference/approval": "/concepts/approval-and-human-handoff",
  "/reference/chat-ui": "/reference/ui-messages-theme-locale",
  "/reference/coverage": "/reference/core-declarations-actions-records-regions-state",
  "/reference/cross-tab-continuity": "/reference/continuity-and-projection",
  "/reference/delegation": "/reference/delegation-and-trust-boundaries",
  "/reference/evaluation": "/reference/surface-conformance-and-interoperability",
  "/reference/feedback": "/reference/core-declarations-actions-records-regions-state",
  "/reference/function-tools": "/reference/core-declarations-actions-records-regions-state",
  "/reference/handoff": "/concepts/approval-and-human-handoff",
  "/reference/hooks": "/reference/core-declarations-actions-records-regions-state",
  "/reference/inline": "/reference/ui-messages-theme-locale",
  "/reference/mpa-continuity": "/reference/continuity-and-projection",
  "/reference/offscreen": "/reference/core-declarations-actions-records-regions-state",
  "/reference/page-identity": "/reference/core-declarations-actions-records-regions-state",
  "/reference/presence": "/reference/ui-messages-theme-locale",
  "/reference/projection": "/reference/continuity-and-projection",
  "/reference/react": "/reference/react-adapter",
  "/reference/sensitive": "/reference/core-declarations-actions-records-regions-state",
  "/reference/store-state": "/reference/core-declarations-actions-records-regions-state",
  "/reference/surface": "/reference/surface-protocol",
  "/reference/ui": "/reference/ui-messages-theme-locale",
  "/reference/vanilla": "/reference/vanilla-jquery-adapter",
  "/cookbook/": "/recipes/",
  "/design/": "/about/mission/from-single-site-bridge-to-open-protocol",
  "/evidence/": "/security/",
  "/zh/evidence/": "/zh/security/",
};

const prefixes: Array<[string, string]> = [
  ["/guide/", "/start/"],
  ["/cookbook/", "/recipes/"],
  ["/design/", "/about/mission/from-single-site-bridge-to-open-protocol"],
  ["/evidence/", "/security/"],
  ["/zh/evidence/", "/zh/security/"],
];

function targetFor(pathname: string): string | undefined {
  const clean = pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "").replace(/\/+$/, "/");
  if (exact[clean]) return exact[clean];
  for (const [from, to] of prefixes) {
    if (clean.startsWith(from)) return to;
  }
  return undefined;
}

export function legacyRedirectsPlugin() {
  let outDir = "";
  return {
    name: "pling-legacy-redirects",
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server: { middlewares: { use(fn: (req: { url?: string }, res: { statusCode: number; setHeader(name: string, value: string): void; end(): void }, next: () => void) => void): void } }) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, "http://localhost");
        const target = targetFor(url.pathname);
        if (!target) return next();
        res.statusCode = 301;
        res.setHeader("Location", `${target}${url.search}`);
        res.end();
      });
    },
    closeBundle() {
      if (!outDir) return;
      const rules = [
        ...Object.entries(exact).map(([from, to]) => `${from} ${to} 301`),
        ...prefixes.map(([from, to]) => `${from}* ${to} 301`),
      ];
      writeFileSync(join(outDir, "_redirects"), `${[...new Set(rules)].join("\n")}\n`, "utf8");
    },
  };
}
