#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { apiPageLinks } from "./generate-api-reference.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outlinePath = join(root, "content", "TUTORIAL-OUTLINE.md");
const websiteRoot = join(root, "website");
const generatedDir = join(websiteRoot, ".vitepress", "generated");
const SITE_ORIGIN = "https://plingjs.dev";

const SECTION_META = {
  M: { en: "Mission", zh: "使命与定位", prefix: "/about/mission/" },
  C: { en: "Shared concepts", zh: "共享概念", prefix: "/concepts/" },
  OPS: { en: "Operations", zh: "跨框架运维", prefix: "/operations/" },
  V3: { en: "Vue 3", zh: "Vue 3", prefix: "/vue/" },
  R: { en: "React", zh: "React", prefix: "/react/" },
  J: { en: "Vanilla / jQuery", zh: "原生 JS / jQuery", prefix: "/vanilla/" },
  V2: { en: "Vue 2 Legacy", zh: "Vue 2 Legacy", prefix: "/vue2/" },
  S: { en: "Agent Surface", zh: "Agent Surface", prefix: "/surface/" },
  SPEC: { en: "Specification", zh: "协议规范", prefix: "/spec/0.1/" },
  RCP: { en: "Recipes", zh: "实战方案", prefix: "/recipes/" },
  REF: { en: "Reference", zh: "参考", prefix: "/reference/" },
  TS: { en: "Troubleshooting", zh: "排障", prefix: "/troubleshooting/" },
  EV: { en: "Evidence", zh: "证据", prefix: "/evidence/" },
  SITE: { en: "Project and trust", zh: "项目与信任", prefix: "/" },
};

const STATUS_META = {
  verified: { en: "Verified", zh: "已核对", mark: "✓", container: "tip" },
  reviewed: { en: "Reviewed", zh: "已评审", mark: "✓", container: "tip" },
  drafted: { en: "Draft", zh: "草稿", mark: "◇", container: "warning" },
  draft: { en: "Draft", zh: "草稿", mark: "◇", container: "warning" },
  planned: { en: "Planned", zh: "规划中", mark: "○", container: "info" },
  blocked: { en: "Blocked", zh: "已阻塞", mark: "×", container: "danger" },
  hidden: { en: "Hidden", zh: "暂不公开", mark: "–", container: "danger" },
};

const ROUTE_OVERRIDES = {
  "SITE-01": "/", "SITE-02": "/start/", "SITE-03": "/examples/", "SITE-04": "/recipes/",
  "SITE-05": "/security/", "SITE-06": "/releases/", "SITE-07": "/governance/", "SITE-08": "/license/",
  "SITE-09": "/llms.txt", "V3-01": "/vue/", "V3-03": "/vue/quick-start-add-pling-to-a-vue-app", "R-01": "/react/", "J-01": "/vanilla/", "V2-01": "/vue2/", "S-01": "/surface/",
};

const DRAFT_FILES = {
  "M-01": { en: "content/tutorial/M-01-why-a-capability-layer.en.md", zh: "content/tutorial/M-01-why-a-capability-layer.zh.md" },
  "M-02": { en: "content/tutorial/M-02-what-pling-is-and-is-not.en.md", zh: "content/tutorial/M-02-what-pling-is-and-is-not.zh.md" },
  "M-03": { en: "content/tutorial/M-03-trust-authority-and-audit.en.md", zh: "content/tutorial/M-03-trust-authority-and-audit.zh.md" },
  "M-04": { en: "content/tutorial/M-04-from-single-site-bridge-to-open-protocol.en.md", zh: "content/tutorial/M-04-from-single-site-bridge-to-open-protocol.zh.md" },
  "S-01": { en: "content/tutorial/S-01-what-is-agent-surface.en.md", zh: "content/tutorial/S-01-what-is-agent-surface.zh.md" },
  "S-02": { en: "content/tutorial/S-02-designing-safe-capabilities.en.md", zh: "content/tutorial/S-02-designing-safe-capabilities.zh.md" },
  "S-03": { en: "content/tutorial/S-03-context-and-sensitive-data.en.md", zh: "content/tutorial/S-03-context-and-sensitive-data.zh.md" },
  "S-04": { en: "content/tutorial/S-04-identity-consent-and-delegation.en.md", zh: "content/tutorial/S-04-identity-consent-and-delegation.zh.md" },
  "S-05": { en: "content/tutorial/S-05-surface-basics-describe-and-invoke.en.md", zh: "content/tutorial/S-05-surface-basics-describe-and-invoke.zh.md" },
  "S-06": { en: "content/tutorial/S-06-transports-and-adapters.en.md", zh: "content/tutorial/S-06-transports-and-adapters.zh.md" },
  "S-07": { en: "content/tutorial/S-07-build-an-external-agent-client.en.md", zh: "content/tutorial/S-07-build-an-external-agent-client.zh.md" },
  "S-08": { en: "content/tutorial/S-08-deploy-a-surface-gateway.en.md", zh: "content/tutorial/S-08-deploy-a-surface-gateway.zh.md" },
  "S-09": { en: "content/tutorial/S-09-revoke-access-and-audit-actions.en.md", zh: "content/tutorial/S-09-revoke-access-and-audit-actions.zh.md" },
  "S-10": { en: "content/tutorial/S-10-conformance-and-interoperability.en.md", zh: "content/tutorial/S-10-conformance-and-interoperability.zh.md" },
  "S-11": { en: "content/tutorial/S-11-threat-model-and-legal-boundaries.en.md", zh: "content/tutorial/S-11-threat-model-and-legal-boundaries.zh.md" },
  "S-12": { en: "content/tutorial/S-12-versioning-and-governance.en.md", zh: "content/tutorial/S-12-versioning-and-governance.zh.md" },
  "C-01": { en: "content/tutorial/C-01-how-pling-works.en.md", zh: "content/tutorial/C-01-how-pling-works.zh.md" },
  "C-02": { en: "content/tutorial/C-02-the-page-capability-model.en.md", zh: "content/tutorial/C-02-the-page-capability-model.zh.md" },
  "C-03": { en: "content/tutorial/C-03-what-the-agent-can-see.en.md", zh: "content/tutorial/C-03-what-the-agent-can-see.zh.md" },
  "C-04": { en: "content/tutorial/C-04-execution-lifecycle.en.md", zh: "content/tutorial/C-04-execution-lifecycle.zh.md" },
  "C-05": { en: "content/tutorial/C-05-approval-and-human-handoff.en.md", zh: "content/tutorial/C-05-approval-and-human-handoff.zh.md" },
  "C-06": { en: "content/tutorial/C-06-sensitive-data-and-trust-boundaries.en.md", zh: "content/tutorial/C-06-sensitive-data-and-trust-boundaries.zh.md" },
  "C-07": { en: "content/tutorial/C-07-how-one-agent-run-works.en.md", zh: "content/tutorial/C-07-how-one-agent-run-works.zh.md" },
  "C-08": { en: "content/tutorial/C-08-connecting-external-agents.en.md", zh: "content/tutorial/C-08-connecting-external-agents.zh.md" },
  "C-09": { en: "content/tutorial/C-09-model-access-and-trust-boundaries.en.md", zh: "content/tutorial/C-09-model-access-and-trust-boundaries.zh.md" },
  "C-10": { en: "content/tutorial/C-10-diagnostics-and-observability.en.md", zh: "content/tutorial/C-10-diagnostics-and-observability.zh.md" },
  "C-11": { en: "content/tutorial/C-11-failure-model-and-error-codes.en.md", zh: "content/tutorial/C-11-failure-model-and-error-codes.zh.md" },
  "C-12": { en: "content/tutorial/C-12-versioning-and-compatibility.en.md", zh: "content/tutorial/C-12-versioning-and-compatibility.zh.md" },
  "C-13": { en: "content/tutorial/C-13-task-continuity-across-pages-and-tabs.en.md", zh: "content/tutorial/C-13-task-continuity-across-pages-and-tabs.zh.md" },
  "C-14": { en: "content/tutorial/C-14-projection-shadow-dom-and-iframes.en.md", zh: "content/tutorial/C-14-projection-shadow-dom-and-iframes.zh.md" },
  "OPS-01": { en: "content/tutorial/OPS-01-add-the-assistant-ui.en.md", zh: "content/tutorial/OPS-01-add-the-assistant-ui.zh.md" },
  "OPS-02": { en: "content/tutorial/OPS-02-theme-locale-and-accessibility.en.md", zh: "content/tutorial/OPS-02-theme-locale-and-accessibility.zh.md" },
  "OPS-03": { en: "content/tutorial/OPS-03-connect-a-model-gateway.en.md", zh: "content/tutorial/OPS-03-connect-a-model-gateway.zh.md" },
  "OPS-04": { en: "content/tutorial/OPS-04-deploy-to-production.en.md", zh: "content/tutorial/OPS-04-deploy-to-production.zh.md" },
  "OPS-05": { en: "content/tutorial/OPS-05-test-and-debug-capabilities.en.md", zh: "content/tutorial/OPS-05-test-and-debug-capabilities.zh.md" },
  "OPS-06": { en: "content/tutorial/OPS-06-expose-capabilities-to-external-agents.en.md", zh: "content/tutorial/OPS-06-expose-capabilities-to-external-agents.zh.md" },
  "OPS-07": { en: "content/tutorial/OPS-07-upgrade-pling-safely.en.md", zh: "content/tutorial/OPS-07-upgrade-pling-safely.zh.md" },
  "V3-01": { en: "content/tutorial/V3-01-vue-3-learning-path.en.md", zh: "content/tutorial/V3-01-vue-3-learning-path.zh.md" },
  "V3-02": { en: "content/tutorial/V3-02-install-model-configuration-and-first-render.en.md", zh: "content/tutorial/V3-02-install-model-configuration-and-first-render.zh.md" },
  "V3-03": { en: "content/tutorial/V3-03-quick-start-add-pling-to-a-vue-app.en.md", zh: "content/tutorial/V3-03-quick-start-add-pling-to-a-vue-app.zh.md" },
  "V3-04": { en: "content/tutorial/V3-04-your-first-declared-action.en.md", zh: "content/tutorial/V3-04-your-first-declared-action.zh.md" },
  "V3-05": { en: "content/tutorial/V3-05-actions-with-input-and-verified-results.en.md", zh: "content/tutorial/V3-05-actions-with-input-and-verified-results.zh.md" },
  "V3-06": { en: "content/tutorial/V3-06-real-controls-and-custom-components.en.md", zh: "content/tutorial/V3-06-real-controls-and-custom-components.zh.md" },
  "V3-07": { en: "content/tutorial/V3-07-records-row-actions-and-change-evidence.en.md", zh: "content/tutorial/V3-07-records-row-actions-and-change-evidence.zh.md" },
  "V3-08": { en: "content/tutorial/V3-08-function-level-tools.en.md", zh: "content/tutorial/V3-08-function-level-tools.zh.md" },
  "V3-09": { en: "content/tutorial/V3-09-regions-visibility-and-overlays.en.md", zh: "content/tutorial/V3-09-regions-visibility-and-overlays.zh.md" },
  "V3-10": { en: "content/tutorial/V3-10-long-lists-scrolling-and-offscreen-actions.en.md", zh: "content/tutorial/V3-10-long-lists-scrolling-and-offscreen-actions.zh.md" },
  "V3-11": { en: "content/tutorial/V3-11-state-exposure.en.md", zh: "content/tutorial/V3-11-state-exposure.zh.md" },
  "J-01": { en: "content/tutorial/J-01-vanilla-and-jquery-overview.en.md", zh: "content/tutorial/J-01-vanilla-and-jquery-overview.zh.md" },
  "J-02": { en: "content/tutorial/J-02-script-setup-and-first-mount.en.md", zh: "content/tutorial/J-02-script-setup-and-first-mount.zh.md" },
  "J-03": { en: "content/tutorial/J-03-quick-start-add-pling-to-a-vanilla-page.en.md", zh: "content/tutorial/J-03-quick-start-add-pling-to-a-vanilla-page.zh.md" },
  "J-04": { en: "content/tutorial/J-04-declarative-actions-with-data-attributes.en.md", zh: "content/tutorial/J-04-declarative-actions-with-data-attributes.zh.md" },
  "J-05": { en: "content/tutorial/J-05-imperative-actions-for-dynamic-dom.en.md", zh: "content/tutorial/J-05-imperative-actions-for-dynamic-dom.zh.md" },
  "J-06": { en: "content/tutorial/J-06-records-and-tables.en.md", zh: "content/tutorial/J-06-records-and-tables.zh.md" },
  "J-07": { en: "content/tutorial/J-07-forms-async-updates-and-dialogs.en.md", zh: "content/tutorial/J-07-forms-async-updates-and-dialogs.zh.md" },
  "J-08": { en: "content/tutorial/J-08-mount-the-assistant-ui.en.md", zh: "content/tutorial/J-08-mount-the-assistant-ui.zh.md" },
  "J-09": { en: "content/tutorial/J-09-protect-sensitive-data-and-destructive-actions.en.md", zh: "content/tutorial/J-09-protect-sensitive-data-and-destructive-actions.zh.md" },
  "J-10": { en: "content/tutorial/J-10-connect-vanilla-pages-to-the-model-gateway.en.md", zh: "content/tutorial/J-10-connect-vanilla-pages-to-the-model-gateway.zh.md" },
  "J-11": { en: "content/tutorial/J-11-mpa-and-task-continuity.en.md", zh: "content/tutorial/J-11-mpa-and-task-continuity.zh.md" },
  "J-12": { en: "content/tutorial/J-12-test-and-debug-vanilla-capabilities.en.md", zh: "content/tutorial/J-12-test-and-debug-vanilla-capabilities.zh.md" },
  "J-13": { en: "content/tutorial/J-13-add-pling-to-an-existing-jquery-app.en.md", zh: "content/tutorial/J-13-add-pling-to-an-existing-jquery-app.zh.md" },
  "J-14": { en: "content/tutorial/J-14-expose-selected-capabilities-to-external-agents.en.md", zh: "content/tutorial/J-14-expose-selected-capabilities-to-external-agents.zh.md" },
  "V2-01": { en: "content/tutorial/V2-01-vue-2-support-statement.en.md", zh: "content/tutorial/V2-01-vue-2-support-statement.zh.md" },
  "V2-02": { en: "content/tutorial/V2-02-install-and-first-mount.en.md", zh: "content/tutorial/V2-02-install-and-first-mount.zh.md" },
  "V2-03": { en: "content/tutorial/V2-03-quick-start-a-complete-todo-agent.en.md", zh: "content/tutorial/V2-03-quick-start-a-complete-todo-agent.zh.md" },
  "V2-04": { en: "content/tutorial/V2-04-directive-based-actions.en.md", zh: "content/tutorial/V2-04-directive-based-actions.zh.md" },
  "V2-05": { en: "content/tutorial/V2-05-records-and-dialogs.en.md", zh: "content/tutorial/V2-05-records-and-dialogs.zh.md" },
  "V2-06": { en: "content/tutorial/V2-06-mount-the-assistant-ui.en.md", zh: "content/tutorial/V2-06-mount-the-assistant-ui.zh.md" },
  "V2-07": { en: "content/tutorial/V2-07-test-and-deploy-a-vue-2-app.en.md", zh: "content/tutorial/V2-07-test-and-deploy-a-vue-2-app.zh.md" },
  "V2-08": { en: "content/tutorial/V2-08-migrating-from-vue-2-to-vue-3.en.md", zh: "content/tutorial/V2-08-migrating-from-vue-2-to-vue-3.zh.md" },
  "R-01": { en: "content/tutorial/R-01-react-learning-path.en.md", zh: "content/tutorial/R-01-react-learning-path.zh.md" },
  "R-02": { en: "content/tutorial/R-02-install-provider-and-mount.en.md", zh: "content/tutorial/R-02-install-provider-and-mount.zh.md" },
  "R-03": { en: "content/tutorial/R-03-quick-start-add-pling-to-a-react-app.en.md", zh: "content/tutorial/R-03-quick-start-add-pling-to-a-react-app.zh.md" },
  "R-04": { en: "content/tutorial/R-04-inspect-one-agent-run.en.md", zh: "content/tutorial/R-04-inspect-one-agent-run.zh.md" },
  "R-05": { en: "content/tutorial/R-05-actions-with-input-and-verified-results.en.md", zh: "content/tutorial/R-05-actions-with-input-and-verified-results.zh.md" },
  "R-06": { en: "content/tutorial/R-06-real-controls-and-custom-components.en.md", zh: "content/tutorial/R-06-real-controls-and-custom-components.zh.md" },
  "R-07": { en: "content/tutorial/R-07-records-row-actions-and-change-evidence.en.md", zh: "content/tutorial/R-07-records-row-actions-and-change-evidence.zh.md" },
  "R-08": { en: "content/tutorial/R-08-function-level-tools.en.md", zh: "content/tutorial/R-08-function-level-tools.zh.md" },
  "R-09": { en: "content/tutorial/R-09-regions-visibility-and-overlays.en.md", zh: "content/tutorial/R-09-regions-visibility-and-overlays.zh.md" },
  "R-10": { en: "content/tutorial/R-10-long-lists-scrolling-and-offscreen-actions.en.md", zh: "content/tutorial/R-10-long-lists-scrolling-and-offscreen-actions.zh.md" },
  "R-11": { en: "content/tutorial/R-11-state-exposure.en.md", zh: "content/tutorial/R-11-state-exposure.zh.md" },
  "R-12": { en: "content/tutorial/R-12-page-identity-and-routing.en.md", zh: "content/tutorial/R-12-page-identity-and-routing.zh.md" },
  "R-13": { en: "content/tutorial/R-13-assistant-surfaces-layout-and-task-entry-points.en.md", zh: "content/tutorial/R-13-assistant-surfaces-layout-and-task-entry-points.zh.md" },
  "R-14": { en: "content/tutorial/R-14-page-feedback-target-highlighting-and-guidance.en.md", zh: "content/tutorial/R-14-page-feedback-target-highlighting-and-guidance.zh.md" },
  "R-15": { en: "content/tutorial/R-15-confirmation-and-human-handoff.en.md", zh: "content/tutorial/R-15-confirmation-and-human-handoff.zh.md" },
  "R-16": { en: "content/tutorial/R-16-flows-async-work-and-recovery.en.md", zh: "content/tutorial/R-16-flows-async-work-and-recovery.zh.md" },
  "R-17": { en: "content/tutorial/R-17-runtime-limits-observability-and-error-codes.en.md", zh: "content/tutorial/R-17-runtime-limits-observability-and-error-codes.zh.md" },
  "R-18": { en: "content/tutorial/R-18-sensitive-data.en.md", zh: "content/tutorial/R-18-sensitive-data.zh.md" },
  "R-19": { en: "content/tutorial/R-19-model-gateway-and-authentication.en.md", zh: "content/tutorial/R-19-model-gateway-and-authentication.zh.md" },
  "R-20": { en: "content/tutorial/R-20-testing-coverage-and-evaluation.en.md", zh: "content/tutorial/R-20-testing-coverage-and-evaluation.zh.md" },
  "R-21": { en: "content/tutorial/R-21-production-release.en.md", zh: "content/tutorial/R-21-production-release.zh.md" },
  "R-22": { en: "content/tutorial/R-22-migrating-an-existing-react-app.en.md", zh: "content/tutorial/R-22-migrating-an-existing-react-app.zh.md" },
  "R-23": { en: "content/tutorial/R-23-exposing-selected-capabilities-to-external-agents.en.md", zh: "content/tutorial/R-23-exposing-selected-capabilities-to-external-agents.zh.md" },
  "R-24": { en: "content/tutorial/R-24-next-js-and-ssr.en.md", zh: "content/tutorial/R-24-next-js-and-ssr.zh.md" },
  "EV-01": { en: "content/tutorial/EV-01-benchmark-methodology-and-reproducibility.en.md", zh: "content/tutorial/EV-01-benchmark-methodology-and-reproducibility.zh.md" },
  "EV-02": { en: "content/tutorial/EV-02-surface-vs-dom-playwright-and-vision.en.md", zh: "content/tutorial/EV-02-surface-vs-dom-playwright-and-vision.zh.md" },
  "EV-03": { en: "content/tutorial/EV-03-conformance-and-interoperability-matrix.en.md", zh: "content/tutorial/EV-03-conformance-and-interoperability-matrix.zh.md" },
  "EV-04": { en: "content/tutorial/EV-04-failure-catalog-and-known-limitations.en.md", zh: "content/tutorial/EV-04-failure-catalog-and-known-limitations.zh.md" },
  "EV-05": { en: "content/tutorial/EV-05-adoption-evidence-and-case-studies.en.md", zh: "content/tutorial/EV-05-adoption-evidence-and-case-studies.zh.md" },
  "EV-06": { en: "content/tutorial/EV-06-security-audits-and-incident-history.en.md", zh: "content/tutorial/EV-06-security-audits-and-incident-history.zh.md" },
  "REF-01": { en: "content/tutorial/REF-01-core-declarations-actions-records-regions-state.en.md", zh: "content/tutorial/REF-01-core-declarations-actions-records-regions-state.zh.md" },
  "REF-02": { en: "content/tutorial/REF-02-agent-runtime-sessions-context-limits.en.md", zh: "content/tutorial/REF-02-agent-runtime-sessions-context-limits.zh.md" },
  "REF-03": { en: "content/tutorial/REF-03-ui-messages-theme-locale.en.md", zh: "content/tutorial/REF-03-ui-messages-theme-locale.zh.md" },
  "REF-04": { en: "content/tutorial/REF-04-surface-protocol.en.md", zh: "content/tutorial/REF-04-surface-protocol.zh.md" },
  "REF-05": { en: "content/tutorial/REF-05-delegation-and-trust-boundaries.en.md", zh: "content/tutorial/REF-05-delegation-and-trust-boundaries.zh.md" },
  "REF-06": { en: "content/tutorial/REF-06-node-gateway.en.md", zh: "content/tutorial/REF-06-node-gateway.zh.md" },
  "REF-07": { en: "content/tutorial/REF-07-vue-3-adapter.en.md", zh: "content/tutorial/REF-07-vue-3-adapter.zh.md" },
  "REF-08": { en: "content/tutorial/REF-08-react-adapter.en.md", zh: "content/tutorial/REF-08-react-adapter.zh.md" },
  "REF-09": { en: "content/tutorial/REF-09-vanilla-jquery-adapter.en.md", zh: "content/tutorial/REF-09-vanilla-jquery-adapter.zh.md" },
  "REF-10": { en: "content/tutorial/REF-10-vue-2-adapter.en.md", zh: "content/tutorial/REF-10-vue-2-adapter.zh.md" },
  "REF-11": { en: "content/tutorial/REF-11-error-codes-and-diagnostics.en.md", zh: "content/tutorial/REF-11-error-codes-and-diagnostics.zh.md" },
  "REF-12": { en: "content/tutorial/REF-12-continuity-and-projection.en.md", zh: "content/tutorial/REF-12-continuity-and-projection.zh.md" },
  "REF-13": { en: "content/tutorial/REF-13-surface-conformance-and-interoperability.en.md", zh: "content/tutorial/REF-13-surface-conformance-and-interoperability.zh.md" },
  "REF-14": { en: "content/tutorial/REF-14-protocol-schemas-and-registries.en.md", zh: "content/tutorial/REF-14-protocol-schemas-and-registries.zh.md" },
  "RCP-02": { en: "content/tutorial/RCP-02-table-rows-and-batch-actions.en.md", zh: "content/tutorial/RCP-02-table-rows-and-batch-actions.zh.md" },
  "RCP-03": { en: "content/tutorial/RCP-03-form-fill-validation-and-submit.en.md", zh: "content/tutorial/RCP-03-form-fill-validation-and-submit.zh.md" },
  "RCP-05": { en: "content/tutorial/RCP-05-dangerous-actions-and-confirmation.en.md", zh: "content/tutorial/RCP-05-dangerous-actions-and-confirmation.zh.md" },
  "RCP-07": { en: "content/tutorial/RCP-07-search-filters-and-long-lists.en.md", zh: "content/tutorial/RCP-07-search-filters-and-long-lists.zh.md" },
  "RCP-08": { en: "content/tutorial/RCP-08-multi-page-task-continuity.en.md", zh: "content/tutorial/RCP-08-multi-page-task-continuity.zh.md" },
  "RCP-13": { en: "content/tutorial/RCP-13-use-your-own-model-key.en.md", zh: "content/tutorial/RCP-13-use-your-own-model-key.zh.md" },
  "RCP-01": { en: "content/tutorial/RCP-01-login-session-and-protected-pages.en.md", zh: "content/tutorial/RCP-01-login-session-and-protected-pages.zh.md" },
  "RCP-04": { en: "content/tutorial/RCP-04-multi-step-modal-and-wizard.en.md", zh: "content/tutorial/RCP-04-multi-step-modal-and-wizard.zh.md" },
  "RCP-06": { en: "content/tutorial/RCP-06-file-upload-and-asynchronous-work.en.md", zh: "content/tutorial/RCP-06-file-upload-and-asynchronous-work.zh.md" },
  "RCP-09": { en: "content/tutorial/RCP-09-expose-three-safe-capabilities-to-an-external-agent.en.md", zh: "content/tutorial/RCP-09-expose-three-safe-capabilities-to-an-external-agent.zh.md" },
  "RCP-10": { en: "content/tutorial/RCP-10-connect-an-external-agent-through-mcp.en.md", zh: "content/tutorial/RCP-10-connect-an-external-agent-through-mcp.zh.md" },
  "RCP-11": { en: "content/tutorial/RCP-11-delegated-access-with-user-consent.en.md", zh: "content/tutorial/RCP-11-delegated-access-with-user-consent.zh.md" },
  "RCP-12": { en: "content/tutorial/RCP-12-approval-audit-and-revocation-for-agent-actions.en.md", zh: "content/tutorial/RCP-12-approval-audit-and-revocation-for-agent-actions.zh.md" },
  "RCP-14": { en: "content/tutorial/RCP-14-pass-surface-conformance-with-another-implementation.en.md", zh: "content/tutorial/RCP-14-pass-surface-conformance-with-another-implementation.zh.md" },
  "SPEC-01": { en: "content/tutorial/SPEC-01-scope-and-terminology.en.md", zh: "content/tutorial/SPEC-01-scope-and-terminology.zh.md" },
  "SPEC-02": { en: "content/tutorial/SPEC-02-capability-model.en.md", zh: "content/tutorial/SPEC-02-capability-model.zh.md" },
  "SPEC-03": { en: "content/tutorial/SPEC-03-context-model.en.md", zh: "content/tutorial/SPEC-03-context-model.zh.md" },
  "SPEC-04": { en: "content/tutorial/SPEC-04-control-model.en.md", zh: "content/tutorial/SPEC-04-control-model.zh.md" },
  "SPEC-05": { en: "content/tutorial/SPEC-05-messages-and-envelopes.en.md", zh: "content/tutorial/SPEC-05-messages-and-envelopes.zh.md" },
  "SPEC-06": { en: "content/tutorial/SPEC-06-errors-and-execution-results.en.md", zh: "content/tutorial/SPEC-06-errors-and-execution-results.zh.md" },
  "SPEC-07": { en: "content/tutorial/SPEC-07-transport-bindings.en.md", zh: "content/tutorial/SPEC-07-transport-bindings.zh.md" },
  "SPEC-08": { en: "content/tutorial/SPEC-08-security-and-privacy.en.md", zh: "content/tutorial/SPEC-08-security-and-privacy.zh.md" },
  "SPEC-09": { en: "content/tutorial/SPEC-09-conformance.en.md", zh: "content/tutorial/SPEC-09-conformance.zh.md" },
  "SPEC-10": { en: "content/tutorial/SPEC-10-versioning-and-governance.en.md", zh: "content/tutorial/SPEC-10-versioning-and-governance.zh.md" },
  "TS-01": { en: "content/tutorial/TS-01-nothing-happens-when-the-agent-acts.en.md", zh: "content/tutorial/TS-01-nothing-happens-when-the-agent-acts.zh.md" },
  "TS-02": { en: "content/tutorial/TS-02-action-not-found.en.md", zh: "content/tutorial/TS-02-action-not-found.zh.md" },
  "TS-03": { en: "content/tutorial/TS-03-action-is-unavailable.en.md", zh: "content/tutorial/TS-03-action-is-unavailable.zh.md" },
  "TS-04": { en: "content/tutorial/TS-04-confirmation-denied-or-stuck.en.md", zh: "content/tutorial/TS-04-confirmation-denied-or-stuck.zh.md" },
  "TS-05": { en: "content/tutorial/TS-05-model-request-fails.en.md", zh: "content/tutorial/TS-05-model-request-fails.zh.md" },
  "TS-06": { en: "content/tutorial/TS-06-records-stale-or-duplicated.en.md", zh: "content/tutorial/TS-06-records-stale-or-duplicated.zh.md" },
  "TS-07": { en: "content/tutorial/TS-07-navigation-loses-the-task.en.md", zh: "content/tutorial/TS-07-navigation-loses-the-task.zh.md" },
  "TS-08": { en: "content/tutorial/TS-08-sensitive-value-leaks-or-is-missing.en.md", zh: "content/tutorial/TS-08-sensitive-value-leaks-or-is-missing.zh.md" },
  "TS-09": { en: "content/tutorial/TS-09-too-many-tokens-or-steps.en.md", zh: "content/tutorial/TS-09-too-many-tokens-or-steps.zh.md" },
  "TS-10": { en: "content/tutorial/TS-10-ssr-or-hydration-breaks-the-page.en.md", zh: "content/tutorial/TS-10-ssr-or-hydration-breaks-the-page.zh.md" },
  "SITE-04": { en: "content/tutorial/SITE-04-examples-and-recipes-index.en.md", zh: "content/tutorial/SITE-04-examples-and-recipes-index.zh.md" },
  "SITE-05": { en: "content/tutorial/SITE-05-security-and-trust-center.en.md", zh: "content/tutorial/SITE-05-security-and-trust-center.zh.md" },
  "SITE-06": { en: "content/tutorial/SITE-06-releases-support-matrix-and-upgrades.en.md", zh: "content/tutorial/SITE-06-releases-support-matrix-and-upgrades.zh.md" },
  "SITE-07": { en: "content/tutorial/SITE-07-governance-rfc-and-community.en.md", zh: "content/tutorial/SITE-07-governance-rfc-and-community.zh.md" },
  "SITE-08": { en: "content/tutorial/SITE-08-license-and-trademark.en.md", zh: "content/tutorial/SITE-08-license-and-trademark.zh.md" },
};

const SECTION_INDEXES = [
  { route: "/about/", section: "M", en: "About Pling", zh: "关于 Pling", introEn: "Start with the problem Pling is designed to solve, then see how the SDK, agent runtime, and Surface protocol fit together. The remaining pages state the trust model, project policies, and support boundaries you need before adopting the framework.", introZh: "先从 Pling 要解决的问题开始，再看 SDK、Agent 运行时与 Surface 协议各自处在什么位置。其余页面说明采用框架前需要了解的信任模型、项目政策与支持边界。" },
  { route: "/concepts/", section: "C", en: "Shared concepts", zh: "共享概念", introEn: "The shared model behind every adapter: declarations, context, execution, approval, failure, continuity, and the boundary between the page and an external agent.", introZh: "所有适配器共享的模型：声明、上下文、执行、确认、失败、连续性，以及页面与外部 Agent 之间的边界。" },
  { route: "/operations/", section: "OPS", en: "Operations", zh: "跨框架运维", introEn: "Cross-framework guides for mounting the assistant, connecting a model gateway, testing capabilities, and operating a production deployment.", introZh: "跨框架的操作指南：挂载助手、连接模型网关、测试能力，并维护生产部署。" },
  { route: "/spec/", section: "SPEC", en: "Specification", zh: "协议规范", introEn: "The Surface protocol is versioned independently of the packages. Version 0.1 is the current public draft and defines two wire methods: describe and invoke.", introZh: "Surface 协议与软件包分开版本化。0.1 是当前公开草案，定义两个线上方法：describe 与 invoke。" },
  { route: "/spec/0.1/", section: "SPEC", en: "Specification 0.1", zh: "协议规范 0.1", introEn: "Version 0.1 defines how a page projects capabilities, how a caller obtains bounded context, and how one capability is invoked. Read the chapters in order; later chapters refine errors, transport, security, conformance, and versioning.", introZh: "0.1 定义页面如何投影能力、调用方如何取得有界上下文，以及如何调用一个能力。建议按顺序阅读；后续章节进一步说明错误、传输、安全、一致性与版本。" },
  { route: "/reference/", section: "REF", en: "Reference", zh: "精确参考", introEn: "Exact declarations, options, defaults, protocol shapes, error codes, and adapter behavior. Use these pages when you need the precise contract rather than a guided path.", introZh: "精确的声明、选项、默认值、协议结构、错误码与适配器行为。需要核对契约而不是跟着教程操作时，从这里查阅。" },
  { route: "/evidence/", section: "EV", en: "Evidence", zh: "证据与边界", introEn: "What has been measured, how the benchmarks can be reproduced, what failed, and which limits remain. Claims in this section stop where the evidence stops.", introZh: "记录已经测量了什么、基准如何复现、哪些路径失败，以及仍然存在的限制。这一区的结论只覆盖证据能够支持的范围。" },
  { route: "/troubleshooting/", section: "TS", en: "Troubleshooting", zh: "症状排障", introEn: "Start with the symptom you can observe. Each page narrows the cause, identifies the boundary that rejected the action, and gives a repair path without weakening authorization.", introZh: "从能够观察到的症状开始。每页会缩小原因范围、指出在哪个边界拒绝了动作，并给出不削弱授权的修复路径。" },
];

const slugify = (value) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const sectionOf = (id) => id.slice(0, id.lastIndexOf("-"));
const routeFor = (id, section, title) => ROUTE_OVERRIDES[id] ?? `${SECTION_META[section].prefix}${slugify(title)}`;
const zhRoute = (route) => route === "/" ? "/zh/" : `/zh${route}`;
const statusMeta = (status) => STATUS_META[status] ?? STATUS_META.planned;
const yaml = (value) => JSON.stringify(value ?? "");

function fileForRoute(route) {
  if (route === "/" || route.endsWith(".txt")) return null;
  let path = route.replace(/^\//, "");
  path = path.endsWith("/") ? `${path}index.md` : `${path}.md`;
  return join(websiteRoot, path);
}

function parseOutline() {
  const lines = readFileSync(outlinePath, "utf8").split(/\r?\n/);
  const entries = [];
  for (const line of lines) {
    const found = line.match(/^\|\s*([A-Z0-9]+-[0-9]+)\s*\|/);
    if (!found) continue;
    const id = found[1];
    const section = sectionOf(id);
    if (!SECTION_META[section]) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5) continue;
    const title = cells[1];
    const titleZh = cells[2] ?? title;
    const rawStatus = cells.find((cell) => /^(drafted|planned|blocked|hidden|verified|reviewed)$/.test(cell)) ?? "planned";
    const release = cells.find((cell) => /^(0\.1|later|hidden)$/.test(cell)) ?? "later";
    const prereq = section === "SITE" || cells[3] === "—" ? "" : cells[3];
    const status = rawStatus === "drafted" ? "draft" : rawStatus;
    const route = routeFor(id, section, title);
    entries.push({ id, section, title, titleZh, prereq, status, release, route, routeZh: zhRoute(route) });
  }
  return entries;
}

function sidebarItem(entry, locale) {
  const label = locale === "zh" ? entry.titleZh : entry.title;
  return { text: label, link: locale === "zh" ? entry.routeZh : entry.route };
}

function sectionGroups(entries, section, locale) {
  const current = entries.filter((entry) => entry.section === section && entry.release === "0.1" && entry.status !== "hidden");
  const later = entries.filter((entry) => entry.section === section && entry.release === "later" && entry.status !== "hidden" && entry.status !== "blocked");
  const blocked = entries.filter((entry) => entry.section === section && (entry.status === "blocked" || entry.release === "hidden" || entry.status === "hidden"));
  const isZh = locale === "zh";
  const groups = [];
  if (current.length) groups.push({ text: isZh ? "核心章节" : "Core chapters", items: current.map((entry) => sidebarItem(entry, locale)) });
  if (later.length) groups.push({ text: isZh ? "进阶章节" : "Advanced chapters", items: later.map((entry) => sidebarItem(entry, locale)) });
  if (blocked.length) groups.push({ text: isZh ? "阻塞 / 暂不公开" : "Blocked / hidden", items: blocked.map((entry) => sidebarItem(entry, locale)) });
  return groups;
}

function makeSidebars(entries, locale) {
  const p = (path) => locale === "zh" ? `/zh${path}` : path;
  const label = (en, zh) => locale === "zh" ? zh : en;
  const groups = (section) => sectionGroups(entries, section, locale);
  const item = (text, link) => ({ text, link: p(link) });
  const item2 = (en, zh, link) => ({ text: label(en, zh), link: p(link) });
  const trust = [{ text: label("Project and trust", "项目与信任"), items: [
    item2("Security and trust center", "安全与信任中心", "/security/"),
    item2("Releases and support", "发布与支持", "/releases/"),
    item2("Governance and community", "治理与社区", "/governance/"),
    item2("License and trademark", "许可证与商标", "/license/"),
    item2("Documentation map", "文档索引", "/roadmap"),
  ] }];
  return {
    [p("/start/")]: [
      { text: label("Start", "开始"), items: [
        item2("Start here", "从这里开始", "/start/"),
        item2("What is Pling?", "什么是 Pling？", "/about/mission/what-pling-is-and-is-not"),
        item2("Quick start", "快速上手", "/vue/quick-start-add-pling-to-a-vue-app"),
        item2("Inspect a run", "查看一次运行", "/vue/inspect-one-agent-run"),
      ] },
      { text: label("Choose a lane", "选择学习线"), items: [
        item("Vue 3", "/vue/"), item("React", "/react/"), item("Vanilla / jQuery", "/vanilla/"), item("Vue 2 Legacy", "/vue2/"),
      ] },
    ],
    [p("/concepts/")]: groups("C"),
    [p("/operations/")]: groups("OPS"),
    [p("/vue/")]: groups("V3"),
    [p("/react/")]: groups("R"),
    [p("/vanilla/")]: groups("J"),
    [p("/vue2/")]: groups("V2"),
    [p("/surface/")]: groups("S"),
    [p("/spec/")]: [{ text: label("Specification", "协议规范"), items: [item2("Specification overview", "规范总览", "/spec/"), item2("0.1 Draft", "0.1 草案", "/spec/0.1/")] }, ...groups("SPEC")],
    [p("/reference/")]: [
      { text: label("Reference", "参考"), items: [item2("Reference overview", "参考总览", "/reference/")] },
      ...groups("REF"),
      { text: label("API reference", "API 参考"), items: apiPageItems(locale) },
    ],
    [p("/recipes/")]: [{ text: label("Recipes", "实战方案"), items: [item2("Recipes overview", "实战总览", "/recipes/")] }, ...groups("RCP")],
    [p("/troubleshooting/")]: [{ text: label("Troubleshooting", "排障"), items: [item2("Troubleshooting overview", "排障总览", "/troubleshooting/")] }, ...groups("TS")],
    [p("/about/")]: [
      { text: label("Mission", "使命"), items: [
        item2("Why Pling", "为什么做 Pling", "/about/mission/why-a-capability-layer"),
        item2("What Pling is, and is not", "Pling 是什么，不是什么", "/about/mission/what-pling-is-and-is-not"),
        item2("Trust and audit", "信任与审计", "/about/mission/trust-authority-and-audit"),
        item2("Open protocol", "开放协议", "/about/mission/from-single-site-bridge-to-open-protocol"),
      ] },
      { text: label("Project", "项目"), items: [
        ...trust[0].items,
      ] },
    ],
    [p("/examples/")]: [{ text: label("Examples", "示例"), items: [
      item2("Overview", "总览", "/examples/"),
      item2("Example 01: Todo", "案例01：待办事项", "/examples/quickstart"),
      item2("Example 02: Order workspace", "案例02：订单工作台", "/examples/orders"),
      item2("Example 03: Single-page route workspace", "案例03：单页多路由工作台", "/examples/vue3-spa-routing"),
      item2("Example 04: Multi-page workspace", "案例04：多页工作台", "/examples/multi-page-continuity"),
      item2("Example 05: Expose capabilities", "案例05：暴露能力给外部", "/examples/external-agent-surface"),
      item2("Recipes", "实战方案", "/recipes/"),
    ] }],
    [p("/security/")]: trust, [p("/releases/")]: trust, [p("/governance/")]: trust,
    [p("/license/")]: trust, [p("/roadmap")]: trust,
  };
}

function makeNav(locale) {
  const p = (path) => locale === "zh" ? `/zh${path}` : path;
  const label = (en, zh) => locale === "zh" ? zh : en;
  return [
    { text: label("Docs", "文档"), activeMatch: "^/(zh/)?(start|concepts|operations|vue|react|vanilla|vue2|troubleshooting)/", items: [
      { text: label("Start here", "开始"), link: p("/start/") },
      { text: label("Concepts", "概念"), link: p("/concepts/") },
      { text: label("Operations", "运维"), link: p("/operations/") },
      { text: "Vue 3", link: p("/vue/") }, { text: "React", link: p("/react/") },
      { text: label("Vanilla / jQuery", "原生 JS / jQuery"), link: p("/vanilla/") },
      { text: "Vue 2 Legacy", link: p("/vue2/") },
    ] },
    { text: label("Examples", "案例"), activeMatch: "^/(zh/)?(examples|recipes)/", items: [
      { text: label("Live examples", "在线案例"), link: p("/examples/") },
      { text: label("Recipes", "实战方案"), link: p("/recipes/") },
    ] },
    { text: "Surface", link: p("/surface/"), activeMatch: "^/(zh/)?surface/" },
    { text: label("Spec", "规范"), activeMatch: "^/(zh/)?spec/", items: [
      { text: label("Overview", "总览"), link: p("/spec/") },
      { text: label("0.1 Draft", "0.1 草案"), link: p("/spec/0.1/") },
    ] },
    { text: label("Reference", "参考"), activeMatch: "^/(zh/)?reference/", items: [
      { text: label("Reference overview", "参考总览"), link: p("/reference/") },
      { text: label("API reference", "API 参考"), link: p("/reference/api/") },
      ...apiPageLinks(locale).slice(1).map((page) => ({ text: page.title, link: page.route })),
    ] },
    { text: label("About", "关于"), activeMatch: "^/(zh/)?(about|security|releases|governance|community|license|roadmap)/", items: [
      { text: label("Overview", "总览"), link: p("/about/") },
      { text: label("Why a capability layer", "为什么需要能力层"), link: p("/about/mission/why-a-capability-layer") },
      { text: label("What Pling is", "Pling 是什么"), link: p("/about/mission/what-pling-is-and-is-not") },
      { text: label("Trust and audit", "信任与审计"), link: p("/about/mission/trust-authority-and-audit") },
      { text: label("Open protocol", "开放协议"), link: p("/about/mission/from-single-site-bridge-to-open-protocol") },
      { text: label("Security", "安全"), link: p("/security/") },
      { text: label("Releases", "发布"), link: p("/releases/") },
      { text: label("Governance and community", "治理与社区"), link: p("/governance/") },
      { text: label("License", "许可证"), link: p("/license/") },
      { text: label("Documentation map", "文档索引"), link: p("/roadmap") },
    ] },
  ];
}

function apiPageItems(locale) {
  const isZh = locale === "zh";
  return apiPageLinks(locale).map((page, index) => ({
    text: index === 0 ? (isZh ? "总览" : "Overview") : page.title,
    link: page.route,
  }));
}

function apiReferenceMarkdown(locale, level = "###") {
  const isZh = locale === "zh";
  const items = apiPageLinks(locale).map((page, index) => {
    const title = index === 0 ? (isZh ? "总览" : "Overview") : page.title;
    return `- [${title}](${page.route})`;
  });
  return `${level} ${isZh ? "API 参考" : "API reference"}\n\n${items.join("\n")}`;
}

function draftPathFor(entry, locale) {
  const file = DRAFT_FILES[entry.id]?.[locale];
  return file ? join(root, file) : null;
}

function placeholder(entry, locale, targetFile) {
  const status = statusMeta(entry.status);
  const isZh = locale === "zh";
  const title = isZh ? entry.titleZh : entry.title;
  const statusLabel = isZh ? status.zh : status.en;
  const sectionLabel = isZh ? SECTION_META[entry.section].zh : SECTION_META[entry.section].en;
  const header = `---\nid: ${entry.id}\ntitle: ${yaml(title)}\nstatus: ${entry.status}\nrelease: ${entry.release}\nprereq: ${yaml(entry.prereq)}\nlocale: ${locale}\n---\n`;
  const draftFile = draftPathFor(entry, locale);
  if (draftFile) {
    const rel = relative(dirname(targetFile), draftFile).replaceAll("\\", "/");
    return `${header}\n# ${title}\n\n<!-- @include: ${rel} -->\n`;
  }
  const body = isZh
    ? `# ${entry.id} · ${title}\n\n::: ${status.container} ${statusLabel} · ${entry.id}\n这一页属于 **${sectionLabel}**，当前状态是 **${statusLabel}**。页面已进入目录，但正文尚未定稿。\n:::\n\n## 这一页会讲什么\n\n这一页将解释 **${title}** 的契约、具体做法、一个可运行示例，以及至少两个失败模式。通过核对后，状态才会从 \`${entry.status}\` 变为 \`verified\`。\n\n## 页面契约\n\n| 字段 | 值 |\n| --- | --- |\n| ID | ${entry.id} |\n| 所属线 | ${sectionLabel} |\n| 前置 | ${entry.prereq || "—"} |\n| 首发 | ${entry.release} |\n| 状态 | ${statusLabel} |\n\n## 现在可以做什么\n\n- 查看 [文档路线图](/zh/roadmap) 了解全部章节与当前进度。\n- 如果你要评审这一章，请先在这张页面上留下状态和问题，不要把它当成已完成教程。\n`
    : `# ${entry.id} · ${title}\n\n::: ${status.container} ${statusLabel} · ${entry.id}\nThis page belongs to **${sectionLabel}** and is currently **${statusLabel}**. It is part of the outline, but the content is not final.\n:::\n\n## What this page will cover\n\nThis page will explain the contract behind **${title}**, the concrete workflow, a runnable example, and at least two failure modes. Its status changes from \`${entry.status}\` to \`verified\` only after those claims are checked.\n\n## Page contract\n\n| Field | Value |\n| --- | --- |\n| ID | ${entry.id} |\n| Lane | ${sectionLabel} |\n| Prerequisite | ${entry.prereq || "—"} |\n| Release | ${entry.release} |\n| Status | ${statusLabel} |\n\n## What you can do now\n\n- Open the [documentation roadmap](/roadmap) to see every chapter and its status.\n- If you are reviewing this chapter, use this page to record the decision. Do not treat it as a finished tutorial yet.\n`;
  return `${header}\n${body}`;
}

function writeGenerated(file, content, marker = "<!-- generated:skeleton -->") {
  if (existsSync(file) && !readFileSync(file, "utf8").includes(marker)) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, placeMarker(content, marker), "utf8");
  return true;
}

function markdownFiles(dir) {
  const files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name === ".vitepress" || item.name === "node_modules" || item.name === "dist") continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) files.push(...markdownFiles(path));
    else if (item.isFile() && item.name.endsWith(".md")) files.push(path);
  }
  return files;
}

/** Remove generated placeholders whose routes disappeared from the outline. */
function pruneStaleSkeletons(expected) {
  let removed = 0;
  for (const file of markdownFiles(websiteRoot)) {
    if (expected.has(file)) continue;
    if (!readFileSync(file, "utf8").includes("<!-- generated:skeleton -->")) continue;
    rmSync(file);
    removed += 1;
  }
  return removed;
}

function placeMarker(content, marker) {
  const frontmatter = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!frontmatter) return `${marker}\n${content}`;
  return `${frontmatter[0]}${marker}\n${content.slice(frontmatter[0].length)}`;
}

function roadmap(entries, locale) {
  const isZh = locale === "zh";
  const title = isZh ? "文档索引" : "Documentation map";
  const intro = isZh
    ? `按主题浏览全部公开文档。第一次接触 Pling，建议从[从这里开始](/zh/start/)读起；需要一条完整实践路径时，从 [Vue 3](/zh/vue/) 或 [React](/zh/react/) 开始。Reference 用于核对精确契约，Recipes 解决具体界面任务，Troubleshooting 从可观察到的症状入手。`
    : `Browse the public documentation by subject. If this is your first visit, start with [Start here](/start/); for a complete practice path, choose [Vue 3](/vue/) or [React](/react/). Reference is for exact contracts, Recipes for concrete interface tasks, and Troubleshooting starts from observable symptoms.`;
  const order = ["SITE", "M", "C", "OPS", "V3", "R", "J", "V2", "S", "SPEC", "REF", "RCP", "TS"];
  const visibleSections = new Set(entries.filter((entry) => entry.status !== "hidden" && entry.release !== "hidden").map((entry) => entry.section));
  const sections = order.filter((section) => visibleSections.has(section));
  const lists = sections.map((section) => {
    const rows = entries.filter((entry) => entry.section === section && entry.status !== "hidden" && entry.release !== "hidden");
    const sectionLabel = isZh ? SECTION_META[section].zh : SECTION_META[section].en;
    const items = rows.map((entry) => {
      const link = isZh ? entry.routeZh : entry.route;
      const pageTitle = isZh ? entry.titleZh : entry.title;
      return `- [${pageTitle}](${link})`;
    }).join("\n");
    const apiReference = section === "REF" ? `\n\n${apiReferenceMarkdown(locale)}` : "";
    return `## ${sectionLabel}\n\n${items}${apiReference}`;
  }).join("\n\n");
  return `---\ntitle: ${yaml(title)}\nlocale: ${locale}\n---\n\n# ${title}\n\n${intro}\n\n${lists}\n`;
}

function sectionIndex(config, entries, locale) {
  const isZh = locale === "zh";
  const route = isZh ? zhRoute(config.route) : config.route;
  const file = fileForRoute(route);
  if (!file) return false;
  const rows = entries.filter((entry) => entry.section === config.section);
  const title = isZh ? config.zh : config.en;
  const intro = isZh ? config.introZh : config.introEn;
  const items = rows.map((entry) => {
    const link = isZh ? entry.routeZh : entry.route;
    const pageTitle = isZh ? entry.titleZh : entry.title;
    return `- [${pageTitle}](${link})`;
  });
  const specLink = config.route === "/spec/" && !isZh ? "\n\nStart with the [0.1 specification](/spec/0.1/)." : config.route === "/spec/" && isZh ? "\n\n从 [0.1 规范](/zh/spec/0.1/) 开始阅读。" : "";
  const apiSection = config.route === "/reference/" ? `\n\n${apiReferenceMarkdown(locale, "##")}` : "";
  const projectLinks = config.route !== "/about/" ? "" : isZh
    ? "\n\n## 项目与信任\n\n- [安全与信任中心](/zh/security/)\n- [发布、支持矩阵与升级](/zh/releases/)\n- [治理与社区](/zh/governance/)\n- [许可证与商标](/zh/license/)\n- [文档索引](/zh/roadmap)"
    : "\n\n## Project and trust\n\n- [Security and trust center](/security/)\n- [Releases, support matrix, and upgrades](/releases/)\n- [Governance and community](/governance/)\n- [License and trademark](/license/)\n- [Documentation map](/roadmap)";
  const body = `---\ntitle: ${yaml(title)}\nstatus: navigation\nrelease: 0.1\nlocale: ${locale}\n---\n\n# ${title}\n\n${intro}${specLink}\n\n${isZh ? "## 章节" : "## Chapters"}\n\n${items.join("\n")}${projectLinks}${apiSection}\n`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, placeMarker(body, "<!-- generated:section-index -->"), "utf8");
  return true;
}

function supplementalPages(locale) {
  // The guided tour was removed in favour of five self-contained examples.
  return [];
}

function llmsText(entries, locale) {
  const isZh = locale === "zh";
  const sections = [...new Set(entries.filter((entry) => entry.section !== "EV").map((entry) => entry.section))];
  const groups = sections.map((section) => {
    const rows = entries.filter((entry) => entry.section === section && entry.route !== "/llms.txt");
    if (!rows.length) return "";
    const label = isZh ? SECTION_META[section].zh : SECTION_META[section].en;
    const items = rows.map((entry) => {
      const route = isZh ? entry.routeZh : entry.route;
      const title = isZh ? entry.titleZh : entry.title;
      return `- [${title}](${SITE_ORIGIN}${route})`;
    });
    return `## ${label}\n\n${items.join("\n")}`;
  }).filter(Boolean).join("\n\n");
  const intro = isZh
    ? ["# Pling 文档", "", "> Pling（页灵）是面向真实 Web 应用的开放能力层。Agent 从页面显式声明的能力中执行操作，而不是猜 DOM 或绕过业务逻辑。", "", "协议版本为 `pling.surface/0.1`，当前是公开草案；0.1 已实现的方法只有 `describe` 与 `invoke`。业务失败放在成功协议响应的 `result.error` 中，协议失败使用 `ok: false`。", "", `规范入口：${SITE_ORIGIN}/zh/spec/0.1/。完整正文：${SITE_ORIGIN}/zh/llms-full.txt。`]
    : ["# Pling documentation", "", "> Pling (Page Intelligence) is an open capability layer for real web applications. An agent executes explicitly declared page capabilities instead of guessing the DOM or bypassing business logic.", "", "The protocol is `pling.surface/0.1` and remains a public draft. The only methods implemented by 0.1 are `describe` and `invoke`. Business failures stay inside a successful protocol response as `result.error`; protocol failures use `ok: false`.", "", `Specification entry point: ${SITE_ORIGIN}/spec/0.1/. Full text: ${SITE_ORIGIN}/llms-full.txt.`];
  const pages = apiPageLinks(locale);
  const pageLines = pages.map((page, index) => {
    const title = index === 0 ? (isZh ? "总览" : "Overview") : page.title;
    return `- [${title}](${SITE_ORIGIN}${page.route})`;
  });
  const jsonLines = pages.map((page, index) => {
    const title = index === 0
      ? (isZh ? "API 总览 JSON" : "API overview JSON")
      : `${page.title} JSON`;
    return `- [${title}](${SITE_ORIGIN}${page.jsonRoute})`;
  });
  const apiLinks = `## ${isZh ? "API 参考" : "API reference"}\n\n${pageLines.join("\n")}\n\n### ${isZh ? "机器可读 JSON" : "Machine-readable JSON"}\n\n${jsonLines.join("\n")}`;
  const lines = [...intro, "", groups, "", apiLinks];
  return `${lines.join("\n")}\n`;
}

function withoutFrontmatter(value) {
  return value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

function readEntryBody(entry, locale) {
  const draft = draftPathFor(entry, locale);
  if (draft && existsSync(draft)) return withoutFrontmatter(readFileSync(draft, "utf8"));
  const route = locale === "zh" ? entry.routeZh : entry.route;
  const file = fileForRoute(route);
  if (!file || !existsSync(file)) return "";
  let body = withoutFrontmatter(readFileSync(file, "utf8"));
  body = body.replace(/^<!-- generated:(?:skeleton|section-index|supplemental) -->\s*/gm, "").replace(/^<!-- @include: .* -->\s*$/gm, "");
  return body.trim();
}

function llmsFullText(entries, locale) {
  const isZh = locale === "zh";
  const blocks = entries.filter((entry) => entry.section !== "EV" && entry.route !== "/llms.txt").map((entry) => {
    const route = isZh ? entry.routeZh : entry.route;
    const title = isZh ? entry.titleZh : entry.title;
    const body = readEntryBody(entry, locale).replace(/^# .+\r?\n+/, "");
    if (!body) return "";
    return `# ${title}\n\nCanonical: ${SITE_ORIGIN}${route}\n\n${body}`;
  }).filter(Boolean);
  for (const page of apiPageLinks(locale)) {
    const file = fileForRoute(page.route);
    if (!file || !existsSync(file)) continue;
    const body = withoutFrontmatter(readFileSync(file, "utf8"))
      .replace(/^<!-- generated:api-index -->\s*/m, "")
      .replace(/^# .+\r?\n+/, "");
    blocks.push(`# ${page.title}\n\nCanonical: ${SITE_ORIGIN}${page.route}\n\n${body}`);
  }
  const header = isZh
    ? ["# Pling 文档全文", "", "这是文档站的完整 Markdown 导出版。规范正文 `pling.surface/0.1` 仍是公开草案；各页面中的示例与证据不能替代应用自身的安全、权限和合规审查。", "", `规范入口：${SITE_ORIGIN}/zh/spec/0.1/。`]
    : ["# Pling documentation — full text", "", "This is the complete Markdown export of the documentation site. The `pling.surface/0.1` specification remains a public draft; examples and evidence in these pages do not replace an application's own security, authorization, or compliance review.", "", `Specification entry point: ${SITE_ORIGIN}/spec/0.1/.`];
  return `${[...header, ...blocks].join("\n\n---\n\n")}\n`;
}

function main() {
  const entries = parseOutline();
  if (!entries.length) throw new Error("No outline entries found.");
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.route)) throw new Error(`Duplicate route: ${entry.route} (${entry.id})`);
    seen.add(entry.route);
  }
  mkdirSync(generatedDir, { recursive: true });
  const expectedFiles = new Set();
  for (const entry of entries) {
    if (entry.route === "/llms.txt") continue;
    for (const locale of ["en", "zh"]) {
      const file = fileForRoute(locale === "zh" ? entry.routeZh : entry.route);
      if (file) expectedFiles.add(file);
    }
  }
  for (const config of SECTION_INDEXES) {
    for (const locale of ["en", "zh"]) {
      const file = fileForRoute(locale === "zh" ? zhRoute(config.route) : config.route);
      if (file) expectedFiles.add(file);
    }
  }
  for (const locale of ["en", "zh"]) {
    for (const page of supplementalPages(locale)) {
      const file = fileForRoute(page.route);
      if (file) expectedFiles.add(file);
    }
  }
  const publicEntries = entries.filter((entry) => entry.section !== "EV");
  const generated = { entries: publicEntries, enNav: makeNav("en"), zhNav: makeNav("zh"), enSidebar: makeSidebars(publicEntries, "en"), zhSidebar: makeSidebars(publicEntries, "zh") };
  writeFileSync(join(generatedDir, "content.mts"), `// Generated by scripts/generate-docs-skeleton.mjs. Do not edit by hand.\nexport const CONTENT = ${JSON.stringify(generated.entries, null, 2)} as const;\nexport const EN_NAV = ${JSON.stringify(generated.enNav, null, 2)} as const;\nexport const ZH_NAV = ${JSON.stringify(generated.zhNav, null, 2)} as const;\nexport const EN_SIDEBAR = ${JSON.stringify(generated.enSidebar, null, 2)} as const;\nexport const ZH_SIDEBAR = ${JSON.stringify(generated.zhSidebar, null, 2)} as const;\n`, "utf8");
  let created = 0;
  for (const entry of entries) {
    if (entry.route === "/llms.txt") continue;
    for (const locale of ["en", "zh"]) {
      const route = locale === "zh" ? entry.routeZh : entry.route;
      const file = fileForRoute(route);
      if (file && writeGenerated(file, placeholder(entry, locale, file))) created += 1;
    }
  }
  for (const locale of ["en", "zh"]) {
    const file = join(websiteRoot, locale === "zh" ? "zh/roadmap.md" : "roadmap.md");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, roadmap(publicEntries, locale), "utf8");
  }
  for (const config of SECTION_INDEXES) {
    for (const locale of ["en", "zh"]) sectionIndex(config, entries, locale);
  }
  for (const locale of ["en", "zh"]) {
    for (const page of supplementalPages(locale)) {
      const file = fileForRoute(page.route);
      if (file) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, placeMarker(page.content, "<!-- generated:supplemental -->"), "utf8");
      }
    }
    const llmsFile = join(websiteRoot, "public", locale === "zh" ? "zh/llms.txt" : "llms.txt");
    mkdirSync(dirname(llmsFile), { recursive: true });
    writeFileSync(llmsFile, llmsText(publicEntries, locale), "utf8");
    const fullFile = join(websiteRoot, "public", locale === "zh" ? "zh/llms-full.txt" : "llms-full.txt");
    writeFileSync(fullFile, llmsFullText(publicEntries, locale), "utf8");
  }
  const pruned = pruneStaleSkeletons(expectedFiles);
  const counts = entries.reduce((acc, entry) => { acc[entry.status] = (acc[entry.status] ?? 0) + 1; return acc; }, {});
  console.log(`✓ Docs skeleton: ${entries.length} entries, ${created} pages created, ${pruned} stale pages removed, ${counts.reviewed ?? 0} reviewed, ${counts.draft ?? 0} draft, ${counts.planned ?? 0} planned, ${counts.blocked ?? 0} blocked, ${counts.hidden ?? 0} hidden.`);
}

main();
