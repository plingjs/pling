const p = (name, type, description, descriptionZh, options = {}) => ({
  name,
  type,
  required: options.required ?? false,
  defaultValue: options.defaultValue ?? "",
  description,
  descriptionZh,
});

const ex = (title, titleZh, code, lang = "ts") => ({ title, titleZh, code, lang });

const uiOptions = [
  p(
    "ui.locale",
    '"en-US" | "zh-CN" | "auto" | string',
    'Language used by the built-in assistant UI. "auto" follows the browser language.',
    "内置助手界面的语言。传 `auto` 时跟随浏览器语言。",
    { defaultValue: "en-US" },
  ),
  p(
    "ui.theme",
    '"light" | "dark" | "auto" | PlingThemeOverrides',
    "Theme for the built-in surfaces. An object can override tokens or choose a mode.",
    "内置界面的主题。传对象时可选择模式或覆盖设计令牌。",
    { defaultValue: "light" },
  ),
  p(
    "ui.theme.mode",
    '"light" | "dark" | "auto"',
    'Explicit mode when the theme is an object. "auto" follows the operating-system preference.',
    "主题传对象时指定的模式。`auto` 跟随操作系统外观。",
    { defaultValue: "light" },
  ),
  p(
    "ui.theme.tokens",
    "Partial<PlingThemeTokens>",
    "Overrides individual design tokens such as colours, radii, shadows, and font families. Keys not supplied keep the selected light or dark defaults.",
    "覆盖颜色、圆角、阴影、字体等单个设计令牌。未提供的键沿用所选明色或暗色主题的默认值。",
  ),
  p(
    "ui.messages",
    "PlingCatalogOverrides",
    "Adds or replaces message catalog entries for one or more locales.",
    "为一个或多个语言补充或替换界面文案。",
  ),
  p(
    "ui.messages.<locale>",
    "Partial<Record<PlingMessageKey, string>>",
    "Message overrides for one BCP 47 locale. Missing keys fall back to the built-in catalog.",
    "某个 BCP 47 语言的文案覆盖。未提供的键回退到内置文案。",
  ),
  p(
    "ui.classNames",
    "PlingClassNames",
    "Extra class names applied to the built-in chat, dock, launcher, and panel.",
    "为内置对话、浮窗、启动按钮和面板附加 class。",
  ),
  p("ui.classNames.dock", "string", "Extra class for the dock shell.", "浮窗外壳的附加 class。"),
  p("ui.classNames.panel", "string", "Extra class for the panel shell.", "面板外壳的附加 class。"),
  p("ui.classNames.launcher", "string", "Extra class for the launcher button.", "启动按钮的附加 class。"),
  p("ui.classNames.chat", "string", "Extra class for the chat surface.", "对话界面的附加 class。"),
];

const agentSetupCommon = [
  p(
    "agent.config",
    "AgentConfigOverrides",
    "Partial model and runtime configuration. Omitted fields are read from VITE_AGENT_* environment variables or framework defaults.",
    "模型与运行时的局部配置。未写的字段从 `VITE_AGENT_*` 环境变量或框架默认值读取。",
  ),
  p("agent.context", "ContextOptions", "Bounds the page information included in model context, including the live clock.", "设置进入模型上下文的页面信息上限，也可配置每轮读取的实时时钟。"),
  p("agent.clock", "AgentClock", "Adds the current instant, viewer timezone, and business timezone to every model request. This is context only; business services remain authoritative for writes.", "每次模型请求都附带当前时刻、用户时区和业务时区。它只提供上下文；写入仍以业务服务校验为准。"),
  p("agent.llm", "Llm", "Injects the model call function. Use it for a test model, a server proxy, or a non-OpenAI-compatible transport.", "注入模型调用函数。可用于测试模型、服务端代理或非 OpenAI 兼容传输。"),
  p("agent.responseLocale", "string | (() => string)", "Locale used when composing the response-language instruction. A function is re-read before each model request.", "拼接回答语言约束时使用的语言。传函数时，每次模型请求前重新读取。"),
  p("agent.telemetry", "Telemetry", "Collects token, duration, cost, and retry metrics for the current runtime.", "收集当前运行时的 token、耗时、成本与重试指标。"),
  p("agent.trace", "boolean | AgentTraceOptions", "Keeps a bounded in-memory trace of model requests for the read-only inspector. Disabled by default.", "在内存中保留有界的模型请求记录，供只读诊断面板查看。默认关闭。", { defaultValue: "false" }),
  p("agent.settle", "() => Promise<void>", "Replaces the page-settle wait used between actions. Most useful in deterministic tests and non-browser hosts.", "替换动作之间的页面落定等待。主要用于确定性测试和非浏览器宿主。"),
  p("agent.hooks", "HookRegistry", "Tool lifecycle hooks shared by every surface created from this application runtime.", "由该应用运行时创建的界面共用的工具生命周期钩子。"),
  p("agent.onEvent", "(event: SessionEvent) => void", "Receives the same session event stream that powers the chat and activity views.", "接收与对话、运行视图相同的会话事件流。"),
  p("agent.onApproval", "(pending: PendingApproval | null) => void", "Called when an approval request appears or clears. Use it to connect a custom approval UI.", "确认请求出现或清除时调用。可用来接自己的确认界面。"),
  p("agent.onHandoff", "(pending: PendingHandoff | null) => void", "Called when a human-handoff request appears or clears.", "人工接力请求出现或清除时调用。"),
  p("agent.policy", "ConfirmGate", "Replaces the default approval gate. When provided, the built-in gate and chat approval buttons are not used.", "替换默认确认闸门。传入后不再使用内置闸门和对话中的确认按钮。"),
  p("agent.approvalTimeoutMs", "number", "Time to wait for a human approval before treating it as denied.", "等待人工确认的最长时间；超时按拒绝处理。", { defaultValue: "60000" }),
  p("agent.handoffTimeoutMs", "number", "Default time to wait for a human handoff. A tool-level handoff.timeout overrides it.", "人工接力的默认等待时间。单个工具的 `handoff.timeout` 可以覆盖。", { defaultValue: "300000" }),
  p("agent.handoff", "HandoffGate", "Replaces the built-in handoff queue with a custom channel.", "用自定义通道替换内置人工接力队列。"),
  p("agent.id", "string", "Stable session id for multi-session hosts.", "多会话宿主使用的稳定会话 id。"),
  p("agent.onLeaseLost", "() => void", "Called when another tab or host takes over the shared session lease.", "共享会话租约被另一个标签页或宿主接管时调用。"),
  p("agent.continuity", 'ContinuitySetting', 'Enables bounded conversation continuity across full-page navigation. "tab" uses sessionStorage. Omit to disable it.', "开启跨整页导航的有界对话连续性。`\"tab\"` 使用 sessionStorage；省略即关闭。"),
  p("agent.gate", "() => boolean", "Returns false to disable the built-in confirmation channel for this application. Defaults to enabled.", "返回 `false` 时关闭该应用的内置确认通道。默认开启。", { defaultValue: "true" }),
];

const vue3AgentSetup = [
  ...agentSetupCommon,
  p(
    "agent.modelSettings",
    'ModelSettingsSetting',
    'Exposes model connection settings in the Activity view. "readonly" shows application settings; "byok" allows user-entered endpoint, model, and key on trusted pages.',
    "在运行视图中提供模型连接设置。`readonly` 只展示应用配置；`byok` 允许用户在可信页面填写端点、模型和密钥。",
    { defaultValue: "off" },
  ),
];

const createPlingCommon = [
  ...uiOptions,
  p("onWarn", "(message: string) => void", "Receives development warnings and declaration diagnostics. Defaults to console.warn.", "接收开发期告警和声明诊断。默认输出到 `console.warn`。", { defaultValue: "console.warn" }),
  p("registry", "Registry", "Uses an existing action registry instead of creating one. Do not combine it with shared.", "使用已有动作注册表，而不是新建一个。不要与 `shared` 同时传入。"),
  p("shared", "PlingPage", "Joins a page runtime shared by several framework islands. registry and scopes are then owned by that page runtime.", "接入多个框架孤岛共用的页面运行时。此时 `registry` 与 `scopes` 由页面统一持有。"),
  p("namespace", "string", "Prefixes action and record ids for this adapter instance, for example add becomes todo/add.", "为该适配器实例的动作与记录 id 加前缀，例如 `add` 变成 `todo/add`。"),
  p("scopes", "ScopeControllerOptions", "Overrides visibility and hit-testing behavior. Intended for tests and unusual rendering hosts.", "覆盖可见性与命中测试行为。主要用于测试和特殊渲染宿主。"),
  p("agent", "AgentSetup", "Wires the model, hooks, confirmation, continuity, and observability used by built-in assistant surfaces.", "接线内置助手界面使用的模型、钩子、确认、连续性与观测能力。"),
  p("derive", "boolean | DeriveOptions", "Enables optional L1 derivation from native clickable elements. Disabled by default; derived actions are marked as guesses.", "开启可选的 L1 派生：从原生可点击元素推断动作。默认关闭；派生动作会标记为推断结果。", { defaultValue: "false" }),
  p("presence", "boolean | PresenceOptions", "Controls target highlighting while the agent operates the page.", "控制 agent 操作页面时的目标高亮。", { defaultValue: "true" }),
  p("revealSensitive", "boolean", "Restores sensitive-value tokens to their real values in the rendered chat only. Model requests and storage keep the tokens.", "仅在渲染层把敏感值代号还原为真值。发给模型的请求和存储中仍保留代号。", { defaultValue: "true" }),
];

const vue3CreateRows = [
  ...createPlingCommon,
  p("diagnostics", "boolean", "Scans the mounted root once for actionable controls without declarations and reports coverage through onWarn. Enabled by default only in Vite dev mode.", "挂载后扫描一次未声明的可操作控件，并通过 `onWarn` 报告覆盖率。仅在 Vite 开发模式下默认开启。", { defaultValue: "import.meta.env.DEV" }),
  p("page", "false | PageOptions", "Controls page identity collection. Defaults to location plus document.title; pass false to disable it.", "控制页面身份收集。默认读取 `location` 与 `document.title`；传 `false` 关闭。", { defaultValue: "location + document.title" }),
];

const vanillaCreateRows = [
  ...createPlingCommon,
  p(
    "defaultApproval",
    '"danger" | "kind"',
    'Sets the declaration-time default when a tool omits confirm. "danger" asks only for danger actions; "kind" uses the risk level of every action.',
    "设置工具未写 `confirm` 时的声明期默认策略。`danger` 只询问危险动作；`kind` 按每个动作的风险等级决定。",
    { defaultValue: '"danger"' },
  ),
];

const withoutAgentPrefix = (rows) =>
  rows.map((row) => ({ ...row, name: row.name.replace(/^agent\./, "") }));

export const API_ENTRY_DETAILS = {
  createPling: {
    parameters: {
      vue3: vue3CreateRows,
      react: createPlingCommon,
      vue2: vanillaCreateRows,
      vanilla: vanillaCreateRows,
    },
    examples: {
      vue3: [
        ex(
          "Vue 3 application setup",
          "Vue 3 应用初始化",
          `import { createApp } from "vue";
import { createPling } from "@plingjs/vue";

const pling = createPling({
  namespace: "todo",
  agent: {
    config: { limits: { maxTurns: 12 } },
    trace: true,
  },
});

createApp(App).use(pling.plugin).mount("#app");`,
        ),
        ex(
          "Route model calls through a same-origin gateway",
          "通过同源网关调用模型",
          `const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "gpt-4.1-mini",
    },
    trace: true,
  },
});`,
        ),
      ],
      react: [
        ex(
          "React application setup",
          "React 应用初始化",
          `import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";

const pling = createPling({ namespace: "todo" });

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);`,
          "tsx",
        ),
        ex(
          "Route model calls through a same-origin gateway",
          "通过同源网关调用模型",
          `const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "gpt-4.1-mini",
    },
    trace: true,
  },
});`,
          "tsx",
        ),
      ],
      vue2: [
        ex(
          "Vue 2.7 application setup",
          "Vue 2.7 应用初始化",
          `import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({ namespace: "todo" });
Vue.use(pling.plugin);

new Vue({ render: (h) => h(App) }).$mount("#app");`,
        ),
        ex(
          "Route model calls through a same-origin gateway",
          "通过同源网关调用模型",
          `const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "gpt-4.1-mini",
    },
    trace: true,
  },
});`,
        ),
      ],
      vanilla: [
        ex(
          "Vanilla setup with one declared action",
          "原生 JS 初始化并声明一个动作",
          `import { createPling } from "@plingjs/vanilla";

const pling = createPling({ namespace: "todo" });
pling.tool(document.querySelector("#add"), {
  id: "add",
  desc: "添加一条待办",
  kind: "write",
});`,
        ),
        ex(
          "Route model calls through a same-origin gateway",
          "通过同源网关调用模型",
          `const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "gpt-4.1-mini",
    },
    trace: true,
  },
});`,
        ),
      ],
    },
  },

  PlingProvider: {
    parameters: {
      react: [
        p("pling", "PlingElement", "Application runtime returned by createPling.", "`createPling` 返回的应用运行时。", { required: true }),
        p("children", "ReactNode", "React subtree that can call Pling hooks and mount assistant components.", "可以调用 Pling Hook 并挂载助手组件的 React 子树。"),
      ],
    },
    examples: {
      react: [
        ex(
          "Scope the runtime to the React tree",
          "把运行时限定在一棵 React 树中",
          `const pling = createPling();

root.render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);`,
          "tsx",
        ),
      ],
    },
  },

  usePling: {
    parameters: { all: [] },
    examples: {
      vue3: [ex("Read the injected runtime", "读取注入的运行时", `const pling = usePling();\n\nonMounted(() => pling.inspectCoverage());`)],
      react: [ex("Read the provider runtime", "读取 Provider 中的运行时", `const pling = usePling();\n\nconst report = pling.inspectCoverage();`, "tsx")],
      vue2: [ex("Read the installed runtime", "读取已安装的运行时", `const pling = usePling();`)],
    },
  },

  usePlingUi: {
    parameters: { react: [] },
    examples: {
      react: [
        ex(
          "Re-render when locale or theme changes",
          "语言或主题变化时重新渲染",
          `function Toolbar() {
  const ui = usePlingUi();
  return <span>{ui.locale} · {ui.resolvedTheme}</span>;
}`,
          "tsx",
        ),
      ],
    },
  },

  plugin: {
    parameters: { vue3: [], vue2: [] },
    examples: {
      vue3: [ex("Install Vue 3 directives", "安装 Vue 3 指令", `createApp(App).use(pling.plugin).mount("#app");`)],
      vue2: [ex("Install Vue 2.7 directives", "安装 Vue 2.7 指令", `Vue.use(pling.plugin);`)],
    },
  },

  PlingElement: {
    parameters: {
      vue3: [
        p("registry", "Registry", "Shared action, record, state, and feedback registry.", "共享的动作、记录、状态与反馈注册表。"),
        p("ui", "PlingUiController", "Locale, theme, catalog, and CSS-variable controller.", "语言、主题、文案目录与 CSS 变量控制器。"),
        p("feedback", "FeedbackCollector", "Page-level feedback collector shared by the application.", "应用共用的页面级反馈收集器。"),
        p("page", "PageTracker", "Tracks route, path, title, and selected query parameters.", "跟踪路由、路径、标题与白名单查询参数。"),
        p("plugin", "{ install(app: App): void }", "Vue plugin that registers directives and the injection key.", "注册指令与注入键的 Vue 插件。"),
        p("ask", "(prompt: string, options?: PlingAskOptions) => Promise<void>", "Routes a human-authored task to a mounted assistant surface.", "把用户发起的任务交给已挂载的助手界面。"),
        p(
          "task",
          "PlingTaskController & TaskCatalog",
          "Human task entrance plus the current page's guided-task catalog. Register tasks with define(), then read active() or activate() a task by id.",
          "面向人的任务入口，同时也是当前页面的引导任务目录。用 `define()` 登记任务，再通过 `active()` 读取当前任务或 `activate()` 激活指定任务。",
        ),
        p("derived", "() => DeriveController | null", "Returns the optional L1 deriver. It is null unless derive was enabled.", "返回可选的 L1 派生器。未开启 `derive` 时为 `null`。"),
        p("inspectCoverage", "() => CoverageReport", "Scans the mounted root for actionable controls without declarations.", "扫描挂载根，报告未声明的可操作控件。"),
        p("scopes", "ScopeController", "Region visibility, viewport, and occlusion controller.", "区域可见性、视口与遮挡控制器。"),
        p("setActiveScopes", "(scopes: Iterable<string>) => void", "Manually replaces the active region set when automatic detection is not suitable.", "自动判定不适用时，手动替换活跃区域集合。"),
        p("destroy", "() => void", "Stops observers and releases declarations owned by this runtime.", "停止观察器并释放该运行时持有的声明。"),
        p("agent", "AgentSetup", "Application-level assistant wiring, when supplied to createPling.", "传给 `createPling` 的应用级助手接线。"),
        p("revealSensitive", "boolean", "Whether the rendered chat restores sensitive tokens.", "渲染对话时是否还原敏感值代号。"),
      ],
      react: [
        p("ui", "PlingUiController", "Locale, theme, catalog, and CSS-variable controller.", "语言、主题、文案目录与 CSS 变量控制器。"),
        p("registry", "Registry", "Shared action, record, state, and feedback registry.", "共享的动作、记录、状态与反馈注册表。"),
        p("feedback", "FeedbackCollector", "Page-level feedback collector shared by the application.", "应用共用的页面级反馈收集器。"),
        p("scopes", "ScopeController", "Region visibility, viewport, and occlusion controller.", "区域可见性、视口与遮挡控制器。"),
        p("setActiveScopes", "(scopes: Iterable<string>) => void", "Manually replaces the active region set.", "手动替换活跃区域集合。"),
        p("presence", "PresenceController | null", "Target highlighting controller; null when presence is disabled.", "目标高亮控制器；关闭存在感时为 `null`。"),
        p("derived", "() => DeriveController | null", "Returns the optional L1 deriver.", "返回可选的 L1 派生器。"),
        p(
          "task",
          "PlingTaskController",
          "Routes human-authored task requests to a mounted assistant surface. React does not add the guided-task catalog here.",
          "把用户发起的任务请求交给已挂载的助手界面。React 在这里没有额外附加引导任务目录。",
        ),
        p("ask", "(prompt: string, options?: PlingAskOptions) => Promise<void>", "Routes a human-authored task to a mounted assistant surface.", "把用户发起的任务交给已挂载的助手界面。"),
        p("inspectCoverage", "(root?: Element | null) => CoverageReport", "Scans a root element for actionable controls without declarations.", "扫描根元素，报告未声明的可操作控件。"),
        p("destroy", "() => void", "Stops observers and releases declarations owned by this runtime.", "停止观察器并释放该运行时持有的声明。"),
        p("warn", "(message: string) => void", "Emits a framework warning through the configured channel.", "通过配置的通道发出框架告警。"),
        p("agent", "AgentSetup", "Application-level assistant wiring, when supplied to createPling.", "传给 `createPling` 的应用级助手接线。"),
        p("revealSensitive", "boolean", "Whether the rendered chat restores sensitive tokens.", "渲染对话时是否还原敏感值代号。"),
      ],
    },
    examples: {
      vue3: [ex("Inspect what the page exposes", "查看页面暴露了什么", `const pling = createPling();\n\nconsole.table(pling.inspectCoverage().targets);`)],
      react: [ex("Inspect what the page exposes", "查看页面暴露了什么", `const pling = createPling();\n\nconsole.table(pling.inspectCoverage().targets);`, "tsx")],
    },
  },

  VanillaPling: {
    parameters: {
      vanilla: [
        p("feedback", "FeedbackCollector", "Page-level feedback collector, including ARIA validation messages.", "页面级反馈收集器，包括 ARIA 校验消息。"),
        p("page", "PageTracker", "Tracks path, title, router-like identity, and allowlisted query parameters.", "跟踪路径、标题、路由式身份与白名单查询参数。"),
        p("task", "PlingTaskController", "Task routing controller shared by declareTask and the dock.", "由 `declareTask` 与浮窗共享的任务路由控制器。"),
        p("ask", "(prompt: string, options?: PlingAskOptions) => Promise<void>", "Routes a human-authored task to a mounted assistant surface.", "把用户发起的任务交给已挂载的助手界面。"),
        p("tool", "(element: Element, options: ToolOptions) => () => void", "Declares an element action and returns an unbind function.", "把元素声明成动作，并返回解绑函数。"),
        p("action", "(options: ActionOptions) => () => void", "Declares an action with no DOM element.", "声明一个没有 DOM 元素的动作。"),
        p("record", "(element: Element, value: RecordValue | null | undefined) => () => void", "Declares a row record and returns an unbind function.", "把一行数据声明成记录，并返回解绑函数。"),
        p("scope", "(element: Element, options: ScopeOptions) => () => void", "Declares a page region and returns an unbind function.", "声明页面区域，并返回解绑函数。"),
        p("state", "(key: string, source: StateSource, options?: StateOptions | string) => () => void", "Exposes a read-only state view and returns an unregister function.", "暴露只读状态视图，并返回注销函数。"),
        p("declareFeedback", "(element: Element, value: FeedbackValue | readonly FeedbackValue[]) => () => void", "Declares user-visible feedback without creating an action.", "声明用户可见的反馈，但不会创建动作。"),
        p("declareTask", "(element: HTMLElement, value: string | TaskOptions) => () => void", "Turns an element into a human-facing task entrance.", "把元素变成面向人的任务入口。"),
        p("guideTarget", "(element: Element, id: string) => () => void", "Highlights a handoff target without registering it as an action.", "高亮人工接力目标，但不会登记成动作。"),
        p("setActiveScopes", "(scopes: Iterable<string>) => void", "Overrides the active region set.", "覆盖活跃区域集合。"),
        p("dock", "(options?: VanillaDockOptions) => VanillaDock", "Mounts the native floating assistant and returns its controller.", "挂载原生浮动助手，并返回控制器。"),
        p("surfaceGateway", "(options: VanillaSurfaceGatewayOptions) => VanillaSurfaceGateway", "Creates an external-Agent Surface gateway over an explicit capability allowlist.", "基于显式能力 allowlist 创建外部 Agent 的 Surface 网关。"),
        p("inspectCoverage", "(root?: Element | null) => CoverageReport", "Scans a root for interactive controls without declarations. It never registers actions.", "扫描根元素中尚未声明的交互控件，不会注册动作。"),
        p("derived", "() => DeriveController | null", "Returns the optional L1 deriver.", "返回可选的 L1 派生器。"),
        p("destroy", "() => void", "Unbinds all declarations and destroys every mounted dock.", "解绑所有声明并销毁已挂载的浮窗。"),
      ],
      vue2: [
        p("plugin", "{ install(Vue: VueConstructor): void }", "Installs the Vue 2.7 directives and $pling property.", "安装 Vue 2.7 指令与 `$pling` 属性。"),
      ],
    },
    examples: {
      vanilla: [
        ex(
          "Declare and release a tool",
          "声明并释放一个动作",
          `const unbind = pling.tool(button, { desc: "删除当前项", kind: "danger" });\n\n// Later, when the row is removed:\nunbind();`,
        ),
        ex(
          "Wire the complete page runtime",
          "接入完整的页面运行时",
          `const pling = createPling({\n  agent: { config: { baseUrl: "/llm/v1", model: "your-model" } },\n  page: { queryKeys: ["tab"] },\n});\n\npling.declareFeedback(field, { message: "名称不能为空", field: "name" });\npling.declareTask(document.querySelector("#ask"), "检查当前订单");\npling.dock({ debug: true, modelSettings: "readonly" });`,
        ),
      ],
      vue2: [ex("Install the Vue 2.7 plugin", "安装 Vue 2.7 插件", `Vue.use(pling.plugin);`)],
    },
  },

  destroy: {
    parameters: { all: [] },
    examples: {
      vue3: [ex("Release the runtime", "释放运行时", `onBeforeUnmount(() => pling.destroy());`)],
      react: [ex("Release the runtime", "释放运行时", `useEffect(() => () => pling.destroy(), []);`, "tsx")],
      vue2: [ex("Release the runtime", "释放运行时", `beforeDestroy() {\n  this.$pling.destroy();\n}`)],
      vanilla: [ex("Release the runtime", "释放运行时", `window.addEventListener("pagehide", () => pling.destroy(), { once: true });`)],
    },
  },

  "element-action": {
    parameters: {
      vue3: [
        p("v-tool", "string | ToolOptions | ToolOptions[]", "A string is a description shorthand. Use an object or array when you need a stable id, risk level, parameters, flow steps, expectations, or a custom run function.", "字符串是一句说明的简写。需要稳定 id、风险等级、参数、流程、成功判据或自定义执行时，传对象或数组。", { required: true }),
      ],
      react: [
        p("options", "PlingToolOptions", "The same fields as ToolOptions; the hook returns a ref callback to attach to the element.", "字段与 `ToolOptions` 相同；Hook 返回要挂到元素上的 ref 回调。", { required: true }),
      ],
      vue2: [
        p("v-tool", "string | ToolOptions | readonly ToolOptions[]", "A description shorthand or one or more declarations for the same element.", "一句说明的简写，或同一元素上的一条/多条声明。", { required: true }),
      ],
      vanilla: [
        p("element", "Element", "Element whose action should be exposed.", "要暴露动作的元素。", { required: true }),
        p("options", "ToolOptions", "Action declaration, including the primitive override and optional injected runner.", "动作声明，包括原语覆盖与可选的注入执行函数。", { required: true }),
      ],
    },
    examples: {
      vue3: [
        ex("String shorthand", "字符串简写", `<button v-tool="'添加一条待办'">添加</button>`),
        ex("Stable id and injected run", "稳定 id 与注入执行", `<button v-tool="{
  id: 'add',
  desc: '添加一条待办',
  kind: 'write',
  available: () => draft.trim() ? true : '先输入待办内容',
  run: () => add(),
}">添加</button>`, "vue"),
      ],
      react: [
        ex("Declare an element action", "声明元素动作", `const addRef = usePlingTool({
  id: "add",
  desc: "添加一条待办",
  kind: "write",
  run: () => add(),
});

return <button ref={addRef}>添加</button>;`, "tsx"),
      ],
      vue2: [ex("Vue 2.7 directive", "Vue 2.7 指令", `<button v-tool="{ id: 'add', desc: '添加一条待办', run: () => add() }">添加</button>`, "vue")],
      vanilla: [ex("Vanilla declaration", "原生声明", `pling.tool(document.querySelector("#add"), {\n  id: "add",\n  desc: "添加一条待办",\n  run: () => add(),\n});`)],
    },
  },

  "function-action": {
    parameters: {
      vue3: [p("options", "AgentToolOptions", "Id, description, risk, availability, parameters, expectation, and implementation.", "id、说明、风险、可用性、参数、成功判据与实现。", { required: true })],
      react: [p("options", "AgentToolOptions", "Id, description, risk, availability, parameters, expectation, and implementation.", "id、说明、风险、可用性、参数、成功判据与实现。", { required: true })],
      vue2: [p("options", "ActionOptions", "An action implemented in code rather than bound to a DOM control.", "由代码实现、而不是绑定到 DOM 控件的动作。", { required: true })],
      vanilla: [p("options", "ActionOptions", "An action implemented in code rather than bound to a DOM control.", "由代码实现、而不是绑定到 DOM 控件的动作。", { required: true })],
    },
    examples: {
      vue3: [ex("Register an application action", "登记应用级动作", `useAgentTool({\n  id: "clear_completed",\n  desc: "清除所有已完成待办",\n  kind: "write",\n  available: () => remaining.value < all.value || "没有已完成待办",\n  run: () => clearCompleted(),\n});`)],
      react: [ex("Register an application action", "登记应用级动作", `useAgentTool({\n  id: "clear_completed",\n  desc: "清除所有已完成待办",\n  kind: "write",\n  run: () => clearCompleted(),\n});`, "tsx")],
      vue2: [ex("Register an action", "登记动作", `const unbind = pling.action({\n  id: "clear_completed",\n  desc: "清除所有已完成待办",\n  run: () => clearCompleted(),\n});`)],
      vanilla: [ex("Register an action", "登记动作", `pling.action({\n  id: "clear_completed",\n  desc: "清除所有已完成待办",\n  run: () => clearCompleted(),\n});`)],
    },
  },

  region: {
    parameters: {
      vue3: [p("v-scope", "string | ScopeValue", "A string is a stable region id. The object form adds a label, description, structural role, or explicit parent.", "字符串是稳定区域 id。对象形式可补区域名、说明、结构角色或显式父区域。", { required: true })],
      react: [p("options", "PlingScopeOptions", "Region id and optional model-facing metadata.", "区域 id 以及可选的面向模型的元数据。", { required: true })],
      vue2: [p("v-scope", "string | ScopeOptions", "Region id or metadata object.", "区域 id 或元数据对象。", { required: true })],
      vanilla: [p("element", "Element", "Container element for the region.", "区域容器元素。", { required: true }), p("options", "ScopeOptions", "Region id and optional model-facing metadata.", "区域 id 以及可选的面向模型的元数据。", { required: true })],
    },
    examples: {
      vue3: [ex("Describe a list region", "描述列表区域", `<section v-scope="{ id: 'todos', label: '待办列表', role: 'list' }">...</section>`)],
      react: [ex("Describe a list region", "描述列表区域", `const scopeRef = usePlingScope({ id: "todos", label: "待办列表", role: "list" });\n\nreturn <section ref={scopeRef}>...</section>;`, "tsx")],
      vue2: [ex("Describe a region", "描述区域", `<section v-scope="{ id: 'todos', label: '待办列表' }">...</section>`, "vue")],
      vanilla: [ex("Describe a region", "描述区域", `pling.scope(document.querySelector("#todos"), {\n  id: "todos",\n  label: "待办列表",\n  role: "list",\n});`)],
    },
  },

  record: {
    parameters: {
      vue3: [p("v-record", "RecordValue | null | undefined", "The row object, or a { data, id, label, fields } envelope that limits what the model can read.", "行对象，或 `{ data, id, label, fields }` 包装对象，用来限制模型可读字段。", { required: true })],
      react: [p("value", "RecordValue | null | undefined", "The row value. The hook returns a ref callback for the row element.", "行数据。Hook 返回挂到行元素上的 ref 回调。", { required: true })],
      vue2: [p("v-record", "RecordValue | null | undefined", "The row object or an explicit record envelope.", "行对象或显式记录包装。", { required: true })],
      vanilla: [p("element", "Element", "Element that represents the row.", "表示这一行的元素。", { required: true }), p("value", "RecordValue | null | undefined", "The row object or an explicit record envelope.", "行对象或显式记录包装。", { required: true })],
    },
    examples: {
      vue3: [ex("Expose only selected fields", "只暴露选定字段", `<li v-for="todo in todos" :key="todo.id" v-record="{\n  data: todo,\n  label: \`待办：\${todo.text}\`,\n  fields: { text: todo.text, done: todo.done },\n}">...</li>`)],
      react: [ex("Expose a row", "暴露一行记录", `function TodoRow({ todo }: { todo: Todo }) {\n  const recordRef = usePlingRecord({ data: todo, fields: { text: todo.text, done: todo.done } });\n  return <li ref={recordRef}>{todo.text}</li>;\n}`, "tsx")],
      vue2: [ex("Expose a row", "暴露一行记录", `<li v-for="todo in todos" :key="todo.id" v-record="todo">...</li>`, "vue")],
      vanilla: [ex("Expose a row", "暴露一行记录", `pling.record(rowElement, todo);`)],
    },
  },

  state: {
    parameters: {
      all: [
        p("key", "string", "Stable state-view name used in page context and diagnostics.", "用于页面上下文与诊断的稳定状态名。", { required: true }),
        p("source", "unknown | (() => unknown) | Ref<unknown> | Record<string, unknown>", "A value, ref, or read function. Prefer a function so the snapshot reflects current state.", "值、ref 或读取函数。推荐传函数，让每次快照都反映当前状态。", { required: true }),
        p("options", "StateOptions | string", "A description object or a description string. Name the view and explain what it means.", "说明对象或说明字符串。写清这组状态是什么。"),
      ],
    },
    examples: {
      vue3: [ex("Expose filters and counts", "暴露筛选与计数", `useAgentState("todo", () => ({\n  filter: filter.value,\n  total: todos.value.length,\n  remaining: todos.value.filter((todo) => !todo.done).length,\n}), { description: "当前筛选与未完成数量" });`)],
      react: [ex("Expose filters and counts", "暴露筛选与计数", `usePlingState("todo", () => ({\n  filter,\n  total: todos.length,\n  remaining: todos.filter((todo) => !todo.done).length,\n}), { description: "当前筛选与未完成数量" });`, "tsx")],
      vue2: [ex("Expose filters and counts", "暴露筛选与计数", `useAgentState("todo", () => ({ filter: this.filter, total: this.todos.length }));`)],
      vanilla: [ex("Expose filters and counts", "暴露筛选与计数", `pling.state("todo", () => ({\n  filter: currentFilter,\n  total: todos.length,\n}), { description: "当前筛选与总数" });`)],
    },
  },

  "expose-state": {
    parameters: {
      react: [
        p("pling", 'Pick<PlingElement, "registry">', "Runtime or any object with the same registry property.", "运行时，或任何具有 `registry` 属性的对象。", { required: true }),
        p("key", "string", "Stable state-view name.", "稳定状态名。", { required: true }),
        p("source", "PlingStateSource", "Value or read function evaluated for each snapshot.", "每个快照重新求值的值或读取函数。", { required: true }),
        p("options", "PlingStateOptions | string", "Model-facing description.", "面向模型的说明。"),
      ],
    },
    examples: {
      react: [ex("Expose state outside React", "在 React 树之外暴露状态", `const off = exposePlingState(pling, "filters", () => ({\n  status: store.getState().status,\n  count: store.getState().visible.length,\n}), { description: "列表筛选与可见条数" });`, "tsx")],
    },
  },

  "store-state": {
    parameters: {
      all: [
        p("key", "string", "Stable state-view name.", "稳定状态名。", { required: true }),
        p("store", "S extends object", "Pinia or Vuex store-like object.", "Pinia 或 Vuex 风格的 store 对象。", { required: true }),
        p("read", "readonly string[] | ((store: S) => unknown)", "An allowlist of fields or a selector that returns a bounded view.", "字段白名单，或返回有界视图的 selector。", { required: true }),
        p("options", "AgentStateOptions | string", "Description shown with the state in model context.", "随状态一起进入模型上下文的说明。"),
      ],
    },
    examples: {
      vue3: [ex("Expose a store allowlist", "暴露 store 字段白名单", `const cart = useCartStore();\nuseAgentStoreState("cart", cart, ["count", "total"], "购物车件数与小计");`)],
      vue2: [ex("Expose a store allowlist", "暴露 store 字段白名单", `const cart = this.$store.state.cart;\nuseAgentStoreState("cart", cart, ["count", "total"], "购物车件数与小计");`)],
    },
  },

  feedback: {
    parameters: {
      vue3: [p("v-feedback", "FeedbackValue | FeedbackValue[]", "A string, or an object with message, field, severity, scope, and id. Use functions for fields that change.", "字符串，或包含 `message`、`field`、`severity`、`scope`、`id` 的对象。变化的值可用函数读取。", { required: true })],
      react: [p("value", "PlingFeedbackInput", "Feedback value or array of values.", "反馈值或反馈值数组。", { required: true }), p("options", "PlingFeedbackOptions", "Fallback id and scope for the feedback declarations.", "反馈声明的兜底 id 与作用域。")],
      vanilla: [p("element", "Element", "Element that anchors the feedback and supplies its region.", "承载反馈并提供所属区域的元素。", { required: true }), p("value", "FeedbackValue | readonly FeedbackValue[]", "A string, or an object with message, field, severity, scope, and id. Use functions for fields that change.", "字符串，或包含 `message`、`field`、`severity`、`scope`、`id` 的对象。变化的值可用函数读取。", { required: true })],
    },
    examples: {
      vue3: [ex("Expose a form error", "暴露表单错误", `<p v-feedback="error ? { message: error, field: 'email', severity: 'error' } : null" />`)],
      react: [ex("Expose a form error", "暴露表单错误", `usePlingFeedback(error ? { message: error, field: "email", severity: "error" } : null);`, "tsx")],
      vanilla: [ex("Expose a form error", "暴露表单错误", `pling.declareFeedback(field, {\n  message: error,\n  field: "email",\n  severity: "error",\n});`)],
    },
  },

  "task-entry": {
    parameters: {
      vue3: [p("v-task", "string | TaskOptions", "A prompt string, or an object with prompt, surface, and disabled.", "提示词字符串，或包含 `prompt`、`surface`、`disabled` 的对象。", { required: true })],
      react: [p("prompt", "string", "Natural-language task sent to the mounted assistant surface.", "发送给已挂载助手界面的自然语言任务。", { required: true }), p("options.surface", "string", "Named surface id. Omit it when only one surface is mounted.", "具名界面 id。只挂载一个界面时可省略。"), p("options.source", "Element", "Element that triggered the task, for custom hosts and diagnostics.", "触发任务的元素，供自定义宿主与诊断使用。")],
      vanilla: [p("element", "HTMLElement", "Element that behaves as the task entrance.", "作为任务入口的元素。", { required: true }), p("value", "string | TaskOptions", "A prompt string, or an object with prompt, surface, and disabled.", "提示词字符串，或包含 `prompt`、`surface`、`disabled` 的对象。", { required: true })],
    },
    examples: {
      vue3: [ex("Route a human task", "转交一条用户任务", `<button v-task="'整理今天的待办并标出最紧急的一项'">让助手整理</button>`)],
      react: [ex("Route a human task", "转交一条用户任务", `await pling.ask("整理今天的待办并标出最紧急的一项", { surface: "dock" });`, "tsx")],
      vanilla: [ex("Route a human task", "转交一条用户任务", `pling.declareTask(document.querySelector("#ask"), {\n  prompt: "整理今天的待办并标出最紧急的一项",\n  surface: "dock",\n});`)],
    },
  },

  "guide-target": {
    parameters: {
      all: [
        p("id", "string", "Stable target id passed to pling_locate or HandoffStep.highlight. It does not create an executable action.", "稳定的目标 id，可交给 `pling_locate` 或 `HandoffStep.highlight`。它不会创建可执行动作。", { required: true }),
        p("label", "string", "Short human-facing name shown in the locate-only target list.", "出现在只定位目标清单中的简短名称。"),
        p("description", "string", "Explains what the target is for; shown to the model as context.", "说明目标的用途，会作为上下文提供给模型。"),
      ],
      vue3: [p("value", "string | { id: string; label?: string; description?: string }", "Registers the element as a locate-only target. Vue uses its accessible label when label is omitted.", "把元素登记为只定位目标。省略 `label` 时，Vue 会尝试读取元素的无障碍名称。", { required: true })],
      react: [p("metadata", "{ label?: string; description?: string }", "Optional target name and description. The target id is passed separately.", "可选的目标名称与说明。目标 id 单独传入。")],
      vue2: [p("value", "string | { id: string; label?: string; description?: string }", "Registers the element as a locate-only target. Vue 2 uses its accessible label when label is omitted.", "把元素登记为只定位目标。省略 `label` 时，Vue 2 会尝试读取元素的无障碍名称。", { required: true })],
      vanilla: [
        p("element", "Element", "Element to point out. It must remain mounted until the target is unregistered.", "要指给用户看的元素。注销目标前，元素应保持挂载。", { required: true }),
        p("metadata", "{ label?: string; description?: string }", "Optional human-facing name and description.", "可选的人类可读名称与用途说明。"),
      ],
    },
    examples: {
      vue3: [ex("Register a locate-only control", "登记只定位控件", `<button v-guide-target="{ id: 'teachers.add', label: '新增老师', description: '打开老师档案表单' }">新增老师</button>\n\n<!-- The assistant can locate this button, but cannot click it through the guide target. -->`)],
      react: [ex("Register a locate-only control", "登记只定位控件", `const addTeacherRef = usePlingGuideTarget<HTMLButtonElement>("teachers.add", {\n  label: "新增老师",\n  description: "打开老师档案表单",\n});\n\nreturn <button ref={addTeacherRef}>新增老师</button>;`, "tsx")],
      vue2: [ex("Register a locate-only control", "登记只定位控件", `<button v-guide-target="{ id: 'teachers.add', label: '新增老师' }">新增老师</button>`) ],
      vanilla: [ex("Register a locate-only control", "登记只定位控件", `const removeTarget = pling.guideTarget(addTeacherButton, "teachers.add", {\n  label: "新增老师",\n  description: "打开老师档案表单",\n});\n\n// When the button is removed:\nremoveTarget();`)],
    },
  },

  sensitive: {
    parameters: {
      all: [
        p("value", "T", "Value that enters page context and the model transcript.", "会进入页面上下文与模型对话的值。", { required: true }),
        p("options", '"masked" | "hidden" | SensitiveOptions', "Controls whether the model sees a placeholder or no value. The real value remains in the browser.", "控制模型看到占位代号还是不看到值。真值仍留在浏览器内。", { defaultValue: '"masked"' }),
      ],
    },
    examples: {
      all: [ex("Mask a phone number", "脱敏电话号码", `const phone = sensitive(customer.phone, "masked");`)],
    },
  },

  ToolOptions: {
    parameters: {
      all: [
        p("desc", "string", "Required model-facing description of what the control or operation does. This is the primary signal used to select the tool.", "必填的面向模型说明，描述控件或操作做什么。这是模型选择工具时最主要的依据。", { required: true }),
        p("id", "string", "Stable action id. Omit only for one-off controls; list rows and flows should use stable ids.", "稳定动作 id。仅一次性控件可以省略；列表行与流程应显式提供。", { defaultValue: "generated once per binding" }),
        p("kind", '"read" | "write" | "danger"', "Risk level used for approval and auditing. Omitted values are fail-closed and treated as write.", "用于确认与审计的风险等级。省略时按 fail-closed 视为 `write`。", { defaultValue: "write" }),
        p("confirm", 'boolean | "always"', "Overrides approval derivation. false skips confirmation, true requires it, and always never offers a persistent allow option.", "覆盖确认推导。`false` 跳过确认，`true` 要求确认，`always` 每次询问且不提供长期允许。", { defaultValue: "derived from kind" }),
        p("modelVisible", "boolean", "Keeps the action out of the model tool list and snapshot while page code and task steps can still invoke it. This is a visibility boundary, not a permission check.", "让动作不出现在模型工具清单与动作快照中，但页面代码和任务步骤仍可调用。这是可见性边界，不是权限校验。", { defaultValue: "true" }),
        p("action", '"click" | "fill" | "select" | "press" | "hover"', "Overrides primitive inference. By default form inputs use fill and other elements use click.", "覆盖动作原语推断。默认表单输入使用填写，其余元素使用点击。", { defaultValue: "inferred from element" }),
        p("key", "string", "Key used by an action whose primitive is press.", "原语为按键时使用的键名。", { defaultValue: "Enter" }),
        p("scope", "string", "Explicit region id. Omitted values inherit the nearest declared scope.", "显式区域 id。省略时继承最近声明的区域。", { defaultValue: "nearest scope" }),
        p("fidelity", '"high" | "auto" | "low"', "Declares how trustworthy the execution target is. Setting it stops automatic target relocation.", "声明执行目标的可靠程度。显式设置后不再自动定位目标。", { defaultValue: "inferred" }),
        p("target", "string", "CSS selector, scoped to the declared element, used to choose the concrete target.", "限定在声明元素内部查找具体目标的 CSS 选择器。"),
        p("autoTarget", "boolean", "Automatically locates a unique native control inside the declared element.", "自动定位声明元素内部唯一的原生控件。", { defaultValue: "true" }),
        p("available", "() => boolean | string | undefined", "Business precondition checked before the action appears as available. A returned string is shown to the model as the reason.", "动作出现前检查的业务前置条件。返回字符串时，该字符串会作为不可用原因交给模型。"),
        p("expect", "Expectation", "Success criterion checked after execution. Failure produces EXPECTATION_FAILED instead of a false success.", "执行后检查的成功判据。不成立时返回 `EXPECTATION_FAILED`，不会把未完成当成功。"),
        p("handoff", "boolean | string | HandoffOptions", "Hands the step to the user instead of simulating it. The boolean or string form supplies the reason.", "把这一步交给用户完成，而不是模拟操作。布尔值或字符串形式提供原因。"),
        p("params", "ParamDeclaration", "Parameter schema for the parameterized form. When present, run receives the validated parameter object rather than a single primitive value.", "带参数表单使用的参数声明。存在时，`run` 收到校验后的参数对象，而不是单个原语值。", { required: "conditional" }),
        p("run", "(valueOrArgs) => void | Promise<void>", "Injected implementation. Atomic actions receive the primitive value; parameterized actions receive the full argument object. Ignored when steps is present.", "注入的执行实现。原子动作收到原语值；带参数动作收到完整参数对象。写了 `steps` 时不会运行。"),
        p("steps", "readonly FlowStep[]", "Turns the declaration into a single model-facing flow that executes registered action ids in order. Do not combine it with run.", "把声明变成对模型可见的单个流程，按顺序执行已注册动作 id。不要与 `run` 同时使用。"),
      ],
    },
    examples: {
      vue3: [ex("Parameterized declaration", "带参数的声明", `const move = {\n  id: "move_task",\n  desc: "把待办移动到指定位置",\n  kind: "write",\n  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],\n  run: ({ position }) => moveTask(Number(position)),\n};\n\n// <button v-tool="move">上移</button>`)],
      react: [ex("Parameterized declaration", "带参数的声明", `const moveRef = usePlingTool({\n  id: "move_task",\n  desc: "把待办移动到指定位置",\n  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],\n  run: ({ position }) => moveTask(Number(position)),\n});`, "tsx")],
      vue2: [ex("Parameterized declaration", "带参数的声明", `const move = {\n  id: "move_task",\n  desc: "把待办移动到指定位置",\n  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],\n  run: ({ position }) => moveTask(Number(position)),\n};`, "js")],
      vanilla: [ex("Parameterized declaration", "带参数的声明", `pling.tool(button, {\n  id: "move_task",\n  desc: "把待办移动到指定位置",\n  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],\n  run: ({ position }) => moveTask(Number(position)),\n});`)],
    },
  },

  ScopeOptions: {
    parameters: {
      all: [
        p("id", "string", "Stable region id. It is written to the DOM and inherited by descendant declarations.", "稳定区域 id。会写入 DOM，并由后代声明继承。", { required: true }),
        p("label", "string", "Short model-facing name, for example 待办列表.", "面向模型的短名称，例如“待办列表”。"),
        p("description", "string", "Explains what the region is for and when actions inside it apply.", "说明区域的用途，以及其中动作适用的场景。"),
        p("role", "RegionRole", "Structural role such as main, dialog, toolbar, or list. It affects reading order and context, not permissions.", "`main`、`dialog`、`toolbar`、`list` 等结构角色。只影响阅读顺序与上下文，不构成权限边界。"),
        p("parent", "string", "Explicit parent region id for portals, overlays, or detach-to-body cases.", "为传送门、浮层或挂到 body 的节点显式指定父区域 id。"),
      ],
    },
    examples: {
      all: [ex("Region metadata", "区域元数据", `const scope = {\n  id: "orders",\n  label: "订单列表",\n  description: "当前筛选结果，每行可以打开或删除",\n  role: "list",\n  parent: "main",\n};`)],
    },
  },

  RecordValue: {
    parameters: {
      core: [
        p("plain object.id | key", "string | number", "Default primary key when the row itself is passed as a plain object.", "直接把行对象作为记录时，默认从 `id` 或 `key` 读取主键。"),
        p("envelope.data", "object", "Row data wrapped in the explicit record envelope.", "使用显式记录包装时承载的行数据。", { required: "conditional" }),
        p("envelope.id", "string | number", "Overrides the primary key when the field is not named id or key.", "主键字段不叫 `id` / `key` 时用它覆盖。"),
        p("envelope.label", "string", "Human- and model-readable row label.", "给人也给模型看的行说明。"),
        p("envelope.fields", "Record<string, unknown>", "Allowlist of fields visible to the model. Without it, all row fields except the primary key are exposed.", "模型可见字段白名单。不写时暴露除主键外的全部行字段。"),
      ],
    },
    examples: {
      core: [ex("Explicit field allowlist", "显式字段白名单", `const value = {\n  data: order,\n  id: order.code,\n  label: \`订单 \${order.code}\`,\n  fields: { customer: order.customer, total: order.total },\n};`)],
    },
  },

  StateOptions: {
    parameters: {
      all: [p("description", "string", "Explains the state view and its units or bounds. Describe a view, not the entire store.", "说明状态视图及其单位或范围。描述的是一个有界视图，不是整个 store。")],
    },
    examples: {
      all: [ex("Describe a bounded view", "描述有界视图", `{ description: "当前筛选项、总条数与未完成条数" }`)],
    },
  },

  AgentSetup: {
    parameters: {
      vue3: [...withoutAgentPrefix(vue3AgentSetup)],
      react: withoutAgentPrefix(agentSetupCommon),
      vue2: withoutAgentPrefix(agentSetupCommon),
      vanilla: withoutAgentPrefix(agentSetupCommon),
    },
    examples: {
      vue3: [ex("Application-level assistant setup", "应用级助手接线", `const pling = createPling({\n  agent: {\n    config: { limits: { maxTurns: 12 } },\n    trace: true,\n    gate: () => true,\n    modelSettings: { mode: "byok", persist: "session" },\n  },\n});`)],
      react: [ex("Application-level assistant setup", "应用级助手接线", `const pling = createPling({\n  agent: {\n    config: { limits: { maxTurns: 12 } },\n    trace: true,\n    gate: () => true,\n  },\n});`)],
      vue2: [ex("Application-level assistant setup", "应用级助手接线", `const pling = createPling({\n  agent: { config: { limits: { maxTurns: 12 } }, trace: true },\n});`)],
      vanilla: [ex("Application-level assistant setup", "应用级助手接线", `const pling = createPling({\n  agent: { config: { limits: { maxTurns: 12 } }, trace: true },\n});`)],
    },
  },

  Kind: {
    parameters: {
      core: [
        p("read", '"read"', "No business state change. Visibility, navigation, and inspection belong here.", "不改变业务状态。查看、导航和检查属于这一档。"),
        p("write", '"write"', "Changes business state but is not destructive or irreversible.", "改变业务状态，但不是破坏性或不可逆操作。"),
        p("danger", '"danger"', "Destructive, irreversible, or high-impact. Approval defaults to stricter handling.", "破坏性、不可逆或影响较大的操作。确认策略默认更严格。"),
      ],
    },
    examples: {
      core: [ex("Choose a risk level", "选择风险等级", `pling.tool(deleteButton, { desc: "删除此订单", kind: "danger" });`)],
    },
  },

  ParamDeclaration: {
    parameters: {
      core: [
        p("[].name", "string", "Argument key received by run and visible to the model.", "`run` 收到的参数键，也是模型看到的参数名。", { required: true }),
        p("[].label", "string", "Required explanation of the argument. It is the model's only semantic hint.", "必填的参数说明，是模型唯一可依赖的语义提示。", { required: true }),
        p("[].type", '"string" | "number" | "boolean"', "Argument type. Includes coercion from obvious string forms and rejects invalid values.", "参数类型。会把明显的字符串形式规整为对应类型，并拒绝无效值。", { defaultValue: '"string"' }),
        p("[].optional", "boolean", "Marks the argument optional. Arguments are required by default.", "把参数标为可选。参数默认必填。", { defaultValue: "false" }),
        p("[].values", "readonly (string | number)[]", "Closed static value set. Use it when the model must choose from known values.", "静态封闭值集合。模型只能从已知值里选择时使用。"),
        p("[].options", "() => readonly ParamOption[]", "Dynamic value set, re-read for each snapshot and execution.", "动态值集合，每次快照与执行前重新读取。"),
        p("[].min | [].max", "number | (() => number)", "Numeric bounds for number arguments, including dynamic bounds.", "数字参数的上下界，也支持动态边界。"),
        p("[].minLength | [].maxLength", "number", "String length bounds.", "字符串长度边界。"),
        p("[].pattern", "RegExp | string", "Regular-expression constraint for a string argument.", "字符串参数的正则约束。"),
        p("[].format", '"date"', "Semantic format validation. A date must be a real calendar date.", "语义格式校验。`date` 还要求是真实存在的日期。"),
        p("JSON Schema.type", '"object"', "The direct JSON Schema form must describe an object.", "直接传 JSON Schema 时，根类型必须是对象。", { required: "conditional", defaultValue: '"object"' }),
        p("JSON Schema.properties", "Record<string, unknown>", "Property schemas for the direct JSON Schema form.", "直接 JSON Schema 形式的属性定义。"),
        p("JSON Schema.required", "string[]", "Required property names for the direct JSON Schema form.", "直接 JSON Schema 形式的必填属性名。"),
      ],
    },
    examples: {
      core: [ex("Compact parameter declaration", "参数简写", `const params = [\n  { name: "orderId", label: "订单号", pattern: /^SO-\\d{4}$/ },\n  { name: "note", label: "新备注", maxLength: 200 },\n  { name: "notify", label: "是否通知客户", type: "boolean", optional: true },\n];`)],
    },
  },

  AgentToolOptions: {
    parameters: {
      all: [
        p("id", "string", "Globally unique action id used by the model.", "模型调用时使用的全局唯一动作 id。", { required: true }),
        p("desc", "string", "Required semantic description of the operation.", "必填的操作语义说明。", { required: true }),
        p("kind", "Kind", "Risk level. Omitted values are fail-closed and treated as write.", "风险等级。省略时按 fail-closed 视为 `write`。", { defaultValue: "write" }),
        p("confirm", 'boolean | "always"', "Overrides the normal approval policy.", "覆盖常规确认策略。", { defaultValue: "derived from kind" }),
        p("modelVisible", "boolean", "Keeps the action out of the model tool list and snapshot while page code and task steps can still invoke it. This is a visibility boundary, not a permission check.", "让动作不出现在模型工具清单与动作快照中，但页面代码和任务步骤仍可调用。这是可见性边界，不是权限校验。", { defaultValue: "true" }),
        p("params", "ParamDeclaration", "Argument schema and validation; run receives the normalized object.", "参数声明与校验；`run` 收到规整后的参数对象。"),
        p("available", "() => boolean | string", "Precondition check. A string is returned to the model as the unavailability reason.", "前置条件检查。返回字符串时，会作为不可用原因交给模型。"),
        p("expect", "Expectation", "Success criterion checked after run completes.", "`run` 完成后的成功判据。"),
        p("run", "(args: Record<string, unknown>) => unknown", "Validated implementation. Sensitive placeholders are restored before it runs.", "校验后的实现。执行前会还原敏感值代号。", { required: true }),
      ],
    },
    examples: {
      all: [ex("Function action with parameters", "带参数的函数动作", `useAgentTool({\n  id: "set_priority",\n  desc: "设置订单优先级",\n  kind: "write",\n  params: [{ name: "level", label: "优先级", values: ["low", "normal", "high"] }],\n  run: ({ level }) => setPriority(String(level)),\n});`)],
    },
  },

  Expectation: {
    parameters: {
      core: [
        p("desc", "string", "Human-readable statement of the expected outcome. It is included in success and failure receipts.", "对预期结果的人话说明。会出现在成功与失败回执里。"),
        p("check", "() => boolean | Promise<boolean>", "Predicate evaluated after execution. Exceptions remain developer errors and are not swallowed.", "执行后求值的判断函数。函数自身异常会原样抛出，不会被吞掉。", { required: true }),
        p("timeout", "number", "Maximum wait in milliseconds before reporting EXPECTATION_FAILED.", "成立前的最长等待时间；超过后报告 `EXPECTATION_FAILED`。", { defaultValue: "2000" }),
      ],
    },
    examples: {
      core: [ex("Verify a new row exists", "确认新记录真的出现", `const expect = {\n  desc: "新待办出现在列表中",\n  check: () => todos.some((todo) => todo.text === "准备发布"),\n  timeout: 3000,\n};`)],
    },
  },

  HandoffStep: {
    parameters: {
      core: [
        p("text", "string", "Instruction shown to the person who takes over.", "交给接手人看的操作说明。", { required: true }),
        p("highlight", "string", "Optional guide-target id or action id to highlight while the step is active.", "可选的高亮目标：引导目标 id 或动作 id。"),
      ],
    },
    examples: {
      core: [ex("Guide a human step", "引导人工步骤", `const steps = [\n  { text: "填写短信验证码", highlight: "captcha" },\n  { text: "点击提交", highlight: "submit" },\n];`)],
    },
  },

  FlowStep: {
    parameters: {
      core: [
        p("action", "string", "Registered action id to execute. It may contain {{parameter}} placeholders.", "要执行的已注册动作 id，可包含 `{{参数}}` 占位符。", { required: true }),
        p("args", "Record<string, unknown> | ((params) => Record<string, unknown>)", "Step arguments. Strings may reference flow parameters; a function receives the complete parameter object.", "步骤参数。字符串可引用流程参数；函数形式收到完整参数对象。"),
        p("expect", "Expectation", "Overrides the step action's own success criterion.", "覆盖该步骤动作自身声明的成功判据。"),
        p("desc", "string", "Human-readable step description used in progress and receipts.", "用于进度与回执的人话步骤说明。"),
        p("optional", "boolean", "A failed optional step is skipped instead of aborting the flow.", "可选步骤失败时跳过，不中断整个流程。", { defaultValue: "false" }),
        p("idempotent", "boolean", "Allows safe retry after an execution or expectation failure. Pre-execution failures are always retryable.", "允许执行后或判据失败后重试。执行前失败本身就可以重试。", { defaultValue: "false" }),
      ],
    },
    examples: {
      core: [ex("Reference a parameter in a step", "在步骤中引用参数", `const steps = [\n  { action: "edit@order:{{orderId}}", desc: "打开订单" },\n  { action: "dialog_note", args: { text: "{{note}}" }, desc: "填写备注" },\n  { action: "dialog_save", desc: "保存" },\n];`)],
    },
  },

  RegionRole: {
    parameters: {
      core: [p("role", '"page" | "header" | "nav" | "main" | "aside" | "section" | "form" | "dialog" | "toolbar" | "list" | "footer"', "Adds structural context for disambiguating actions with similar names. It does not grant or restrict permissions.", "为同名动作提供结构上下文。它不会授予或限制权限。", { required: true })],
    },
    examples: {
      core: [ex("Disambiguate two confirm buttons", "区分两个确认按钮", `pling.scope(dialog, { id: "edit_dialog", role: "dialog", label: "编辑订单" });\npling.scope(toolbar, { id: "bulk_toolbar", role: "toolbar", label: "批量操作" });`)],
    },
  },

  PlingUiOptions: {
    parameters: { all: uiOptions.map((row) => ({ ...row, name: row.name.replace(/^ui\./, "") })) },
    examples: {
      core: [ex("Chinese UI with a token override", "中文界面与令牌覆盖", `const ui = {\n  locale: "zh-CN",\n  theme: { mode: "light", tokens: { colorPrimary: "#0b6bcb" } },\n  classNames: { dock: "product-assistant" },\n};`)],
    },
  },

  ModelSettingsSetting: {
    parameters: {
      vue3: [
        p("mode", '"off" | "readonly" | "byok"', "Off hides model settings; readonly displays application-managed settings; byok permits user-entered endpoint, model, and key.", "`off` 隐藏模型设置；`readonly` 展示应用托管配置；`byok` 允许用户填写端点、模型和密钥。", { required: true }),
        p("persist", '"memory" | "session"', "For byok, keeps entered settings for the runtime only or in sessionStorage until the tab closes. Storage is never used for application-managed mode.", "`byok` 下，填写的配置只保留在当前运行时，或写入 sessionStorage 直到标签页关闭。应用托管模式不会使用该存储。", { defaultValue: "memory" }),
      ],
      vanilla: [
        p("mode", '"off" | "readonly" | "byok"', "Off hides model settings; readonly displays application-managed settings; byok permits user-entered endpoint, model, and key.", "`off` 隐藏模型设置；`readonly` 展示应用托管配置；`byok` 允许用户填写端点、模型和密钥。", { required: true }),
        p("persist", '"memory" | "session"', "For byok, keeps entered settings for the runtime only or in sessionStorage until the tab closes. Storage is never used for application-managed mode.", "`byok` 下，填写的配置只保留在当前运行时，或写入 sessionStorage 直到标签页关闭。应用托管模式不会使用该存储。", { defaultValue: "memory" }),
      ],
    },
    examples: {
      vue3: [ex("Allow BYOK on a trusted page", "在可信页面允许自带密钥", `createPling({\n  agent: { modelSettings: { mode: "byok", persist: "session" } },\n});`)],
      vanilla: [ex("Allow BYOK on a trusted page", "在可信页面允许自带密钥", `createPling({\n  agent: { modelSettings: { mode: "byok", persist: "session" } },\n});`)],
    },
  },

  AgentRuntimeOptions: {
    parameters: {
      core: [
        p("config", "AgentConfig", "Fully resolved model and runtime configuration.", "已经解析完成的模型与运行时配置。", { required: true }),
        p("registry", "Registry", "Page capability registry. Omit it for a chat-only runtime.", "页面能力注册表。纯聊天运行时可省略。"),
        ...withoutAgentPrefix(agentSetupCommon.filter((row) => row.name !== "agent.config")),
      ],
    },
    examples: {
      core: [ex("Create a page-operating runtime", "创建可操作页面的运行时", `const runtime = createAgentRuntime({\n  config: resolveAgentConfig({ config: { model: "gpt-4.1-mini" } }),\n  registry: pling.registry,\n  hooks,\n  trace: true,\n});`)],
    },
  },

  AgentClock: {
    parameters: {
      core: [
        p("now", "() => Date", "Returns a valid current instant. Re-read before each model request; defaults to the runtime clock. An invalid Date fails before the model request.", "返回有效的当前时刻。每次模型请求前重新读取；默认使用运行环境的时钟。无效日期会阻止模型请求。"),
        p("viewerTimeZone", "string | (() => string)", "IANA timezone used to render the viewer's local time. Defaults to the runtime timezone; server runtimes should supply the authenticated user's timezone.", "用于显示用户本地时间的 IANA 时区。默认使用运行环境时区；服务端应传入已认证用户的时区。"),
        p("businessTimeZone", "string | (() => string)", "IANA timezone used for business dates such as class schedules. Defaults to viewerTimeZone.", "用于排课等业务日期的 IANA 时区。默认沿用 `viewerTimeZone`。"),
      ],
    },
    examples: {
      core: [ex("Configure the shop timezone", "配置门店时区", `createPling({\n  agent: {\n    clock: {\n      businessTimeZone: "Asia/Shanghai",\n    },\n  },\n});`) ],
    },
  },

  ContextOptions: {
    parameters: {
      core: [
        p("maxActions", "number", "Maximum actions rendered in the current page context.", "当前页面上下文中最多列出的动作数。"),
        p("maxRecords", "number", "Maximum record rows rendered in the current page context.", "当前页面上下文中最多列出的记录行数。"),
        p("includeState", "boolean", "Whether read-only page state is included.", "是否附带只读页面状态。"),
        p("maxUnavailable", "number", "Maximum unavailable actions rendered in context.", "上下文中最多列出的不可用动作数。"),
        p("clock", "AgentClock", "Live time and timezone context. When configured here, it is used for each model request.", "每次模型请求使用的实时时间及时区上下文。"),
      ],
    },
    examples: {
      core: [ex("Provide a per-request clock", "为每次请求提供时钟", `createAgentRuntime({\n  config,\n  registry,\n  context: {\n    clock: {\n      viewerTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,\n      businessTimeZone: "Asia/Shanghai",\n    },\n  },\n});`) ],
    },
  },

  AgentConfigOverrides: {
    parameters: {
      core: [
        p("baseUrl", "string", "OpenAI-compatible API root. A relative path such as /llm/v1 routes through the application server and does not require a browser-side key.", "OpenAI 兼容接口根地址。`/llm/v1` 这类相对路径会经过应用服务器，不需要浏览器侧密钥。", { defaultValue: '""' }),
        p("model", "string", "Model name sent to the provider.", "发给模型服务商模型名。", { defaultValue: '""' }),
        p("apiKey", "string", "Browser-visible provider key. Leave empty when using a relative proxy URL.", "浏览器可见的服务商密钥。使用相对代理地址时应留空。", { defaultValue: '""' }),
        p("temperature", "number", "Sampling temperature for model responses.", "模型回答的采样温度。", { defaultValue: "0.3" }),
        p("maxTokens", "number", "Maximum output tokens for one model response. This is not the conversation context budget.", "单次模型响应的最大输出 token。它不是整个对话的上下文预算。", { defaultValue: "1024" }),
        p("systemPrompt", "string", "Application-specific instructions appended after the framework rules. It does not replace the framework rules.", "追加在框架规则之后的应用说明。不会替换框架规则。", { defaultValue: '""' }),
        p("stream", "boolean", "Uses streaming when the provider supports it.", "服务商支持时使用流式响应。", { defaultValue: "true" }),
        p("defaultApproval", '"danger" | "kind"', "Declaration-time approval policy for tools that omit confirm.", "工具未写 `confirm` 时的声明期确认策略。", { defaultValue: '"danger"' }),
        p("minActionIntervalMs", "number", "Minimum delay between actions in the same model turn. Useful when UI transitions need to remain visible.", "同一模型轮次内两个动作之间的最小间隔。需要让界面过渡可见时使用。", { defaultValue: "0" }),
        p("retry.maxRetries", "number", "Additional model-request retries after the first attempt. Valid range is 0–5.", "首次请求之外的重试次数。有效范围 0–5。", { defaultValue: "3" }),
        p("retry.baseDelayMs", "number", "Initial exponential-backoff delay.", "指数退避的初始延迟。", { defaultValue: "500" }),
        p("retry.maxDelayMs", "number", "Maximum delay for one retry.", "单次重试的最大延迟。", { defaultValue: "4000" }),
        p("limits.maxTurns", "number", "Maximum model/tool round trips within one send.", "一次发送内最大的模型/工具往返轮数。", { defaultValue: "10" }),
        p("limits.contextTokens", "number", "Estimated conversation context budget.", "估算的对话上下文预算。", { defaultValue: "8192" }),
        p("limits.reserveForOutput", "number", "Tokens reserved for the model response inside the context budget.", "上下文预算中预留给模型输出的 token。", { defaultValue: "1024" }),
        p("limits.compactRatio", "number", "History is compacted when estimated usage reaches this ratio of the usable budget. Valid range is (0, 1].", "估算用量达到可用预算的该比例时压缩历史。有效范围 `(0, 1]`。", { defaultValue: "0.8" }),
        p("limits.keepRecent", "number", "Recent history entries kept verbatim during compaction.", "压缩历史时原样保留的最近条目数。", { defaultValue: "6" }),
      ],
    },
    examples: {
      core: [ex("Override only the necessary fields", "只覆盖必要的字段", `const config = {\n  model: "gpt-4.1-mini",\n  maxTokens: 1600,\n  limits: { maxTurns: 14, keepRecent: 8 },\n  retry: { maxRetries: 2 },\n};`)],
    },
  },

  HookRegistry: {
    parameters: {
      core: [
        p("addPreToolUse(handler)", "PreToolUseHandler", "Adds a hook before execution. Returns an unsubscribe function. Returning { blocked: true, reason } stops the tool.", "增加执行前钩子，返回移除函数。返回 `{ blocked: true, reason }` 会阻止工具执行。"),
        p("addPostToolUse(handler)", "PostToolUseHandler", "Adds a hook after execution. It may return a replacement ExecResult for later hooks and the caller.", "增加执行后钩子。可返回替换后的 `ExecResult`，供后续钩子与调用方使用。"),
        p("payload.id", "string", "Original page action id.", "页面声明里的原始动作 id。"),
        p("payload.tool", "string", "Model-facing legal tool name.", "发给模型的合法化工具名。"),
        p("payload.args", "Record<string, unknown>", "Validated call arguments.", "校验后的调用参数。"),
        p("payload.turn", "number", "Current model/tool turn.", "当前模型/工具轮次。"),
        p("payload.result", "ExecResult", "Post-hook only: current execution result before this hook runs.", "仅执行后钩子：当前钩子运行前的执行结果。"),
      ],
    },
    examples: {
      core: [ex("Block and rewrite tool results", "拦截并改写工具结果", `const hooks = new HookRegistry();\nhooks.addPreToolUse(({ id }) => id === "delete_all" ? { blocked: true, reason: "批量删除已禁用" } : undefined);\nhooks.addPostToolUse(({ result }) => redactResult(result));`)],
    },
  },

  SessionEvent: {
    parameters: {
      core: [
        p('type: "user"', '{ text: string }', "Echo of the user's input.", "用户输入回显。"),
        p('type: "assistant"', '{ text: string }', "Non-final assistant narration.", "非最终的助手说明。"),
        p('type: "assistant_delta"', '{ text: string }', "Streaming increment, not accumulated text.", "流式增量，不是累计文本。"),
        p('type: "tool_call"', '{ id; tool; args }', "A tool is about to execute.", "工具即将执行。"),
        p('type: "tool_result"', '{ id; tool; result: ExecResult }', "The structured result of a tool call.", "工具调用的结构化结果。"),
        p('type: "blocked"', '{ id; tool; reason }', "A hook blocked the tool before execution.", "钩子在执行前阻止了工具。"),
        p('type: "handoff"', '{ id; tool; status; reason }', "Human handoff requested or resolved.", "人工接力的请求或结果。"),
        p('type: "notice"', '{ text: string }', "Loop-level guidance such as a turn limit or empty response.", "轮数上限、空回复等循环级提示。"),
        p('type: "final"', '{ text: string }', "Final assistant answer for this send.", "本次发送的最终助手回答。"),
        p('type: "cancelled"', "{}", "The user cancelled the run.", "用户取消了本次运行。"),
        p('type: "error"', '{ code; message; messageKey?; params? }', "A loop or model error. code remains the authoritative identifier.", "循环或模型错误。`code` 仍是权威标识。"),
      ],
    },
    examples: {
      core: [ex("Audit the event stream", "审计事件流", `for await (const event of runtime.session.events) {\n  if (event.type === "tool_result") audit(event);\n}`)],
    },
  },

  AgentTraceOptions: {
    parameters: {
      core: [p("maxCalls", "number", "Maximum model calls retained in the in-memory inspector. Omit it to use the default; lower values bound memory in long sessions.", "内存诊断器保留的最大模型调用数。省略时使用默认值；长会话可调低以限制内存。", { defaultValue: "20" })],
    },
    examples: {
      core: [ex("Keep the last eight calls", "只保留最近八次调用", `const trace = { maxCalls: 8 };`)],
    },
  },

  waitFor: {
    parameters: {
      core: [
        p("check", "() => boolean | Promise<boolean>", "Predicate to evaluate. It is checked immediately and then at the configured interval.", "要判断的条件。先立即检查一次，之后按间隔轮询。", { required: true }),
        p("options.timeout", "number", "Maximum wait. Zero checks once without waiting. Timeout returns false rather than throwing.", "最长等待时间。传 `0` 只检查一次。超时返回 `false`，不抛异常。", { defaultValue: "2000" }),
        p("options.interval", "number", "Delay between checks.", "两次检查之间的延迟。", { defaultValue: "30" }),
        p("options.now", "() => number", "Clock injection for deterministic tests.", "供确定性测试注入时钟。"),
        p("options.sleep", "(ms: number) => Promise<void>", "Sleep injection for deterministic tests.", "供确定性测试注入等待函数。"),
        p("options.signal", "AbortSignal", "Cancels the wait and returns false as soon as it is aborted.", "取消等待；一旦中止立即返回 `false`。"),
      ],
    },
    examples: {
      core: [ex("Wait inside a custom runner", "在自定义执行函数中等待", `await waitFor(() => document.querySelector(".saved"), { timeout: 1500 });`)],
    },
  },

  describeFlow: {
    parameters: {
      core: [p("report", "FlowReport", "Result returned by a flow execution. The formatter reports completed, failed, skipped, handoff, and expectation states.", "流程执行返回的结果。格式化后会报告完成、失败、跳过、人工接力与成功判据状态。", { required: true })],
    },
    examples: {
      core: [ex("Render a flow receipt", "渲染流程回执", `const text = describeFlow(result.resume?.report ?? report);`) ],
    },
  },

  AgentDock: {
    parameters: {
      vue3: [
        p("title", "string", "Assistant title. Defaults to the localized catalog value.", "助手标题。默认使用当前语言的文案。"),
        p("placeholder", "string", "Composer placeholder.", "输入框占位文案。"),
        p("emptyHint", "string", "Message shown before the first turn.", "首次对话前显示的空状态提示。"),
        p("quick", "readonly string[]", "Suggested prompts that remain available between runs.", "推荐指令；每次运行结束后仍可继续使用。", { defaultValue: "[]" }),
        p("speakers", "boolean", "Shows a speaker header with name and time above each chat message.", "在每条聊天消息上方显示说话人与时间。", { defaultValue: "true" }),
        p("taskPlacement", '"inline" | "pinned" | "none"', "Keeps the active task above the transcript, in the message flow, or hidden when the host owns all guidance.", "把当前任务固定在滚动消息区上方、放进消息流，或隐藏起来交给宿主自行呈现。", { defaultValue: '"pinned"' }),
        p("defaultOpen", "boolean", "Whether the surface starts open.", "界面是否默认展开。", { defaultValue: "false" }),
        p("config", "AgentConfigOverrides", "Overrides model and runtime settings for this surface only.", "只覆盖当前界面的模型与运行时设置。"),
        p("llm", "Llm", "Injected model function for this surface. Overrides application-level agent.llm.", "当前界面使用的模型函数，覆盖应用级 `agent.llm`。"),
        p("hooks", "HookRegistry", "Tool hooks for this surface. Falls back to application-level hooks.", "当前界面的工具钩子。未传时使用应用级钩子。"),
        p("gate", "() => boolean", "Confirmation-channel switch for this surface.", "当前界面的确认通道开关。"),
        p("registry", "Registry", "Action registry to operate. Defaults to the injected Pling registry.", "要操作的注册表。默认使用注入的 Pling 注册表。"),
        p("navigate", "(href: string) => void", "Navigation implementation after a completed task. Defaults to window.location.replace.", "任务完成后的导航实现。默认调用 `window.location.replace`。"),
        p("layout", '"dock" | "sidebar"', "Floating corner layout or viewport-edge sidebar.", "浮动角落布局或视口侧边栏。", { defaultValue: '"dock"' }),
        p("sidebarMode", '"overlay" | "fused"', "Sidebar layers above the page or participates in the application grid. `fused` is the default; choose `overlay` explicitly. Applies only when layout is sidebar.", "侧栏覆盖页面，或作为应用栅格的一列参与布局。默认 `fused`；需要覆盖页面时显式选择 `overlay`。仅对 `layout=\"sidebar\"` 生效。", { defaultValue: '"fused"' }),
        p("side", '"left" | "right"', "Sidebar edge when layout is sidebar.", "侧边栏模式下的贴边方向。", { defaultValue: '"right"' }),
        p("launcherPlacement", '"bottom" | "center"', "Position of the collapsed sidebar launcher.", "侧边栏收起后启动按钮的位置。", { defaultValue: '"bottom"' }),
        p("launcherLabel", "string", "Custom label for the collapsed launcher.", "收起状态启动按钮的自定义文案。"),
        p("debug", "boolean | AgentTraceOptions", "Enables the read-only request inspector inside Activity. Disabled by default.", "在“运行”中开启只读请求诊断器。默认关闭。", { defaultValue: "false" }),
        p("modelSettings", "ModelSettingsSetting", "Shows application model settings or permits BYOK in Activity.", "在“运行”中展示应用模型配置，或允许用户自带密钥。", { defaultValue: "off" }),
        p(
          "#task",
          "slot",
          "Overrides the task presentation above the transcript. Leave it empty to let the built-in surface render the active guide automatically.",
          "覆盖对话上方的任务展示。留空时由内置界面自动渲染 active 引导。",
        ),
        p("@event", "(event: SessionEvent) => void", "Emitted for every session event.", "每个会话事件触发一次。"),
        p("@open", "(open: boolean) => void", "Emitted when the dock opens or closes.", "浮窗展开或收起时触发。"),
      ],
      react: [
        p("className", "string", "Extra class for the outer shell, commonly used for page-grid sizing.", "外层容器的附加 class，常用于页面网格布局。"),
        p("title", "string", "Assistant title. Defaults to the localized catalog value.", "助手标题。默认使用当前语言的文案。"),
        p("placeholder", "string", "Composer placeholder.", "输入框占位文案。"),
        p("emptyHint", "string", "Message shown before the first turn.", "首次对话前显示的空状态提示。"),
        p("quick", "readonly string[]", "Suggested prompts that remain available between runs.", "推荐指令；每次运行结束后仍可继续使用。", { defaultValue: "[]" }),
        p("defaultOpen", "boolean", "Whether the surface starts open.", "界面是否默认展开。", { defaultValue: "false" }),
        p("config", "AgentConfigOverrides", "Overrides model and runtime settings for this surface only.", "只覆盖当前界面的模型与运行时设置。"),
        p("llm", "Llm", "Injected model function for this surface. Overrides application-level agent.llm.", "当前界面使用的模型函数，覆盖应用级 `agent.llm`。"),
        p("hooks", "HookRegistry", "Tool hooks for this surface. Falls back to application-level hooks.", "当前界面的工具钩子。未传时使用应用级钩子。"),
        p("gate", "() => boolean", "Confirmation-channel switch for this surface.", "当前界面的确认通道开关。"),
        p("registry", "Registry", "Action registry to operate. Defaults to the provider registry.", "要操作的注册表。默认使用 Provider 中的注册表。"),
        p("debug", "boolean | AgentTraceOptions", "Enables the read-only request inspector inside Activity. Disabled by default.", "在“运行”中开启只读请求诊断器。默认关闭。", { defaultValue: "false" }),
        p("onSessionEvent", "(event: SessionEvent) => void", "Receives every session event for audit or custom UI.", "接收每个会话事件，可用于审计或自定义界面。"),
        p("onOpenChange", "(open: boolean) => void", "Called when the dock opens or closes.", "浮窗展开或收起时调用。"),
        p("navigate", "(href: string) => void", "Navigation implementation after a completed task.", "任务完成后的导航实现。", { defaultValue: "window.location.replace" }),
        p("layout", '"dock" | "sidebar" | "inline"', "Floating dock, viewport-edge sidebar, or inline grid surface.", "浮动浮窗、视口侧边栏或内联网格界面。", { defaultValue: '"dock"' }),
        p("sidebarMode", '"overlay" | "fused"', "Sidebar layers above the page or participates in the application grid. `fused` is the default; choose `overlay` explicitly. Applies only when layout is sidebar.", "侧栏覆盖页面，或作为应用栅格的一列参与布局。默认 `fused`；需要覆盖页面时显式选择 `overlay`。仅对 `layout=\"sidebar\"` 生效。", { defaultValue: '"fused"' }),
        p("side", '"left" | "right"', "Sidebar edge when layout is sidebar.", "侧边栏模式下的贴边方向。", { defaultValue: '"right"' }),
        p("launcherPlacement", '"bottom" | "center"', "Position of the collapsed sidebar launcher.", "侧边栏收起后启动按钮的位置。", { defaultValue: '"bottom"' }),
        p("launcherLabel", "string", "Custom label for the collapsed launcher.", "收起状态启动按钮的自定义文案。"),
        p("surfaceId", "string", "Named surface used by pling.ask({ surface }). Built-in docks default to dock.", "供 `pling.ask({ surface })` 路由的具名界面。内置浮窗默认 `dock`。", { defaultValue: '"dock"' }),
        p("task", "ReactNode", "Custom task content rendered above the transcript. React surfaces do not auto-render the Vue guided-task catalog.", "渲染在对话上方的自定义任务内容。React 界面不会自动渲染 Vue 的引导任务目录。"),
        p("ref.open()", "void", "Imperative handle that opens the dock without sending a message.", "命令式句柄：展开浮窗，不发送消息。"),
        p("ref.close()", "void", "Imperative handle that closes the dock while keeping its conversation and active run.", "命令式句柄：收起浮窗，同时保留对话与进行中的任务。"),
        p("ref.send(prompt)", "(prompt: string) => Promise<void>", "Imperative handle that opens the dock and sends a prompt.", "命令式句柄：展开浮窗并发送提示词。"),
        p("ref.ask(prompt, options)", "(prompt: string, options?: PlingAskOptions) => Promise<void>", "Imperative handle with optional named-surface routing.", "命令式句柄，可选择具名界面路由。"),
      ],
    },
    examples: {
      vue3: [ex("One-tag Vue 3 dock", "Vue 3 一行接入", `<AgentDock\n  title="待办助手"\n  :quick="['把第一条待办标记完成']"\n  :debug="true"\n  @event="audit"\n/>`)],
      react: [ex("One-tag React dock", "React 一行接入", `<AgentDock\n  title="待办助手"\n  quick={["把第一条待办标记完成"]}\n  debug\n  onSessionEvent={audit}\n/>`, "tsx")],
    },
  },

  AgentInline: {
    parameters: {
      vue3: [
        p("title", "string", "Assistant title.", "助手标题。"),
        p("placeholder", "string", "Composer placeholder.", "输入框占位文案。"),
        p("emptyHint", "string", "Empty-state copy.", "空状态文案。"),
        p("speakers", "boolean", "Shows a speaker header with name and time above each chat message.", "在每条聊天消息上方显示说话人与时间。", { defaultValue: "true" }),
        p("quick", "readonly string[]", "Suggested prompts.", "推荐指令。", { defaultValue: "[]" }),
        p("config", "AgentConfigOverrides", "Surface-level model overrides.", "当前界面的模型覆盖。"),
        p("llm", "Llm", "Injected model function.", "注入的模型函数。"),
        p("hooks", "HookRegistry", "Surface-level tool hooks.", "当前界面的工具钩子。"),
        p("gate", "() => boolean", "Confirmation-channel switch.", "确认通道开关。"),
        p("registry", "Registry", "Registry to operate.", "要操作的注册表。"),
        p("navigate", "(href: string) => void", "Post-task navigation implementation.", "任务完成后的导航实现。"),
        p("visible", "boolean", "Controls visibility without unmounting, so conversation state survives collapse.", "控制是否可见但不卸载，从而保留对话状态。", { defaultValue: "true" }),
        p("variant", '"dock" | "inline"', "Compact dock width or a normal inline layout.", "使用紧凑浮窗宽度或常规内联布局。", { defaultValue: '"inline"' }),
        p("composer", '"compact" | "multiline"', "Composer density. `multiline` is the default two-line textarea that grows upward; `compact` keeps the single-line input for space-constrained hosts.", "输入区密度。默认 `multiline`，即两行起步、自动增高的文本域；空间紧张时可用 `compact` 保持单行输入。", { defaultValue: '"multiline"' }),
        p("taskPlacement", '"inline" | "pinned" | "none"', "Keeps the active guide above the scrolling transcript, in the message flow, or hidden when the host owns all guidance.", "把当前引导固定在滚动消息区上方、放进消息流，或隐藏起来交给宿主自行呈现。", { defaultValue: '"pinned"' }),
        p("guidePlacement", '"top" | "end"', "Renders the `#guide` slot above the transcript or as the newest message in the conversation. Use `end` for a live next-step prompt.", "把 `#guide` 插槽渲染在对话上方，或作为会话中的最新消息。需要持续更新的下一步提示时用 `end`。", { defaultValue: '"top"' }),
        p("manageSurface", "boolean", "Registers this component with the page task router. Docks set it to false because the shell owns routing.", "把组件注册到页面任务路由器。浮窗外壳自己负责路由，因此传 `false`。", { defaultValue: "true" }),
        p("surfaceId", "string", "Task-routing name when manageSurface is enabled.", "启用 `manageSurface` 时用于任务路由的名称。", { defaultValue: '"inline"' }),
        p("collapsible", "boolean", "Shows the collapse control used by the dock shell.", "显示浮窗外壳使用的收起按钮。", { defaultValue: "false" }),
        p("debug", "boolean | AgentTraceOptions", "Enables the read-only request inspector.", "开启只读请求诊断器。", { defaultValue: "false" }),
        p("modelSettings", "ModelSettingsSetting", "Model settings entry in Activity.", "“运行”中的模型设置入口。", { defaultValue: "off" }),
        p("beforeSend", "AgentBeforeSendHandler", "Optional escape hatch for a page that can answer without the model. Return `{ handled: true, reply }` to update page state and reply immediately. Prefer model-driven task tools for natural-language intake and corrections; reserve this hook for narrow, deterministic commands whose meaning is unambiguous.", "可选的本地响应逃生口：页面无需模型即可回答时，返回 `{ handled: true, reply }` 直接更新页面状态并回复。自然语言录入与修正应优先交给模型驱动的任务工具；这个钩子只用于含义明确、范围很窄的确定性命令。"),
        p("#task", "slot", "Overrides the task presentation above the transcript. Built-in Vue surfaces render the active guide here by default.", "覆盖对话上方的任务展示。Vue 内置界面默认在这里渲染 active 引导。"),
        p("#guide", "slot", "Guidance content for the next-step prompt and its actions. Placement follows `guidePlacement`.", "下一步提示与操作的引导内容，位置由 `guidePlacement` 决定。"),
        p("#nav-actions", "slot", "Header toolbar content rendered before the built-in clear and collapse controls. Use it for page-scoped actions such as the current task menu.", "标题栏工具栏内容，渲染在内置的清空与收起按钮之前。适合放当前任务菜单等页面级操作。"),
        p("@event", "(event: SessionEvent) => void", "Session event stream.", "会话事件流。"),
        p("@collapse", "() => void", "Requests that the parent shell collapse the surface.", "请求父级外壳收起界面。"),
        p("@status", "(status: { running; resume }) => void", "Reports running state and resume availability.", "报告运行状态与是否有可恢复任务。"),
        p("ref.say(text)", "(text: string) => void", "Appends a local assistant message to the transcript and model history without calling the model. Useful after a human action such as a file upload.", "把一条本地助手消息追加到对话和模型历史，不调用模型。适合用户完成上传等人工操作后播报结果。"),
      ],
      react: [
        p("className", "string", "Extra class for the grid surface.", "内联网格界面的附加 class。"),
        p("title", "string", "Assistant title.", "助手标题。"),
        p("placeholder", "string", "Composer placeholder.", "输入框占位文案。"),
        p("emptyHint", "string", "Empty-state copy.", "空状态文案。"),
        p("quick", "readonly string[]", "Suggested prompts.", "推荐指令。"),
        p("config", "AgentConfigOverrides", "Surface-level model overrides.", "当前界面的模型覆盖。"),
        p("llm", "Llm", "Injected model function.", "注入的模型函数。"),
        p("hooks", "HookRegistry", "Surface-level tool hooks.", "当前界面的工具钩子。"),
        p("gate", "() => boolean", "Confirmation-channel switch.", "确认通道开关。"),
        p("registry", "Registry", "Registry to operate.", "要操作的注册表。"),
        p("debug", "boolean | AgentTraceOptions", "Enables the read-only request inspector.", "开启只读请求诊断器。"),
        p("onSessionEvent", "(event: SessionEvent) => void", "Session event callback.", "会话事件回调。"),
        p("navigate", "(href: string) => void", "Post-task navigation implementation.", "任务完成后的导航实现。"),
        p("surfaceId", "string", "Task-routing name. Inline surfaces default to inline.", "任务路由名称。内联界面默认 `inline`。", { defaultValue: '"inline"' }),
        p("task", "ReactNode", "Custom task content rendered above the transcript. React surfaces do not auto-render the Vue guided-task catalog.", "渲染在对话上方的自定义任务内容。React 界面不会自动渲染 Vue 的引导任务目录。"),
      ],
    },
    examples: {
      vue3: [ex("Reserve a workbench column", "为工作台预留一列", `<div class="workspace">\n  <main>...</main>\n  <AgentInline title="操作助手" />\n</div>`)],
      react: [ex("Reserve a workbench column", "为工作台预留一列", `<div className="workspace">\n  <main>...</main>\n  <AgentInline title="操作助手" />\n</div>`, "tsx")],
    },
  },

  AgentChat: {
    parameters: {
      vue3: [
        p("title", "string", "Chat header title.", "对话标题。"),
        p("events", "readonly SessionEvent[]", "Event transcript to render.", "要渲染的会话事件。", { defaultValue: "[]" }),
        p("running", "boolean", "Disables input and shows the running state.", "禁用输入并显示运行状态。", { defaultValue: "false" }),
        p("pending", "PendingApproval | null", "Current approval request.", "当前确认请求。", { defaultValue: "null" }),
        p("pendingHandoff", "PendingHandoff | null", "Current human-handoff request.", "当前人工接力请求。"),
        p("placeholder", "string", "Composer placeholder.", "输入框占位文案。"),
        p("emptyHint", "string", "Empty-state copy.", "空状态文案。"),
        p("speakers", "boolean", "Shows a speaker header with name and time above each chat message.", "在每条聊天消息上方显示说话人与时间。", { defaultValue: "true" }),
        p("tools", "boolean", "Includes raw tool-call lines in the transcript.", "在对话中显示原始工具调用行。", { defaultValue: "false" }),
        p("reveal", "(text: string) => string", "Render-only text transform, commonly used to reveal sensitive tokens.", "仅用于渲染的文本转换，常用于还原敏感值代号。"),
        p("resume", "{ goal?: string; interrupted?: boolean } | null", "Shows the continue-previous-task banner.", "显示“继续上次任务”提示。", { defaultValue: "null" }),
        p("multiline", "boolean", "Renders a two-line textarea that grows upward. Enter sends and Shift+Enter inserts a newline.", "渲染两行起步、自动增高的文本域。Enter 发送，Shift+Enter 换行。", { defaultValue: "true" }),
        p("taskPlacement", '"inline" | "pinned" | "none"', "Keeps the task slot above the scrolling transcript, in the message flow, or hidden when the host owns all guidance.", "把任务插槽固定在滚动消息区上方、放进消息流，或隐藏起来交给宿主自行呈现。", { defaultValue: '"pinned"' }),
        p("hasTask", "boolean", "Whether the task slot currently has content. Set it to false while no guide is active so a pinned task area does not reserve blank space.", "任务插槽当前是否有内容。没有活动引导时设为 `false`，避免固定任务区留下空白。", { defaultValue: "true" }),
        p("guidePlacement", '"top" | "end"', "Renders the guide slot above the transcript or after the latest message.", "把引导插槽渲染在对话上方，或放在最新消息之后。", { defaultValue: '"top"' }),
        p("@send", "(text: string) => void", "User submitted a message.", "用户提交消息。"),
        p("@reply", '(decision: boolean | "always") => void', "User answered an approval request.", "用户回答了确认请求。"),
        p("@handoff", "(done: boolean) => void", "User completed or cancelled a handoff.", "用户完成或取消人工接力。"),
        p("@handoffStep", "(delta: number) => void", "User moved between handoff steps.", "用户切换人工接力步骤。"),
        p("#task", "slot", "Custom task content above the transcript. AgentInline supplies the active guide automatically for built-in surfaces.", "对话上方的自定义任务内容。内置界面会由 `AgentInline` 自动提供 active 引导。"),
        p("#guide", "slot", "Guidance content for the next-step prompt and its actions. Placement follows `guidePlacement`.", "下一步提示与操作的引导内容，位置由 `guidePlacement` 决定。"),
        p("#footer", "slot", "Additional content rendered above the composer.", "渲染在输入框上方的附加内容。"),
      ],
      react: [
        p("title", "string", "Chat header title.", "对话标题。"),
        p("events", "readonly SessionEvent[]", "Event transcript to render.", "要渲染的会话事件。", { defaultValue: "[]" }),
        p("running", "boolean", "Disables input and shows the running state.", "禁用输入并显示运行状态。", { defaultValue: "false" }),
        p("pending", "PendingApproval | null", "Current approval request.", "当前确认请求。", { defaultValue: "null" }),
        p("pendingHandoff", "PendingHandoff | null", "Current human-handoff request.", "当前人工接力请求。"),
        p("placeholder", "string", "Composer placeholder.", "输入框占位文案。"),
        p("emptyHint", "string", "Empty-state copy.", "空状态文案。"),
        p("speakers", "boolean", "Shows a speaker header with name and time above each chat message.", "在每条聊天消息上方显示说话人与时间。", { defaultValue: "true" }),
        p("showHeader", "boolean", "Keeps the standalone title and running header. Workspace shells hide it because the shell owns navigation.", "保留独立对话的标题与运行状态栏。工作台外壳自行管理导航时可隐藏。", { defaultValue: "true" }),
        p("multiline", "boolean", "Renders a two-line auto-growing textarea. Set it to false only for a space-constrained host.", "渲染两行起步、自动增高的文本域。只有在宿主空间非常紧张时才设为 `false`。", { defaultValue: "true" }),
        p("taskPlacement", '"inline" | "pinned"', "Keeps task content above the scrolling transcript, or in the message flow when history should read as one sequence.", "把任务内容固定在滚动消息区上方；需要让历史保持单一顺序时可改为消息流内。", { defaultValue: '"pinned"' }),
        p("quick", "readonly QuickTaskItem[]", "Suggested prompts shown only while the transcript is empty. Strings are accepted and normalized.", "只在对话为空时显示的推荐指令。字符串会被自动规范化。", { defaultValue: "[]" }),
        p("ui", "PlingUiController", "Locale and theme controller. Defaults to an English standalone controller.", "语言与主题控制器。默认使用英文独立控制器。"),
        p("className", "string", "Extra class for the outer chat surface.", "外层对话界面的附加 class。"),
        p("task", "ReactNode", "Custom task content above the transcript by default. With `taskPlacement=\"inline\"`, it replaces the empty state in the message flow.", "默认渲染在对话上方的自定义任务内容。设为 `taskPlacement=\"inline\"` 时会进入消息流，并替代空状态。"),
        p("tools", "boolean", "Includes raw tool-call lines in the transcript.", "在对话中显示原始工具调用行。", { defaultValue: "false" }),
        p("reveal", "(text: string) => string", "Render-only text transform.", "仅用于渲染的文本转换。"),
        p("resume", "{ goal?: string; interrupted?: boolean } | null", "Shows the continue-previous-task banner.", "显示“继续上次任务”提示。", { defaultValue: "null" }),
        p("actions", "ReactNode", "Toolbar content in the header.", "标题栏中的工具栏内容。"),
        p("footer", "ReactNode", "Content rendered above the composer.", "渲染在输入框上方的附加内容。"),
        p("onSend", "(text: string) => void", "User submitted a message.", "用户提交消息。"),
        p("onReply", '(decision: boolean | "always") => void', "User answered an approval request.", "用户回答了确认请求。"),
        p("onHandoff", "(done: boolean) => void", "User completed or cancelled a handoff.", "用户完成或取消人工接力。"),
        p("onHandoffStep", "(delta: number) => void", "User moved between handoff steps.", "用户切换人工接力步骤。"),
        p("onResume", "() => void", "User accepted the resume banner.", "用户接受继续任务提示。"),
        p("onDismissResume", "() => void", "User dismissed the resume banner.", "用户关闭继续任务提示。"),
        p("onStop", "() => void", "User requested cancellation while running.", "运行中用户请求取消。"),
      ],
    },
    examples: {
      vue3: [ex("Render an externally managed chat", "渲染外部接线的对话", `<AgentChat\n  :events="events"\n  :running="running"\n  :pending="pending"\n  @send="send"\n  @reply="reply"\n/>`)],
      react: [ex("Render an externally managed chat", "渲染外部接线的对话", `<AgentChat\n  events={events}\n  running={running}\n  pending={pending}\n  onSend={send}\n  onReply={reply}\n/>`, "tsx")],
    },
  },

  AgentPanel: {
    parameters: {
      vue3: [
        p("title", "string", "Panel title. Defaults to the localized panel title.", "面板标题。默认使用当前语言的文案。"),
        p("policy", "Policy", "Permission policy used by the panel's manual execution controls. Defaults to auto-approve for debugging only.", "面板手动执行控件使用的权限策略。默认自动批准，仅适合调试。"),
        p("@executed", "(event: ExecutedEvent) => void", "Emitted after an action is executed from the panel.", "从面板执行动作后触发。"),
        p("#compose", "{ execute, snapshot }", "Slot that exposes the panel executor and current snapshot for custom controls.", "暴露面板执行器与当前快照的插槽，用于自定义控件。"),
      ],
    },
    examples: {
      vue3: [ex("Inspect declarations and coverage", "查看声明与覆盖率", `<AgentPanel @executed="audit" />`)],
    },
  },

  AgentDebug: {
    parameters: {
      all: [
        p("runtime", "AgentRuntime", "The runtime that is already driving the current conversation. The component never creates a second runtime.", "已经驱动当前对话的运行时。组件不会创建第二个运行时。", { required: true }),
        p("registry", "Registry", "Registry whose snapshot and coverage should be inspected.", "要查看快照与覆盖率的注册表。", { required: true }),
      ],
    },
    examples: {
      react: [ex("Inspect the active conversation", "查看当前对话", `<AgentDebug runtime={runtime} registry={pling.registry} />`, "tsx")],
    },
  },

  VanillaDock: {
    parameters: {
      all: [
        p("title", "string", "Assistant title.", "助手标题。"),
        p("placeholder", "string", "Composer placeholder.", "输入框占位文案。"),
        p("emptyHint", "string", "Empty-state copy.", "空状态文案。"),
        p("quick", "readonly string[]", "Suggested prompts.", "推荐指令。"),
        p("defaultOpen", "boolean", "Whether the dock starts open.", "浮窗是否默认展开。", { defaultValue: "false" }),
        p("config", "AgentConfigOverrides", "Dock-level model overrides.", "浮窗级模型覆盖。"),
        p("llm", "Llm", "Injected model function.", "注入的模型函数。"),
        p("hooks", "HookRegistry", "Dock-level tool hooks.", "浮窗级工具钩子。"),
        p("gate", "() => boolean", "Confirmation-channel switch.", "确认通道开关。"),
        p("registry", "Registry", "Registry to operate. Defaults to this Pling instance.", "要操作的注册表。默认使用当前 Pling 实例的注册表。"),
        p("onSessionEvent", "(event: SessionEvent) => void", "Session event callback.", "会话事件回调。"),
        p("onOpenChange", "(open: boolean) => void", "Called when the dock opens or closes.", "浮窗展开或收起时调用。"),
        p("navigate", "(href: string) => void", "Post-task navigation implementation.", "任务完成后的导航实现。", { defaultValue: "window.location.replace" }),
        p("surfaceId", "string", "Surface id registered with the task router so pling.ask({ surface }) can target this dock.", "注册到任务路由的界面 id，使 `pling.ask({ surface })` 能定位这个浮窗。", { defaultValue: '"dock"' }),
        p("layout", '"dock" | "sidebar" | "inline"', "Floating corner, viewport-edge sidebar, or a permanently visible panel mounted in the page.", "浮动角落、贴边侧边栏，或固定在页面中的常驻面板。", { defaultValue: '"dock"' }),
        p("sidebarMode", '"overlay" | "fused"', "Sidebar layers above the page or participates in the application grid. `fused` is the default; choose `overlay` explicitly. Applies only when layout is sidebar.", "侧栏覆盖页面，或作为应用栅格的一列参与布局。默认 `fused`；需要覆盖页面时显式选择 `overlay`。仅对 `layout=\"sidebar\"` 生效。", { defaultValue: '"fused"' }),
        p("side", '"left" | "right"', "Sidebar edge when layout is sidebar.", "侧边栏模式下的贴边方向。", { defaultValue: '"right"' }),
        p("launcherPlacement", '"bottom" | "center"', "Position of the collapsed sidebar launcher.", "侧边栏收起后启动按钮的位置。", { defaultValue: '"bottom"' }),
        p("launcherLabel", "string", "Custom label for the closed launcher.", "收起状态启动按钮的自定义文案。"),
        p("mount", "Element", "Mount target for the assistant shell. Defaults to document.body.", "助手外壳的挂载目标。默认挂到 `document.body`。", { defaultValue: "document.body" }),
        p("task", "HTMLElement | (() => HTMLElement | null)", "Guided task card or task host rendered inside the conversation transcript. Return the same card from createTaskCard().", "渲染在对话消息流里的任务卡或任务宿主。通常传入 `createTaskCard()` 返回的 `element`。"),
        p("debug", "boolean | AgentTraceOptions", "Shows the read-only request inspector in the Activity tab and bounds retained calls.", "在“运行”页签显示只读请求检查器，并限制保留的调用数。", { defaultValue: "false" }),
        p("modelSettings", "ModelSettingsSetting", "Shows application-managed settings or permits BYOK in the Activity tab.", "在“运行”页签展示应用托管配置，或允许用户自带密钥。", { defaultValue: '"off"' }),
        p("return.element", "HTMLElement", "Root element owned by the dock.", "浮窗持有的根元素。"),
        p("return.runtime", "AgentRuntime", "Runtime driving the dock conversation.", "驱动浮窗对话的运行时。"),
        p("return.open()", "void", "Opens the dock.", "展开浮窗。"),
        p("return.close()", "void", "Closes the dock while preserving its conversation.", "收起浮窗并保留对话。"),
        p("return.toggle()", "void", "Toggles the open state.", "切换展开状态。"),
        p("return.isOpen()", "boolean", "Returns the current open state.", "返回当前展开状态。"),
        p("return.destroy()", "void", "Removes the dock and releases its runtime resources.", "移除浮窗并释放其运行时资源。"),
      ],
    },
    examples: {
      all: [ex("Mount and control the native dock", "挂载并控制原生浮窗", `const dock = pling.dock({\n  title: "待办助手",\n  defaultOpen: false,\n  onOpenChange: (open) => console.log(open),\n});\n\n// Later:\ndock.open();\n// On teardown:\ndock.destroy();`)],
    },
  },

  useSurfaceGateway: {
    parameters: {
      vue3: [
        p("app", "string", "Stable application name sent in the bridge hello.", "桥接 hello 中发送的稳定应用名。", { required: true }),
        p("expose", "SurfaceExpose", "Explicit capability allowlist. The composable never infers capabilities from the DOM or registry.", "显式能力 allowlist。组合式函数不会从 DOM 或注册表自动推断能力。", { required: true }),
        p("mode", '"public-demo" | "bff"', 'public-demo creates a page session from the browser and may show an Agent token. bff requires getPageSession and must be backed by an authenticated application server.', "`public-demo` 在浏览器创建页面会话并可展示 Agent token；`bff` 必须提供 `getPageSession`，由已认证的应用后端创建页面会话。", { required: true }),
        p("gatewayUrl", "string", "Gateway origin for public-demo mode, for example https://surface.example.com.", "`public-demo` 模式的网关源，例如 `https://surface.example.com`。"),
        p("getPageSession", "() => Promise<SurfacePageSession>", "Required in bff mode. The application server verifies the user session and returns only a short-lived page session.", "`bff` 模式必填。应用服务端验证用户会话后，只返回短时页面会话。"),
        p("gatewayClient", "SurfaceGatewayClient", "Injected HTTP client for tests or a custom BFF contract.", "用于测试或自定义 BFF 契约的 HTTP 客户端。"),
        p("approval", "SurfaceApprovalSource & { confirm?: Confirm }", "Human approval source. Its subscribe callback relays pending state; the page still owns the decision UI.", "真人审批来源。它订阅并转发待审批状态；决定界面仍归页面所有。"),
        p("confirm", "Confirm | null", "Confirmation function used by the Surface executor. Defaults to approval.confirm, then null (fail closed).", "Surface 执行器使用的确认函数。默认取 `approval.confirm`，否则为 `null`（fail-closed）。"),
        p("autoConnect", "boolean", "Connects when the component mounts. Set false when the host owns an explicit connect button.", "组件挂载时自动连接。传 `false` 时由宿主提供显式连接按钮。", { defaultValue: "true" }),
        p("autoClaim", "boolean", "Claims an Agent token automatically. Defaults to true only in public-demo mode.", "是否自动申领 Agent token。仅在 `public-demo` 模式下默认开启。", { defaultValue: "true (public-demo only)" }),
        p("agentId", "string", "Agent id recorded when claiming a public-demo pairing.", "申领公开演示配对时记录的 Agent id。"),
        p("tenantId", "string", "Optional tenant hint for the public-demo page-session endpoint.", "公开演示页面会话端点的可选租户提示。"),
        p("clientKey", "string", "Optional client hint for the public-demo page-session endpoint.", "公开演示页面会话端点的可选客户端提示。"),
        p("reconnectMs", "number", "Delay before reconnecting the page WebSocket.", "页面 WebSocket 重连延迟。", { defaultValue: "1500" }),
        p("webSocket", "SurfaceWebSocketFactory", "WebSocket implementation injection for tests or non-browser hosts.", "供测试或非浏览器宿主注入的 WebSocket 实现。"),
        p("surface", "Partial<CreatePlingSurfaceOptions>", "Extra Surface options such as recordLimit, rateLimit, replay, audit, or custom settle.", "额外的 Surface 选项，例如 `recordLimit`、`rateLimit`、`replay`、审计或自定义落定等待。"),
      ],
    },
    examples: {
      vue3: [
        ex("Public demo with an explicit allowlist", "公开演示：显式能力清单", `const gateway = useSurfaceGateway({\n  app: "orders",\n  expose: ["orders.overview", "orders.update_note"],\n  mode: "public-demo",\n  gatewayUrl: "https://surface.example.com",\n  approval,\n});\n\nconst surface = computed(() => gateway.surface.value);`),
        ex("Production BFF session", "生产 BFF 会话", `const gateway = useSurfaceGateway({\n  app: "orders",\n  expose: ["orders.overview", "orders.update_note"],\n  mode: "bff",\n  getPageSession: async () => {\n    const response = await fetch("/api/surface/page-session", { method: "POST" });\n    if (!response.ok) throw new Error("Surface session unavailable");\n    return response.json();\n  },\n  approval,\n});`),
      ],
    },
  },

  SurfaceAccessPanel: {
    parameters: {
      vue3: [
        p("gateway", "SurfaceGatewayController", "Controller returned by useSurfaceGateway. The component renders its state but never creates capabilities or tokens by itself.", "`useSurfaceGateway` 返回的控制器。组件只渲染其状态，不会自行创建能力或 token。", { required: true }),
        p("title", "string", "Panel title. Defaults to the localized External Agent label.", "面板标题。默认使用当前语言的“外部 Agent”文案。"),
      ],
    },
    examples: {
      vue3: [ex("Render the optional access panel", "渲染可选的访问面板", `<SurfaceAccessPanel :gateway="gateway" title="外部 Agent" />`)],
    },
  },

  createSurfaceGateway: {
    parameters: {
      vanilla: [
        p("app", "string", "Stable application name sent in the bridge hello.", "桥接 hello 中发送的稳定应用名。", { required: true }),
        p("expose", "SurfaceExpose", "Explicit capability allowlist. The adapter never infers capabilities from the DOM or registry.", "显式能力 allowlist。适配器不会从 DOM 或注册表自动推断能力。", { required: true }),
        p("mode", '"public-demo" | "bff"', "public-demo creates a page session from the browser; bff requires getPageSession backed by the application server.", "`public-demo` 在浏览器创建页面会话；`bff` 必须提供由应用服务端支撑的 `getPageSession`。", { required: true }),
        p("gatewayUrl", "string", "Gateway origin for public-demo mode.", "`public-demo` 模式的网关源。"),
        p("getPageSession", "() => Promise<SurfacePageSession>", "Required in bff mode. The server verifies the user session and returns a short-lived page session.", "`bff` 模式必填。服务端验证用户会话后返回短时页面会话。"),
        p("gatewayClient", "SurfaceGatewayClient", "Injected HTTP client for tests or a custom BFF contract.", "用于测试或自定义 BFF 契约的 HTTP 客户端。"),
        p("approval", "SurfaceApprovalSource & { confirm?: Confirm }", "Human approval source shared with the Surface bridge.", "与 Surface 桥接共享的真人审批来源。"),
        p("confirm", "Confirm | null", "Confirmation function used by the Surface executor. Defaults to approval.confirm, then null (fail closed).", "Surface 执行器使用的确认函数。默认取 `approval.confirm`，否则为 `null`（fail-closed）。"),
        p("autoConnect", "boolean", "Connects immediately when true.", "为 `true` 时立即连接。", { defaultValue: "true" }),
        p("autoClaim", "boolean", "Claims an Agent token automatically. Defaults to true only in public-demo mode.", "是否自动申领 Agent token。仅在 `public-demo` 模式下默认开启。", { defaultValue: "true (public-demo only)" }),
        p("agentId", "string", "Agent id recorded when claiming a public-demo pairing.", "申领公开演示配对时记录的 Agent id。"),
        p("tenantId", "string", "Optional tenant hint for the public-demo page-session endpoint.", "公开演示页面会话端点的可选租户提示。"),
        p("clientKey", "string", "Optional client hint for the public-demo page-session endpoint.", "公开演示页面会话端点的可选客户端提示。"),
        p("reconnectMs", "number", "Delay before reconnecting the page WebSocket.", "页面 WebSocket 重连延迟。", { defaultValue: "1500" }),
        p("webSocket", "SurfaceWebSocketFactory", "WebSocket implementation injection for tests or non-browser hosts.", "供测试或非浏览器宿主注入的 WebSocket 实现。"),
        p("surface", "Omit<CreatePlingSurfaceOptions, \"app\" | \"expose\" | \"confirm\" | \"session\">", "Extra Surface options such as recordLimit, rateLimit, replay, audit, or custom settle.", "额外的 Surface 选项，例如 `recordLimit`、`rateLimit`、`replay`、审计或自定义落定等待。"),
      ],
    },
    examples: {
      vanilla: [
        ex("Public demo with an explicit allowlist", "公开演示：显式能力清单", `const gateway = pling.surfaceGateway({\n  app: "orders",\n  expose: ["orders.overview", "orders.update_note"],\n  mode: "public-demo",\n  gatewayUrl: "https://surface.example.com",\n});`),
        ex("Production BFF session", "生产 BFF 会话", `const gateway = pling.surfaceGateway({\n  app: "orders",\n  expose: ["orders.overview", "orders.update_note"],\n  mode: "bff",\n  getPageSession: async () => {\n    const response = await fetch("/api/surface/page-session", { method: "POST" });\n    if (!response.ok) throw new Error("Surface session unavailable");\n    return response.json();\n  },\n});`),
      ],
    },
  },

  createSurfaceAccessPanel: {
    parameters: {
      vanilla: [
        p("gateway", "VanillaSurfaceGateway", "Controller returned by pling.surfaceGateway(). The panel renders its state but never creates capabilities or tokens by itself.", "`pling.surfaceGateway()` 返回的控制器。面板只渲染其状态，不会自行创建能力或 token。", { required: true }),
        p("title", "string", "Panel title. Defaults to the localized External Agent label.", "面板标题。默认使用当前语言的“外部 Agent”文案。"),
        p("ui", "PlingUiController", "Optional UI controller for locale, theme, and shared class names.", "可选的界面控制器，用于语言、主题与共享类名。"),
        p("mount", "Element", "Mount target. When omitted, the caller mounts the returned element.", "挂载目标。省略时由调用方自行挂载返回元素。"),
      ],
    },
    examples: {
      vanilla: [ex("Render the access panel", "渲染访问面板", `const panel = createSurfaceAccessPanel(gateway, { mount: document.querySelector("#access") });\n\n// On teardown:\npanel.destroy();`)],
    },
  },

  createPlingUi: {
    parameters: {
      vue3: [
        ...uiOptions.map((row) => ({ ...row, name: row.name.replace(/^ui\./, "") })),
        p("defaultLocale", "string", "Fallback locale used when ui.locale is not supplied.", "未传 `ui.locale` 时使用的兜底语言。", { defaultValue: "en-US" }),
      ],
      vanilla: [
        ...uiOptions.map((row) => ({ ...row, name: row.name.replace(/^ui\./, "") })),
        p("defaultLocale", "string", "Fallback locale used when ui.locale is not supplied.", "未传 `ui.locale` 时使用的兜底语言。", { defaultValue: "en-US" }),
      ],
    },
    examples: {
      vue3: [ex("Create a standalone UI controller", "创建独立界面控制器", `const ui = createPlingUi({ locale: "zh-CN", theme: "auto" });\nui.setTheme("dark");\nconsole.log(ui.t("chat.send"));`)],
      vanilla: [ex("Create a standalone UI controller", "创建独立界面控制器", `const ui = createPlingUi({ locale: "zh-CN", theme: "auto" });\nui.setTheme("dark");\nconsole.log(ui.t("chat.send"));`)],
    },
  },

  PageOptions: {
    parameters: {
      vue3: [
        p("enabled", "boolean", "Enables page identity collection. createPling({ page: false }) is the shorthand for disabling it.", "开启页面身份收集。`createPling({ page: false })` 是关闭它的简写。", { defaultValue: "true" }),
        p("router", "PageRouterLike", "Vue Router-like object that supplies route name, params, hash, and meta.title. If omitted, the adapter tries $router after mount.", "提供路由名称、参数、hash 与 `meta.title` 的 Vue Router 风格对象。省略时，适配器在挂载后尝试读取 `$router`。"),
        p("queryKeys", "readonly string[]", "Allowlist of query parameters exposed to the model. Query parameters are hidden by default.", "允许进入模型上下文的查询参数白名单。查询参数默认全部隐藏。", { defaultValue: "[]" }),
        p("hash", "boolean", "Includes safe hash fragments. Hash values that resemble query strings are ignored.", "是否包含安全的 hash 片段。看起来像查询串的 hash 会被忽略。", { defaultValue: "true" }),
        p("title", "() => string | undefined", "Title override or fallback. It takes precedence over route meta.title and document.title.", "标题覆盖或兜底值。优先于路由 `meta.title` 与 `document.title`。"),
      ],
      vanilla: [
        p("enabled", "boolean", "Enables page identity collection. createPling({ page: false }) is the shorthand for disabling it.", "开启页面身份收集。`createPling({ page: false })` 是关闭它的简写。", { defaultValue: "true" }),
        p("router", "PageRouterLike", "Router-like object that supplies currentRoute name, params, hash, and meta.title. Vanilla does not discover a router implicitly.", "提供 `currentRoute` 名称、参数、hash 与 `meta.title` 的路由式对象。原生适配器不会隐式发现路由器。"),
        p("queryKeys", "readonly string[]", "Allowlist of query parameters exposed to the model. Query parameters are hidden by default.", "允许进入模型上下文的查询参数白名单。查询参数默认全部隐藏。", { defaultValue: "[]" }),
        p("hash", "boolean", "Includes safe hash fragments. Hash values that resemble query strings are ignored.", "是否包含安全的 hash 片段。看起来像查询串的 hash 会被忽略。", { defaultValue: "true" }),
        p("title", "() => string | undefined", "Title override or fallback. It takes precedence over route meta.title and document.title.", "标题覆盖或兜底值。优先于路由 `meta.title` 与 `document.title`。"),
      ],
    },
    examples: {
      vue3: [ex("Expose route identity without tokens", "暴露路由身份但不暴露令牌", `createPling({\n  page: {\n    queryKeys: ["tab"],\n    title: () => route.meta.title as string | undefined,\n  },\n});`)],
      vanilla: [ex("Expose route identity without tokens", "暴露路由身份但不暴露令牌", `createPling({\n  page: {\n    queryKeys: ["tab"],\n    router: { currentRoute },\n  },\n});`)],
    },
  },

  PlingPage: {
    parameters: {
      core: [
        p("registry", "Registry", "Shared action, record, state, and feedback registry.", "共享的动作、记录、状态与反馈注册表。"),
        p("scopes", "ScopeController", "Shared region visibility and occlusion controller.", "共享的区域可见性与遮挡控制器。"),
        p("feedback", "FeedbackCollector", "Page-level feedback collector that observes the document once.", "每个页面只观察一次文档的反馈收集器。"),
        p("destroy()", "void", "Stops page observers and clears automatic scopes. Adapters should destroy their declarations first.", "停止页面观察器并清空自动区域。适配器应先释放自己的声明。"),
      ],
    },
    examples: {
      core: [ex("Share one page runtime", "共享一个页面运行时", `const page = createPlingPage();\nconst vuePling = createPling({ shared: page });\nconst reactPling = createPling({ shared: page });`)],
    },
  },

  createPlingPage: {
    parameters: {
      core: [
        p("options.registry", "Registry", "Existing registry to share. A new registry is created when omitted.", "要共享的已有注册表。省略时新建一个。"),
        p("options.scopes", "ScopeControllerOptions", "Visibility and hit-testing overrides for the shared page.", "共享页面的可见性与命中测试覆盖项。"),
      ],
    },
    examples: {
      core: [ex("Create a mixed-framework page runtime", "创建混合框架页面运行时", `const page = createPlingPage();\n\n// Pass the same page to Vue, React, or Vanilla islands:\nconst pling = createPling({ shared: page, namespace: "orders" });`)],
    },
  },

  sharePlingPageWithFrame: {
    parameters: {
      core: [
        p("frame", "HTMLIFrameElement", "Same-origin iframe that should receive the shared page runtime.", "接收共享页面运行时的同源 iframe。", { required: true }),
        p("page", "PlingPage", "Runtime created by createPlingPage.", "由 `createPlingPage` 创建的运行时。", { required: true }),
      ],
    },
    examples: {
      core: [ex("Share a runtime with a same-origin frame", "向同源 iframe 共享运行时", `const page = createPlingPage();\nconst stop = sharePlingPageWithFrame(iframe, page);\n\n// On teardown:\nstop();\npage.destroy();`)],
    },
  },

  plingPageFromParent: {
    parameters: {
      core: [p("win", "Window", "Window whose parent should be checked. Defaults to the current window.", "要检查父窗口的窗口对象。默认当前窗口。", { defaultValue: "window" })],
    },
    examples: {
      core: [ex("Read a shared page synchronously", "同步读取共享页面运行时", `const page = plingPageFromParent();\nif (page) createPling({ shared: page });`) ],
    },
  },

  waitForPlingPageFromParent: {
    parameters: {
      core: [
        p("options.window", "Window", "Child window to listen on. Defaults to the current window.", "要监听的子窗口。默认当前窗口。", { defaultValue: "window" }),
        p("options.timeoutMs", "number", "Maximum wait. Zero waits indefinitely. Rejects when another positive timeout expires.", "最长等待时间。传 `0` 表示一直等；其他正数超时后 Promise 会拒绝。", { defaultValue: "5000" }),
      ],
    },
    examples: {
      core: [ex("Wait for the parent runtime", "等待父页面运行时", `const page = await waitForPlingPageFromParent({ timeoutMs: 8000 });\ncreatePling({ shared: page });`) ],
    },
  },

  inspectCoverage: {
    parameters: {
      all: [
        p("root", "Element | null", "Application root to scan. Vue uses its mount root; React and DOM callers may pass any root.", "要扫描的应用根。Vue 使用挂载根；React 与原生调用方可传任意根元素。"),
        p("return.total", "number", "Recognized native controls and elements with supported interactive ARIA roles. Custom click handlers without semantic markup cannot be detected.", "识别到的原生控件和带有受支持交互 ARIA role 的元素数。没有语义标记的自定义点击处理器无法被扫描发现。"),
        p("return.declared", "number", "Controls with a direct declaration.", "有直接声明的控件数。"),
        p("return.derived", "number", "Controls produced by optional L1 derivation.", "由可选 L1 派生生成的动作数。"),
        p("return.grouped", "number", "Controls covered by a declaration on an ancestor. Review these manually.", "由祖先声明覆盖的控件数。需要人工复核映射关系。"),
        p("return.locatable", "number", "Controls registered for pointing and highlighting only; the user must operate them.", "只登记了定位和高亮的控件数；仍由用户亲自操作。"),
        p("return.missing", "number", "Actionable controls with no declaration in their ancestry.", "祖先链上没有任何声明的可操作控件数。"),
        p("return.coveragePercent", "number | null", "Controls with an explicit, derived, grouped, or locate-only treatment divided by total; this is declaration coverage, not the percentage of controls the agent can execute. Null when there are no controls.", "有直接声明、派生、祖先分组或只定位声明的控件数除以总数。它表示声明覆盖率，不代表 Agent 可执行控件的比例；没有控件时为 `null`。"),
        p("return.targets", "CoverageTarget[]", "Grouped, locate-only, and missing controls with labels, target ids, or nearby action ids.", "分组、只定位和未声明的控件列表，包含标签、目标 id 或附近动作 id。"),
      ],
    },
    examples: {
      vue3: [ex("Inspect Vue coverage", "检查 Vue 覆盖率", `const report = pling.inspectCoverage();\nconsole.log(report.coveragePercent, report.targets);`)],
      react: [ex("Inspect React coverage", "检查 React 覆盖率", `const report = pling.inspectCoverage(document.getElementById("root"));`, "tsx")],
      vanilla: [ex("Inspect Vanilla coverage", "检查原生页面覆盖率", `const report = pling.inspectCoverage(document.querySelector("main"));\nconsole.log(report.coveragePercent, report.targets);`)],
      core: [ex("Inspect a DOM root", "检查 DOM 根元素", `const report = inspectCoverage(document.querySelector("#app"));`)],
    },
  },

  createReplayLlm: {
    parameters: {
      core: [
        p("turns[].content", "string", "Assistant text returned for that turn.", "该轮返回的助手文本。"),
        p("turns[].calls", "readonly ReplayCall[]", "Tool calls requested in that turn.", "该轮请求的工具调用。"),
        p("turns[].calls[].tool", "string", "Original page action id. The replay adapter converts it to the model-facing tool name.", "页面原始动作 id。replay 适配器会转换为模型工具名。", { required: true }),
        p("turns[].calls[].args", "Record<string, unknown>", "Arguments serialized into the tool call.", "序列化进工具调用的参数。"),
        p("turns[].calls[].id", "string", "Explicit tool-call id. A deterministic id is generated when omitted.", "显式工具调用 id。省略时生成确定性 id。"),
      ],
    },
    examples: {
      core: [ex("Replay a two-step task", "回放两步任务", `const llm = createReplayLlm([\n  { content: "先添加待办。", calls: [{ tool: "add_task", args: { text: "准备发布" } }] },\n  { content: "已经添加。" },\n]);`) ],
    },
  },

  EvalCase: {
    parameters: {
      core: [
        p("name", "string", "Display name. Defaults to the input text.", "显示名称。默认使用输入文本。"),
        p("input", "string", "User message sent to the evaluated agent run.", "发给被评估 agent 运行的用户消息。", { required: true }),
        p("expectIncludes", "readonly string[]", "Strings that must appear in the final answer.", "最终回答中必须出现的字符串。"),
        p("expectTools", "readonly string[]", "Action ids that must be called.", "必须调用的动作 id。"),
        p("expectNotTools", "readonly string[]", "Action ids that must not be called.", "不得调用的动作 id。"),
        p("maxToolErrors", "number", "Maximum number of tool errors allowed for the case.", "该用例允许的最大工具错误数。"),
        p("verify", "() => boolean | Promise<boolean>", "Business-state assertion executed after the run.", "运行结束后执行的业务状态断言。"),
      ],
    },
    examples: {
      core: [ex("Assert a completed task", "断言任务完成", `const testCase = {\n  name: "完成第一条待办",\n  input: "把第一条待办标记为完成",\n  expectTools: ["toggle_task"],\n  expectNotTools: ["delete_task"],\n  verify: () => todos[0].done === true,\n};`) ],
    },
  },

  runEvaluation: {
    parameters: {
      core: [
        p("run", "(input: string) => Promise<string>", "Executes one case and returns the final assistant answer.", "执行一个用例并返回最终助手回答。", { required: true }),
        p("hooks", "HookRegistry", "Hooks whose pre/post events are observed for this evaluation.", "评估期间用于观察执行前/后事件的钩子注册表。", { required: true }),
        p("cases", "readonly EvalCase[]", "Cases to run in order.", "按顺序运行的用例。", { required: true }),
        p("reset", "() => void | Promise<void>", "Resets application state between cases.", "用例之间重置应用状态。"),
        p("measure", "() => EvalMetrics", "Returns tokens, duration, cost, or other numeric metrics per case.", "返回每个用例的 token、耗时、成本或其他数值指标。"),
        p("events", "() => readonly SessionEvent[]", "Returns the event stream for the most recent run.", "返回最近一次运行的事件流。"),
      ],
    },
    examples: {
      core: [ex("Run a small deterministic suite", "运行小型确定性用例集", `const report = await runEvaluation({\n  run: (input) => session.send(input),\n  hooks,\n  cases: [completeFirstTodo],\n  reset: () => store.reset(),\n});\nconsole.log(formatReport(report));`) ],
    },
  },

  createAgentLoop: {
    parameters: {
      core: [
        p("llm", "Llm", "Model call implementation.", "模型调用实现。", { required: true }),
        p("registry", "Registry", "Page capability registry. Omit it for a chat-only loop.", "页面能力注册表。纯聊天循环可省略。"),
        p("policy", "ConfirmGate", "Approval gate. Omit it for fail-closed behavior when a tool needs approval.", "确认闸门。省略时，需要确认的工具按 fail-closed 拒绝。"),
        p("handoff", "HandoffGate", "Human-handoff gate. Omit it to fail handoff tools rather than simulate them.", "人工接力通道。省略时人工接力工具会失败，而不是被模拟执行。"),
        p("systemPrompt", "string", "Additional system instructions. Framework rules remain in force.", "附加系统说明。框架规则仍然有效。"),
        p("responseLocale", "string | (() => string)", "Response-language hint; a function is re-read each turn.", "回答语言提示；传函数时每轮重新读取。"),
        p("context", "ContextOptions", "Bounds page context and may configure the live clock used before each model request.", "设置页面上下文范围，也可配置每次模型请求前使用的实时时钟。"),
        p("history", "HistoryOptions", "Context budget, compaction threshold, recent retention, and tool-result cap.", "上下文预算、压缩水位、最近条目保留数与工具结果上限。"),
        p("historyState", "HistorySnapshot", "Restores a summary and message list from a checkpoint. System context is rebuilt for the current page.", "从检查点恢复摘要与消息；系统上下文会按当前页面重建。"),
        p("hooks", "HookRegistry", "Tool lifecycle hooks.", "工具生命周期钩子。"),
        p("telemetry", "Telemetry", "Token, duration, cost, and retry metrics.", "token、耗时、成本与重试指标。"),
        p("trace", "AgentTraceRecorder", "Bounded request trace for diagnostics.", "用于诊断的有界请求记录。"),
        p("maxTurns", "number", "Maximum model/tool round trips in one run.", "一次运行内最大的模型/工具往返轮数。", { defaultValue: "10" }),
        p("loopThreshold", "number", "Repeated identical tool calls before LOOP_DETECTED.", "相同工具与参数重复达到多少次后报告 `LOOP_DETECTED`。"),
        p("errorBudget", "number", "Cumulative tool failures before the loop asks the model to answer directly.", "累计多少次工具失败后，要求模型直接回答。"),
        p("maxNudges", "number", "Consecutive empty model replies allowed before stopping.", "模型连续空回复多少次后停止。"),
        p("settle", "() => Promise<void>", "Waits for DOM, animation, and navigation to settle before snapshots.", "取快照前等待 DOM、动画与导航落定。"),
        p("minActionIntervalMs", "number", "Minimum delay between actions in one model turn.", "同一模型轮次内动作之间的最小间隔。", { defaultValue: "0" }),
        p("sleep", "(ms: number) => Promise<void>", "Sleep injection for deterministic tests.", "供确定性测试注入等待函数。"),
        p("shouldStop", "() => boolean", "Cooperative cancellation checked at safe points.", "在安全点检查协作式取消。"),
        p("observe", "(id: string, args: Record<string, unknown>) => void | Promise<void>", "Post-action observation hook supplied to the executor.", "传给执行器的动作后观察钩子。"),
        p("evidence", "boolean", "Captures before/after snapshots and attaches changed evidence.", "抓取动作前后快照并附带变更证据。", { defaultValue: "true" }),
        p("onEvent", "(event: SessionEvent) => void", "Session event callback.", "会话事件回调。"),
        p("now", "() => number", "Clock injection for deterministic tests.", "供确定性测试注入时钟。"),
      ],
    },
    examples: {
      core: [ex("Create a page-operating loop", "创建页面操作循环", `const loop = createAgentLoop({\n  llm,\n  registry: pling.registry,\n  policy: createPolicy(confirm),\n  maxTurns: 12,\n  evidence: true,\n});`) ],
    },
  },

  defaultSettle: {
    parameters: { core: [] },
    examples: {
      core: [ex("Use the browser settle strategy", "使用浏览器落定策略", `const settle = defaultSettle;`) ],
    },
  },

  renderPageContext: {
    parameters: {
      core: [
        p("snapshot", "Snapshot", "Bounded page snapshot produced by the registry.", "注册表生成的有界页面快照。", { required: true }),
        p("options.maxActions", "number", "Maximum actions listed, default 40.", "最多列出的动作数，默认 40。", { defaultValue: "40" }),
        p("options.maxRecords", "number", "Maximum record rows listed, default 20.", "最多列出的记录行数，默认 20。", { defaultValue: "20" }),
        p("options.includeState", "boolean", "Whether read-only state views are included.", "是否包含只读状态视图。", { defaultValue: "true" }),
        p("options.maxIdsInHint", "number", "Maximum action ids repeated in hints, default 30.", "提示中最多重复的动作 id 数，默认 30。", { defaultValue: "30" }),
        p("options.maxUnavailable", "number", "Maximum unavailable actions listed, default 6.", "最多列出的不可用动作数，默认 6。", { defaultValue: "6" }),
        p("options.maxStateChars", "number", "Character budget for state, default 1200.", "状态段的字符预算，默认 1200。", { defaultValue: "1200" }),
        p("options.maxRecordChars", "number", "Character budget for records, default 1500.", "记录段的字符预算，默认 1500。", { defaultValue: "1500" }),
        p("options.maxScopes", "number", "Maximum page regions listed, default 24.", "最多列出的页面区域数，默认 24。", { defaultValue: "24" }),
        p("options.maxFeedback", "number", "Maximum feedback entries listed, default 8.", "最多列出的反馈条目数，默认 8。", { defaultValue: "8" }),
        p("options.maxFeedbackChars", "number", "Character budget for feedback, default 800.", "反馈段的字符预算，默认 800。", { defaultValue: "800" }),
        p("options.maxPageChars", "number", "Character budget for page identity, default 500.", "页面身份段的字符预算，默认 500。", { defaultValue: "500" }),
        p("options.clock", "AgentClock", "Adds the current instant and viewer/business local times to this page context.", "在页面上下文中加入当前时刻、用户本地时间和业务本地时间。"),
      ],
    },
    examples: {
      core: [ex("Render a smaller context", "渲染更小的上下文", `const text = renderPageContext(registry.snapshot(), {\n  maxActions: 20,\n  maxRecords: 8,\n  maxStateChars: 600,\n});`) ],
    },
  },

  createExecutor: {
    parameters: {
      core: [
        p("registry", "Registry", "Registry that resolves actions and computes snapshots.", "解析动作并生成快照的注册表。", { required: true }),
        p("policy", "ConfirmGate", "Approval gate applied before an action executes.", "动作执行前应用的确认闸门。", { required: true }),
        p("handoff", "HandoffGate", "Human-handoff gate for tools declared with handoff.", "声明了人工接力的工具使用的接力通道。"),
        p("observe", "(id: string, args: Record<string, unknown>) => void | Promise<void>", "Observation window after execution, for routes, async rendering, or animation.", "执行后的观察窗口，用于路由、异步渲染或动画。"),
        p("evidence", "boolean", "Captures changed evidence and includes it in successful results.", "抓取变更证据并放进成功结果。", { defaultValue: "true" }),
        p("settle", "() => Promise<void>", "Wait used before the after-snapshot.", "取执行后快照前使用的落定等待。"),
        p("betweenSteps", "() => Promise<void>", "Optional pause between steps in a flow.", "复合流程步骤之间的可选停等。"),
        p("return.execute", "(id: string, argsJson?: string) => Promise<ExecResult>", "Executes one action and never throws action errors to the caller.", "执行一个动作；动作错误会作为结构化结果返回，不向调用方抛出。"),
      ],
    },
    examples: {
      core: [ex("Execute through the shared pipeline", "通过共享执行管线执行", `const executor = createExecutor({\n  registry: pling.registry,\n  policy: createPolicy(confirm),\n});\n\nconst result = await executor.execute("add", JSON.stringify({ text: "准备发布" }));`) ],
    },
  },

  createPolicy: {
    parameters: {
      core: [
        p("confirm", "Confirm | null", "Approval callback. Null means no confirmation channel; actions requiring approval fail closed.", "确认回调。传 `null` 表示没有确认通道；需要确认的动作按 fail-closed 拒绝。", { defaultValue: "null" }),
        p("request.id", "string", "Action id being approved.", "等待确认的动作 id。"),
        p("request.kind", "Kind", "Action risk level.", "动作风险等级。"),
        p("request.approval", "Approval", "Resolved approval policy for this action.", "该动作解析后的确认策略。"),
        p("request.description", "string", "Model-facing description shown to the approver.", "展示给批准人的动作说明。"),
        p("request.args", "Record<string, unknown>", "Validated call arguments.", "校验后的调用参数。"),
        p("request.flow.steps", "readonly string[]", "Step ids for a one-approval composite flow.", "复合流程一次确认时包含的步骤 id。"),
      ],
    },
    examples: {
      core: [ex("Connect a confirmation dialog", "接入确认对话框", `const policy = createPolicy(async (request) => {\n  return window.confirm(request.description) ? true : false;\n});`) ],
    },
  },

  describePlingError: {
    parameters: {
      core: [
        p("error.code", "string", "Stable machine-readable error code. The code is preserved in the rendered summary.", "稳定的机器可读错误码。渲染摘要中会保留该错误码。", { required: true }),
        p("error.message", "string", "Developer detail added after the localized label when it adds information.", "开发者细节；只有提供额外信息时才追加在本地化标签之后。"),
        p("error.messageKey", "string", "Fully localized catalog key, used before the generic code mapping.", "完全本地化的文案 key，优先于通用错误码映射。"),
        p("error.params", "MessageParams", "Interpolation values for the catalog message.", "文案插值参数。"),
        p("t", "PlingTranslator", "Translator that receives a message key and interpolation values.", "接收文案 key 与插值参数的翻译函数。", { required: true }),
      ],
    },
    examples: {
      core: [ex("Render a localized error", "渲染本地化错误", `const text = describePlingError(\n  { code: "EXPECTATION_FAILED", message: "未等到新行出现" },\n  pling.ui.t,\n);`) ],
    },
  },

  describePlingDiagnostic: {
    parameters: {
      core: [
        p("diagnostic.ready", "boolean", "When true, the function returns an empty string.", "为 `true` 时返回空字符串。", { required: true }),
        p("diagnostic.code", "string", "Stable diagnostic code such as MODEL_BASE_URL_MISSING or LIMITS_INVALID.", "稳定诊断码，例如 `MODEL_BASE_URL_MISSING` 或 `LIMITS_INVALID`。"),
        p("diagnostic.params", "MessageParams", "Non-sensitive interpolation values such as the environment variable name.", "非敏感插值参数，例如环境变量名。"),
        p("diagnostic.hint", "string", "Developer-facing fallback used only when no structured code exists.", "没有结构化诊断码时使用的开发者兜底说明。"),
        p("t", "PlingTranslator", "Translator used for the diagnostic catalog.", "用于诊断文案目录的翻译函数。", { required: true }),
      ],
    },
    examples: {
      core: [ex("Render configuration guidance", "渲染配置提示", `const hint = describePlingDiagnostic(\n  { ready: false, code: "MODEL_NAME_MISSING", params: { env: "VITE_AGENT_MODEL" } },\n  pling.ui.t,\n);`) ],
    },
  },

  resolveAgentConfig: {
    parameters: {
      core: [
        p("options.env", "Record<string, unknown>", "Environment-like object. Browser adapters normally pass import.meta.env; Node callers can pass process.env.", "类环境变量对象。浏览器适配器通常传 `import.meta.env`；Node 调用方可传 `process.env`。"),
        p("options.config", "AgentConfigOverrides", "Explicit overrides applied after defaults and environment values.", "在默认值与环境变量之后应用的显式覆盖。"),
      ],
    },
    examples: {
      core: [ex("Resolve configuration outside an adapter", "在适配器之外解析配置", `const config = resolveAgentConfig({\n  env: import.meta.env,\n  config: { model: "gpt-4.1-mini", limits: { maxTurns: 12 } },\n});`) ],
    },
  },

  createTaskController: {
    parameters: {
      all: [
        p("options.invoke", "TaskInvoke", "The only execution bridge. It should call the existing executor, a governed Surface, or an application service.", "唯一的执行桥。它应调用现有执行器、受治理的 Surface 或业务服务。", { required: true }),
        p("options.now", "() => number", "Clock used for startedAt and finishedAt. Inject a deterministic clock in tests.", "用于 `startedAt` 与 `finishedAt` 的时钟。测试中可注入确定性时钟。", { defaultValue: "Date.now" }),
      ],
    },
    examples: {
      all: [
        ex(
          "Run a fixed task through an existing executor",
          "通过现有执行器运行固定任务",
          `import { createTaskController } from "@plingjs/agent";

const tasks = createTaskController({
  invoke: (action, args, context) => executor.execute(action, JSON.stringify(args), context),
});

tasks.register({
  id: "student.cards",
  title: "查看会员卡",
  fields: [{ name: "studentRef", label: "学员", type: "lookup", lookup: searchStudents }],
  steps: [{
    label: "读取会员卡",
    action: "get_student_cards",
    args: (values) => ({ studentId: values.studentRef }),
  }],
});`,
        ),
      ],
    },
  },

  createTaskCatalog: {
    summary: "Create the guided-task catalog for the current page. It selects goals or advanced tasks by route and active scope, activates one guide at a time, and binds the narrow start, update, cancel and complete actions to the current registry.",
    summaryZh: "创建当前页面的引导任务目录。它按路由与活跃作用域筛选目标或进阶任务，同一时刻激活一个引导，并把启动、更新、取消与完成等窄动作绑定到当前注册表。",
    parameters: {
      all: [
        p("options.registry", "Registry", "Registry used for route changes and for binding the narrow pling_start_task and pling_update_task actions.", "用于路由变化并绑定窄动作 `pling_start_task` 与 `pling_update_task` 的注册表。"),
        p("options.isScopeActive", "(scope: string) => boolean", "Scope lookup used by registration-level scope restrictions. Vue passes its namespaced registry lookup.", "登记项按作用域筛选时使用的查询函数。Vue 会传入带命名空间的注册表查询。"),
        p("options.getPage", "() => PageView | undefined", "Page identity override. Defaults to registry.getPage().", "页面身份覆盖。默认读取 `registry.getPage()`。"),
        p("options.actionId", "string", "Preferred model action id. A shared registry keeps the first catalog on this id and assigns later catalogs suffixes such as pling_start_task_2.", "首选的模型动作 id。共享注册表时，第一个目录使用该 id，后续目录自动改用 `pling_start_task_2` 等后缀。", { defaultValue: '"pling_start_task"' }),
      ],
    },
    examples: {
      all: [
        ex(
          "Register a goal that survives a closed dialog",
          "登记一个能在弹窗关闭后继续存在的目标",
          `catalog.goal({
  id: "course.create",
  title: "创建课程",
  goal: "打开真实表单，填写用户给出的信息，保存后回读课程库确认新课程在第一位。",
  constraints: ["页面动作是唯一入口；封面由用户上传。"],
  successCriteria: ["新课程出现在课程库第一位"],
});`,
        ),
        ex(
          "Register one advanced task for the current route",
          "为当前路由登记一个进阶任务",
          `import { createTaskCatalog, createTaskController } from "@plingjs/agent";

const tasks = createTaskController({
  invoke: (action, args) => executor.execute(action, JSON.stringify(args)),
});

const catalog = createTaskCatalog({ registry: pling.registry });
const off = catalog.define({
  definition: courseDefinition,
  guide: courseGuide,
  controller: tasks,
  route: "/courses/new",
  autoStart: true,
  state: () => ({ snapshot: tasks.snapshot(), step: currentStep.value }),
});

// Later: off() removes the registration and any active guide it owns.`,
        ),
      ],
    },
  },

  TaskCatalog: {
    parameters: {
      all: [
        p("actionId", "readonly string", "The actual model action id bound by this catalog. Read it instead of assuming pling_start_task when several runtimes share a registry.", "当前目录实际绑定的模型动作 id。多个运行时共享注册表时，应读取它而不是假定一定是 `pling_start_task`。"),
        p("updateActionId", "readonly string", "The actual model action id for updating the active task's working memory. It accepts only declared, agent-writable fields.", "更新当前任务工作记忆的实际模型动作 id。它只接受任务声明过且允许 Agent 写入的字段。"),
        p("focusActionId", "readonly string", "The actual model action id that points at a declared guide field. It never writes a value and is unavailable when the active guide has no fields.", "指向已声明引导字段的实际模型动作 id。它不写入值；active 引导没有字段时不可用。"),
        p("reviewActionId", "readonly string", "The actual model action id that opens the page's read-only review. It is unavailable unless `guide.agent.review` declares a command.", "打开页面只读核对的实际模型动作 id。只有 `guide.agent.review` 声明命令时才可用。"),
        p("proposeSaveActionId", "readonly string", "The actual model action id that opens the page's confirmation step. It never writes and is unavailable unless `guide.agent.proposeSave` declares a command.", "打开页面确认步骤的实际模型动作 id。它不执行写入；只有 `guide.agent.proposeSave` 声明命令时才可用。"),
        p("cancelActionId", "readonly string", "The actual model action id that ends the active guide. It is unavailable unless `guide.agent.cancel` or `guide.cancel` declares a command.", "结束 active 引导的实际模型动作 id。只有 `guide.agent.cancel` 或 `guide.cancel` 声明命令时才可用。"),
        p("completeActionId", "readonly string", "The actual model action id that marks a goal-only task complete. It writes no business data.", "把 goal-only 目标标记为完成的实际模型动作 id。它不写业务数据。"),
        p("goal(input)", "() => void", "Registers the minimal goal path and returns an unregister function. It accepts no fields, steps, controller, form tools or business callbacks.", "登记最小目标任务路径并返回注销函数。它不接受字段、步骤、控制器、表单工具或业务回调。"),
        p("complete()", "boolean", "Marks the active goal-only task complete. Returns false for advanced tasks, which use their own completion state.", "把当前 goal-only 目标标记为完成。进阶任务使用自己的完成状态，此时返回 `false`。"),
        p("define(registration)", "() => void", "Adds an advanced task registration and returns an unregister function.", "登记进阶任务并返回注销函数。"),
        p("get(id)", "GuidedTaskRegistration | undefined", "Returns one registration even when its route or scope is currently unavailable.", "返回一个登记项，即使它当前因路由或作用域不匹配而不可用。"),
        p("list()", "readonly GuidedTaskRegistration[]", "Returns every registration owned by this catalog.", "返回该目录登记的全部任务。"),
        p("available()", "readonly GuidedTaskRegistration[]", "Returns the registrations whose route and scopes match the current page.", "返回当前页面路由与作用域都匹配的登记项。"),
        p("active()", "ActiveGuidedTask | null", "Returns the one task currently shown to the user, or null.", "返回当前展示给用户的唯一任务，或 `null`。"),
        p("activate(id, options?)", "ActiveGuidedTask", "Starts or resumes a registered task explicitly. Values are validated before activation.", "显式启动或恢复已登记任务。字段值会在激活前校验。"),
        p("deactivate()", "void", "Clears the active guide and suppresses immediate auto-start for the current context.", "清除 active 引导，并让当前上下文暂时不再自动启动。"),
        p("command(command)", "boolean", "Forwards a guide command to the active registration's onCommand handler. Returns false when nobody accepted it.", "把引导命令转发给 active 登记项的 `onCommand`。无人接收时返回 `false`。"),
        p("views()", "readonly GuidedTaskView[]", "Compact read-only descriptions of every currently available task.", "当前所有可用任务的紧凑只读说明。"),
        p("refresh()", "void", "Notifies subscribers that live page state or a task snapshot changed.", "通知订阅者页面实时状态或任务快照已变化。"),
        p("subscribe(listener)", "() => void", "Subscribes to availability, activation, and active controller snapshot changes. The returned function unsubscribes.", "订阅可用性、激活状态与 active 控制器的快照变化；返回的函数用于取消订阅。"),
        p("destroy()", "void", "Unregisters the model action, clears subscriptions, and releases controller registrations owned by this catalog.", "注销模型动作、清除订阅，并释放该目录持有的控制器登记。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Read the active task instead of keeping a second UI store",
          "读取 active 任务，不另建一份 UI 状态",
          `const current = catalog.active();
if (current?.guide) {
  renderGuide(current.guide, current.state);
}

const task = catalog.activate("course.create", {
  values: { name: "瑜伽基础" },
});
console.log(task.startedBy); // "page"`,
        ),
      ],
    },
  },

  TaskGoalInput: {
    summary: "The minimal task contract accepted by pling.task.goal(). It declares an outcome, boundaries and success criteria; fields and execution stay on the real page.",
    summaryZh: "`pling.task.goal()` 接受的最小任务契约。它声明结果、边界和成功条件；字段与执行都留在真实页面。",
    parameters: {
      all: [
        p("id", "string", "Stable goal id, unique in the catalog.", "稳定目标 id，在同一目录内唯一。", { required: true }),
        p("title", "string", "Human-facing goal name.", "面向人的目标名称。", { required: true }),
        p("goal", "string", "The outcome to reach. Must not be empty.", "要达成的结果。不能为空。", { required: true }),
        p("description", "string", "Extra description for the card or task list. Defaults to goal.", "目标卡或任务列表里的补充说明。默认取 `goal`。"),
        p("constraints", "readonly string[]", "Boundaries the model must keep, such as “page actions are the only entry”.", "模型必须守住的边界，例如“页面动作是唯一入口”。"),
        p("successCriteria", "readonly string[]", "Observable conditions that must hold before completion.", "完成前必须成立的可观察条件。"),
        p("examples", "readonly string[]", "Sample sentences a person might say.", "用户可能说出的示例句子。"),
        p("risk", '"read" | "write" | "danger"', "Goal-level risk hint. Actions still apply their own risk rules.", "目标级风险提示。动作仍执行自己的风险规则。", { defaultValue: '"write"' }),
        p("route", "GuidedTaskRoute", "Exact path, route name, list or predicate that limits where the goal can start.", "限制目标启动位置的精确路径、路由名、列表或判定函数。"),
        p("scope", "string | readonly string[]", "Every listed region must be active before the goal is available.", "列出的区域必须全部活跃，目标才可用。"),
        p("keepActive", "boolean", "Keep an explicitly started goal when its route or scope temporarily stops matching.", "显式启动的目标在路由或作用域暂时不匹配时继续保持活动。", { defaultValue: "true" }),
        p("labels", "TaskGuideLabels", "Overrides for running, completed and related labels.", "覆盖运行中、已完成等标签。"),
        p("cancelLabel", "string", "Cancel button label.", "取消按钮文案。", { defaultValue: '"Cancel task"' }),
        p("stepSubtitle", "string", "Subtitle for the compact goal card.", "紧凑目标卡的副标题。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Register a goal without a field schema",
          "登记一个没有字段 schema 的目标",
          `const disposeGoal = pling.task.goal({
  id: "course.create",
  title: "创建课程",
  goal: "打开真实表单，填写用户给出的信息，保存后回读课程库确认新课程在第一位。",
  constraints: [
    "页面上的动作是唯一操作入口。",
    "封面必须由用户亲自上传。",
  ],
  successCriteria: [
    "新课程出现在课程库第一位",
    "保存动作已回读课程库并确认了这条新记录",
  ],
  examples: ["创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写"],
});

onBeforeUnmount(disposeGoal);`,
        ),
        ex(
          "Keep the goal available only on one route",
          "只在一条路由上提供目标",
          `catalog.goal({
  id: "course.create",
  title: "创建课程",
  goal: "在课程管理里新建一门课程。",
  route: "/courses",
  scope: "course-catalogue",
});`,
        ),
      ],
    },
  },

  GuidedTaskRegistration: {
    parameters: {
      all: [
        p("id", "string", "Registration id. Defaults to definition.id and must match it when supplied.", "登记 id。默认使用 `definition.id`；显式提供时必须与定义一致。"),
        p("definition", "TaskDefinition", "The executable half: fields, actions, rules, and optional confirmation.", "可执行的一半：字段、动作、规则与可选确认。", { required: true }),
        p("guide", "TaskGuideDefinition", "The human-facing half. Omit it for a task that runs without a built-in guide.", "面向人的一半。任务不需要内置引导时可以省略。"),
        p("controller", "TaskController", "Owns the running snapshot. When supplied during define(), the catalog also registers the definition with it.", "持有运行快照。在 `define()` 时提供，目录还会把定义登记到该控制器。"),
        p("route", "GuidedTaskRoute", "Exact path, route name, list of accepted routes, or predicate. Omit for every route.", "精确路径、路由名、可接受路由列表或判定函数。省略表示所有路由可用。"),
        p("scope", "string | readonly string[]", "All listed scene scopes must be active for the task to become available.", "列出的场景作用域必须全部活跃，任务才可用。"),
        p("autoStart", "boolean", "Activates the guide when route and scope match. Only one automatic task is chosen, in registration order.", "路由与作用域匹配时自动激活引导。只选择一个自动任务，按登记顺序决定。", { defaultValue: "false" }),
        p("keepActive", "boolean", "Keeps an explicitly started task active while its route or scope temporarily stops matching. `deactivate()` still ends it.", "显式启动的任务在路由或作用域暂时不匹配时继续保持活动；`deactivate()` 仍会结束它。", { defaultValue: "false" }),
        p("initialValues", "TaskValues | (() => TaskValues)", "Values loaded before an automatic or explicit run starts.", "自动或显式启动前载入的字段值。"),
        p("binding", "TaskBinding | (() => TaskBinding)", "Page facts such as the selected record. Use a function when the selection can change.", "已选记录等页面事实。选择可能变化时使用函数。"),
        p("state", "() => TaskGuideState", "Live render state. When snapshot is omitted, the controller snapshot is used.", "实时渲染状态。未提供 `snapshot` 时读取控制器快照。"),
        p("onActivate", "(task) => void | Promise<void>", "Called after activation; use it to sync the business form, open a dialog, or point at a field.", "激活后调用；用于同步业务表单、打开弹窗或指向字段。"),
        p("onDeactivate", "(task) => void", "Called when the run stops being active.", "任务不再是 active 时调用。"),
        p("onCommand", "(command, task) => void | Promise<void>", "Receives business command names emitted by guide buttons.", "接收引导按钮发出的业务命令名。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Register the task only while its form scope is visible",
          "只在表单作用域可见时登记任务",
          `catalog.define({
  definition: courseDefinition,
  guide: courseGuide,
  controller,
  route: "/courses/new",
  scope: "create-course-form",
  autoStart: true,
  initialValues: () => currentDraft.value,
  state: () => ({ step: currentStep.value, busy: saving.value }),
  onActivate: (task) => applyTaskValues(task.state.snapshot?.values),
  onCommand: (command) => runCourseCommand(command),
});`,
        ),
      ],
    },
  },

  GuidedTaskActivationOptions: {
    parameters: {
      all: [
        p("values", "TaskValues", "Values already supplied by the user or caller. Only field names declared by the definition are accepted.", "用户或调用方已经提供的字段值。只接受定义中声明过的字段名。"),
        p("startedBy", '"page" | "agent"', "Records whether the page or the model opened the run. Model action calls set this to agent.", "记录任务由页面还是模型开启。模型动作会写成 `agent`。", { defaultValue: '"page"' }),
      ],
    },
    examples: {
      all: [
        ex(
          "Activate with previously spoken values",
          "带用户已说出的字段值激活",
          `catalog.activate("course.create", {
  values: { name: "瑜伽基础", teacherId: "teacher_18" },
  startedBy: "agent",
});`,
        ),
      ],
    },
  },

  ActiveGuidedTask: {
    parameters: {
      all: [
        p("id", "string", "Stable task id.", "稳定任务 id。"),
        p("definition", "TaskDefinition", "The executable definition resolved for this run.", "本次运行使用的可执行定义。"),
        p("guide", "TaskGuideDefinition", "The guide currently being rendered, when the registration has one.", "当前渲染的引导；登记项未提供时不存在。"),
        p("controller", "TaskController", "The controller that owns the snapshot, when supplied.", "持有快照的控制器；未提供时不存在。"),
        p("state", "TaskGuideState", "Live state returned by the registration at read time.", "读取时由登记项返回的实时状态。"),
        p("startedBy", '"page" | "agent"', "Whether page context or the model opened this run.", "本次运行由页面上下文还是模型开启。"),
        p("goal", "boolean", "True for a compact goal created by goal(). A goal has no controller and no field schema.", "由 `goal()` 创建的紧凑目标为 `true`。目标没有控制器，也没有字段 schema。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Render whichever guide is currently active",
          "渲染当前 active 的引导",
          `const active = catalog.active();
if (active?.guide) {
  const { snapshot, step, busy, error, completed } = active.state;
  renderGuide(active.guide, { snapshot, step, busy, error, completed });
}`,
        ),
      ],
    },
  },

  TaskGuideDefinition: {
    parameters: {
      all: [
        p("taskId", "string", "Must match the id of the task definition this guide explains.", "必须与这份引导所解释的任务定义 id 一致。", { required: true }),
        p("title", "string", "Heading for the guide card.", "引导卡的标题。", { required: true }),
        p("welcome", "string", "Introductory sentence shown before the step rail.", "步骤轨前方的引导说明。"),
        p("footer", "string", "Small note under the guide body, such as a safety or timing hint.", "引导正文下的小字说明，例如安全或时间提示。"),
        p("cancel", "TaskGuideAction", "Optional header action that lets the person leave the task. The renderer emits the command; the page decides how to end the run.", "可选的标题栏离开任务操作。渲染器只发出命令，由页面决定如何结束任务。"),
        p("stepSubtitle", "string", "Subtitle template supporting {step} and {total}.", "步骤副标题模板，支持 `{step}` 与 `{total}`。"),
        p("avatar", "string", "Short avatar text or initials used by the built-in renderer.", "内置渲染器使用的短头像文字或首字母。"),
        p("agent", "{ focusField?, review?, proposeSave?, cancel? }", "Page-owned commands the model may trigger. `review` enables `pling_review_task`, `proposeSave` enables `pling_propose_save`, and `cancel` enables `pling_cancel_task`; each tool is unavailable when its command is omitted. `focusField(field)` overrides the default `focus-<field>` command while `pling_focus_field` stays limited to declared guide fields. None of these commands performs a business write; `proposeSave` opens the confirmation surface only.", "模型可以触发的页面命令。声明 `review` 才会启用 `pling_review_task`，声明 `proposeSave` 才会启用 `pling_propose_save`，声明 `cancel` 才会启用 `pling_cancel_task`；省略时对应工具不可用。`focusField(field)` 可以覆盖默认的 `focus-<field>` 命令，但 `pling_focus_field` 仍只作用于引导声明的字段。这些命令都不执行业务写入；`proposeSave` 只打开确认界面。"),
        p("labels", "TaskGuideLabels", "Overrides for running, completed, current, done, pending, skipped, and error labels.", "覆盖运行中、已完成、当前、完成、未开始、已跳过与错误文案。"),
        p("fields", "TaskGuideFields", "Compact field list resolved from page state or the latest snapshot. The built-in renderer uses it for the horizontal progress rail; skip it for a full step card.", "由页面状态或最新快照解析的紧凑字段列表。内置渲染器用它显示横向进度轨道；省略时显示完整步骤卡。"),
        p("steps", "readonly TaskGuideStep[]", "Ordered human-facing steps. At least one is required by the contract.", "面向人的有序步骤。契约要求至少一项。", { required: true }),
        p("done", "TaskGuideDone", "Final state copy and optional follow-up commands.", "完成状态文案与可选后续命令。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Describe the same task to a person",
          "把同一个任务讲给人听",
          `const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "新建课程",
  welcome: "我会陪你确认课程信息，并填入右侧表单。",
  stepSubtitle: "第 {step} 步，共 {total} 步",
  agent: {
    review: "review-task",
    proposeSave: "propose-save",
    cancel: "cancel-task",
  },
  steps: courseSteps,
  done: {
    title: "课程已创建",
    description: "列表里的第一条就是新课程。",
  },
};`,
        ),
      ],
    },
  },

  TaskGuideStep: {
    parameters: {
      all: [
        p("id", "string", "Stable step id used by the page to restore progress.", "用于页面恢复进度的稳定步骤 id。"),
        p("label", "string", "Short label in the step rail.", "步骤轨中的短标签。"),
        p("title", "string", "Step heading in the detail card.", "详情卡中的步骤标题。"),
        p("description", "string", "Explanation of what is happening or what the person should do next.", "说明当前发生什么，或用户接下来该做什么。"),
        p("rowsTitle", "string | (snapshot) => string", "Optional heading above a read-only summary.", "只读摘要上方的可选标题。"),
        p("rows", "TaskGuideRows", "Read-only rows resolved from the current task snapshot.", "按当前任务快照解析的只读摘要行。"),
        p("handoff", "TaskGuideHandoff", "Copy that explains a point where the person must act on the page.", "说明某一必须由用户在页面上完成的接力点。"),
        p("primary", "TaskGuideAction", "Primary business command shown on this step.", "当前步骤的主业务命令。"),
        p("secondary", "TaskGuideAction", "Optional secondary command such as back or skip.", "可选的次要命令，例如返回或跳过。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Point at an existing form field",
          "指向现有表单字段",
          `const step: TaskGuideStep = {
  id: "name",
  label: "课程名称",
  title: "先填写课程名称",
  description: "我已经定位到右侧的名称输入框。",
  handoff: { title: "由你确认名称", description: "填写后回到对话，我会继续检查。" },
  primary: { label: "我已填好", command: "name.done" },
};`,
        ),
      ],
    },
  },

  TaskGuideField: {
    parameters: {
      all: [
        p("field", "string", "Stable field id used by the page and by the default `focus-<field>` command.", "页面与默认 `focus-<field>` 命令使用的稳定字段 id。", { required: true }),
        p("label", "string", "Human-readable field name shown in the rail.", "字段轨道中展示的字段名称。", { required: true }),
        p("required", "boolean", "Whether the task cannot complete without this value.", "缺少该值时任务是否无法完成。", { defaultValue: "false" }),
        p("filled", "boolean", "Whether the page already holds a value for this field.", "页面是否已经有这个字段的值。", { defaultValue: "false" }),
        p("skipped", "boolean", "Whether the person explicitly skipped this optional field. The rail marks it with a dash and the skipped label.", "用户是否明确跳过了这个可选字段。轨道会用短横线与“已跳过”标记。", { defaultValue: "false" }),
        p("suggested", "boolean", "Whether a recommendation exists but has not been written to the page.", "是否已有建议值但尚未写入页面。", { defaultValue: "false" }),
        p("command", "string", "Overrides the default `focus-<field>` command emitted when the node is clicked.", "覆盖点击节点时默认发出的 `focus-<field>` 命令。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Expose progress without turning the rail into another form",
          "把进度交给字段轨道，而不是再造一份表单",
          `const fields = [
  { field: "name", label: "课程名称", required: true, filled: true },
  { field: "note", label: "约课须知", skipped: true },
  { field: "cover", label: "课程封面", required: true, suggested: false },
];`,
        ),
      ],
    },
  },

  TaskGuideAction: {
    parameters: {
      all: [
        p("label", "string", "Button text shown to the user.", "展示给用户的按钮文案。"),
        p("command", "string", "Business-owned command name forwarded to onCommand. The renderer does not interpret it.", "转发给 `onCommand` 的业务自有命令名。渲染器不解释它的含义。"),
        p("busyLabel", "string", "Optional button text while the command is running.", "命令运行中的可选按钮文案。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Use a command instead of a second action path",
          "用命令转发，不另建执行路径",
          `const save: TaskGuideAction = {
  label: "保存并继续",
  busyLabel: "正在保存…",
  command: "course.save",
};`,
        ),
      ],
    },
  },

  TaskGuideRow: {
    parameters: {
      all: [
        p("label", "string", "Left-hand label, such as a field or business fact.", "左侧标签，例如字段名或业务事实。", { required: true }),
        p("value", "string | number | boolean | null | undefined", "The value to display. The renderer formats it; it never edits the page.", "要显示的值。渲染器只负责格式化，不修改页面。", { required: true }),
        p("format", '"text" | "stars" | "check" | "number"', "Display hint. `stars` renders a 1–5 rating and `check` renders a selected/not-selected mark.", "显示提示。`stars` 渲染 1–5 星评分，`check` 渲染选中/未选中标记。", { defaultValue: '"text"' }),
        p("status", '"current" | "suggested" | "missing"', "Where the value came from: already in the page, a suggestion not yet written, or still missing.", "值来自哪里：页面当前值、尚未写入的建议值，或仍缺失。"),
        p("badge", "string", "Short business-owned badge such as “In page”, “Suggested”, or “Needs input”.", "业务自有的短标记，例如“已填入”“建议”“待填写”。"),
        p("note", "string", "Provenance or helper text shown under the label. Use it to explain a suggestion, not to repeat the value.", "标签下方的来源或帮助文字。用来解释建议值，不要重复值本身。"),
        p("action", "TaskGuideAction", "Optional row-level command, usually “Use suggestion” or “Locate field”. It uses the same onCommand path as every other command.", "可选的行级命令，通常是“采用建议”或“定位字段”。它与其他命令走同一个 `onCommand` 路径。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Show a suggestion without pretending it is the page value",
          "展示建议值，但不假装它已经写入页面",
          `const row: TaskGuideRow = {
  label: "课程名称",
  value: "瑜伽基础",
  status: "suggested",
  badge: "建议",
  note: "来自示例模板，尚未写入页面",
  action: { label: "采用", command: "apply-name" },
};`,
        ),
        ex(
          "Show a value that already exists in the page",
          "展示页面里已经存在的值",
          `const row: TaskGuideRow = {
  label: "授课老师",
  value: "周敏",
  status: "current",
  badge: "已填入",
  action: { label: "定位", command: "focus-teacher" },
};`,
        ),
      ],
    },
  },

  TaskGuideDone: {
    parameters: {
      all: [
        p("title", "string | (snapshot) => string", "Completion heading, optionally derived from the final snapshot.", "完成标题，可根据最终快照生成。"),
        p("description", "string | (snapshot) => string", "Completion detail that explains what changed.", "说明具体改了什么完成文案。"),
        p("rows", "TaskGuideRows", "Final read-only summary rows.", "最终只读摘要行。"),
        p("actions", "readonly TaskGuideAction[]", "Follow-up business commands available after completion.", "完成后可用的后续业务命令。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Show the created record as the result",
          "把创建结果作为完成回执",
          `const done: TaskGuideDone = {
  title: "课程已创建",
  description: (snapshot) => "已创建：" + (snapshot?.values.name ?? "新课程"),
  actions: [{ label: "继续添加老师", command: "teacher.add" }],
};`,
        ),
      ],
    },
  },

  TaskGuideCommand: {
    parameters: {
      all: [
        p("action", "TaskGuideAction", "The button definition that emitted the command.", "发出该命令的按钮定义。"),
        p("step", "TaskGuideStep | null", "The step that was active, or null when the command came from the completion card.", "发出命令时的当前步骤；完成卡发出时为 `null`。"),
        p("stepIndex", "number", "Zero-based index of the active step. The value is -1 for a completion action.", "当前步骤的零基下标。完成动作为 `-1`。"),
        p("done", "boolean", "Whether the command came from the completion state.", "命令是否来自完成状态。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Route guide commands in the page",
          "在页面中分发引导命令",
          `function onCommand(command: TaskGuideCommand): void {
  if (command.done) return finishCourseFlow(command.action.command);
  if (command.action.command === "name.done") pointAtTeacherField();
}`,
        ),
      ],
    },
  },

  TaskGuideState: {
    parameters: {
      all: [
        p("snapshot", "TaskRunSnapshot | null", "Current task run. Omit it to let the catalog read controller.snapshot().", "当前任务运行快照。省略时目录读取 `controller.snapshot()`。"),
        p("step", "number", "One-based active guide step.", "从 1 开始的当前引导步骤。", { defaultValue: "1" }),
        p("busy", "boolean", "Whether the page is currently completing the step.", "页面是否正在完成当前步骤。", { defaultValue: "false" }),
        p("error", "string", "Business-facing error to keep next to the guide.", "显示在引导旁的业务错误。"),
        p("completed", "boolean", "Switches the guide to its completion state.", "把引导切换到完成状态。", { defaultValue: "false" }),
      ],
    },
    examples: {
      all: [
        ex(
          "Expose live page state without duplicating it",
          "暴露实时页面状态，不另存一份",
          `state: () => ({
  snapshot: controller.snapshot(),
  step: currentStep.value,
  busy: saving.value,
  error: error.value,
  completed: saved.value,
})`,
        ),
      ],
    },
  },

  GuidedTaskView: {
    parameters: {
      all: [
        p("id", "string", "Task id.", "任务 id。"),
        p("title", "string", "Human-facing task title.", "面向人的任务标题。"),
        p("description", "string", "What the task does and when to choose it.", "任务做什么以及何时选择它。"),
        p("examples", "readonly string[]", "Example requests for this task.", "该任务的示例请求。"),
        p("guideTitle", "string", "Title of the optional guide.", "可选引导的标题。"),
        p("stepTitles", "readonly string[]", "Ordered guide step titles for compact context.", "用于紧凑上下文的引导步骤标题。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Build a compact task picker",
          "构建紧凑的任务选择器",
          `for (const task of catalog.views()) {
  console.log(task.id, task.title, task.stepTitles?.length ?? 0);
}`,
        ),
      ],
    },
  },

  TaskDefinition: {
    parameters: {
      all: [
        p("id", "string", "Stable task id, unique inside one controller.", "稳定任务 id，在同一控制器内唯一。", { required: true }),
        p("title", "string", "Human-facing task name shown on the task card.", "任务卡上显示的任务名称。", { required: true }),
        p("description", "string", "What the task does and when a user should choose it.", "任务做什么，以及用户在什么场景下该选它。"),
        p("objective", "string", "The outcome the task is trying to achieve. This is the goal the assistant reasons about, not a step list.", "任务要达成的结果。它是助手推理时使用的目标，不是步骤清单。"),
        p("constraints", "readonly string[]", "Boundaries the assistant must respect while helping, such as page-only uploads or mandatory read-back verification.", "助手协助时必须守住的边界，例如只能由页面上传或必须回读验证。"),
        p("successCriteria", "readonly string[]", "Observable conditions that mean the task is genuinely complete.", "任务真正完成时必须可观察到的条件。"),
        p("requiresRecord", "boolean", "When true, start() requires a record supplied by the page. Generic task lists should treat the task as an entry point opened from a row or detail page.", "为 `true` 时，`start()` 必须拿到页面提供的记录。通用任务列表应把它当作从行或详情页打开的入口，而不是直接启动。", { defaultValue: "false" }),
        p("examples", "readonly string[]", "Example requests shown on the card. Clicking one fills the form; it does not execute a write.", "任务卡上的示例说法。点击只填入表单，不直接执行写操作。"),
        p("fields", "readonly TaskField[]", "Current working memory and decisions that may require a person. Missing required fields do not prescribe a scripted order.", "当前工作记忆，以及可能需要人做出的决定。缺失必填项不规定对话必须按某个脚本顺序进行。"),
        p("risk", '"read" | "write" | "danger"', "Task-level risk hint. The underlying action still owns enforcement.", "任务级风险提示。真正的权限仍由底层动作执行。"),
        p("steps", "readonly TaskStep[]", "Deterministic business action calls. They execute the write; they do not control the conversation's next question.", "确定性的业务动作调用。它们负责执行写入，不控制对话下一句问什么。"),
        p("prompt", "string | ((values) => string)", "Agent-mode template. Required when steps is absent.", "Agent 模式模板。没有 `steps` 时必须提供。"),
        p("confirm", 'boolean | "always"', "Task-level confirmation preference; action policy remains authoritative.", "任务级确认偏好；动作策略仍是最终依据。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Describe a task without duplicating the executor",
          "描述任务，不复制执行器",
          `const task: TaskDefinition = {
  id: "teacher.create",
  title: "新增老师",
  description: "创建老师，并可选地为他安排第一节课。",
  fields: [
    { name: "name", label: "姓名" },
    { name: "phone", label: "手机号", type: "text" },
  ],
  steps: [{
    label: "创建老师",
    action: "create_teacher",
    args: (values) => ({ name: values.name, phone: values.phone }),
  }],
};`,
        ),
      ],
    },
  },

  TaskBinding: {
    parameters: {
      all: [
        p("record", "TaskRecordBinding", "The record selected by the host before the task opens. It is a page fact, not a form field.", "宿主在任务打开前选中的记录。它是页面事实，不是表单字段。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Bind a lesson row to its task",
          "把课表行绑定到任务",
          `panel.open("lesson.note", {}, {
  record: { id: "lesson_42", label: "瑜伽基础 · 2026-03-16 10:00" },
});`,
        ),
      ],
    },
  },

  TaskRecordBinding: {
    parameters: {
      all: [
        p("id", "string", "Stable reference accepted by the existing business actions. It should identify the same record the user selected on the page.", "现有业务动作接受的稳定引用。它应指向用户在页面上选中的同一条记录。", { required: true }),
        p("label", "string", "Human-facing label used for diagnostics and optional task headers.", "用于诊断与可选任务标题的展示名称。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Use the bound id without asking for it",
          "使用绑定 id，不再重复询问",
          `const updateNote: TaskStep = {
  label: "保存备注",
  action: "update_lesson_note",
  args: (values, binding) => ({
    lessonId: binding.record?.id,
    note: values.note,
  }),
};`,
        ),
      ],
    },
  },

  TaskField: {
    parameters: {
      all: [
        p("name", "string", "Key used in values and step argument functions.", "字段值中的键名，步骤参数函数也用它取值。", { required: true }),
        p("label", "string", "Label shown to the user.", "展示给用户的字段名。", { required: true }),
        p("type", '"text" | "textarea" | "number" | "boolean" | "date" | "select" | "lookup"', "Input control. Defaults to text.", "输入控件类型。默认 `text`。", { defaultValue: '"text"' }),
        p("optional", "boolean", "Allows an empty value. Fields are required by default.", "允许留空。字段默认必填。", { defaultValue: "false" }),
        p("placeholder", "string", "Input placeholder or select prompt.", "输入占位符或选择提示。"),
        p("help", "string", "Short explanation shown next to the field.", "字段旁的简短说明。"),
        p("defaultValue", "TaskValue", "Initial value when a run starts.", "运行开始时的初始值。"),
        p("values", "readonly TaskChoice[]", "Small closed choice set for select fields.", "`select` 字段使用的小型封闭选项集。"),
        p("recommended", "TaskValue", "A suggestion the model may use only when the person explicitly delegates this choice. It is not written automatically.", "仅在用户明确委托这一项选择时，模型可以使用的建议值。它不会被自动写入。"),
        p("lookup", "TaskLookup", "Async search for a large collection. UI and agent tooling should share this function.", "大集合的异步搜索。界面与 Agent 工具应共用这一函数。"),
        p("min", "number", "Minimum for a numeric field. Enforced before a model-proposed value reaches the task snapshot.", "数值字段的最小值。模型建议的值写入任务快照之前会先校验。"),
        p("max", "number", "Maximum for a numeric field. Enforced before a model-proposed value reaches the task snapshot.", "数值字段的最大值。模型建议的值写入任务快照之前会先校验。"),
        p("minLength", "number", "Minimum length for a text value. Counted on the trimmed string.", "文本值的最小长度，按去除首尾空白后的字符数计算。"),
        p("maxLength", "number", "Maximum length for a text value. Counted on the trimmed string.", "文本值的最大长度，按去除首尾空白后的字符数计算。"),
        p("pattern", "string", "Regular expression source without delimiters, tested against a text value. Use anchors when the whole value must match, for example `^[1-9]\\\\d*$`.", "不带分隔符的正则表达式源码，用于校验文本值。需要整值匹配时请写锚点，例如 `^[1-9]\\\\d*$`。"),
        p("validate", "(value, values) => string | null | undefined", "Business-level check run before a model-proposed value is written. Return a short human-readable reason to reject it, or nothing when valid. This validates a value; it must not classify intent or trigger side effects.", "模型建议的值写入之前执行的业务校验。返回简短的、可直接展示给用户的拒绝原因；通过时返回空。它只校验值，不应做意图分类或产生副作用。"),
        p("searchAction", "string", "Action id exposed to the model for this lookup. Defaults to `search_<name>`; reuse one id when several tasks share a search implementation.", "为该查找暴露给模型的动作 id。默认 `search_<name>`；多个任务共用同一搜索实现时应复用同一个 id。"),
        p("minChars", "number", "Minimum query length before lookup runs. Values below one are clamped to one.", "触发搜索所需的最少字符数。小于 1 的值会按 1 处理。", { defaultValue: "1" }),
        p("agentWritable", "boolean", "Whether the model may write this field through the task update action. Set false for page-owned values such as an upload, signature, or one-time code.", "模型是否可以通过任务更新动作写入该字段。上传、签名、验证码等页面专属值设为 `false`。", { defaultValue: "true" }),
      ],
    },
    examples: {
      all: [
        ex(
          "Distinguish two students with the same name",
          "区分同名学员",
          `const studentField: TaskField = {
  name: "studentRef",
  label: "学员",
  type: "lookup",
  minChars: 2,
  lookup: async (query) => api.searchStudents(query).then((rows) => rows.map((row) => ({
    value: row.id,
    label: row.name,
    description: row.phoneMasked,
  }))),
};`,
        ),
        ex(
          "Reject an impossible value before it reaches the page",
          "在值写进页面之前拒绝非法值",
          `const difficulty: TaskField = {
  name: "difficulty",
  label: "难度",
  type: "number",
  optional: true,
  min: 1,
  max: 5,
};

const teacher: TaskField = {
  name: "teacherId",
  label: "授课老师",
  type: "lookup",
  lookup: searchTeachers,
  validate: (value) =>
    teachers.some((item) => item.id === value)
      ? null
      : "请从搜索结果中选择老师。",
};`,
        ),
      ],
    },
  },

  TaskLookup: {
    parameters: {
      all: [
        p("query", "string", "Text entered by the user or sent by the model.", "用户输入或模型发送的文本。"),
        p("context", "TaskLookupContext", "Optional cancellation context for asynchronous searches.", "异步搜索的可选取消上下文。"),
      ],
    },
    examples: {
      all: [
        ex(
          "One search implementation for UI and model",
          "界面与模型共用一份搜索",
          `const lookupStudents: TaskLookup = async (query, { signal }) => {
  const rows = await api.searchStudents(query, { signal });
  return rows.map((row) => ({ value: row.id, label: row.name, description: row.phoneMasked }));
};`,
        ),
      ],
    },
  },

  TaskLookupContext: {
    parameters: {
      all: [
        p("signal", "AbortSignal", "Aborted when the user closes the panel or a newer query replaces this one.", "用户关闭面板或新查询替换旧查询时中止。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Respect cancellation in an async lookup",
          "在异步查找中响应取消",
          `const lookup: TaskLookup = async (query, context) => {
  const response = await fetch("/api/students?q=" + encodeURIComponent(query), {
    signal: context.signal,
  });
  return response.json();
};`,
        ),
      ],
    },
  },

  TaskStep: {
    parameters: {
      all: [
        p("id", "string", "Stable step id. Defaults to its 1-based index.", "稳定步骤 id。省略时使用从 1 开始的序号。"),
        p("label", "string", "Human-facing step name.", "展示给用户的步骤名。", { required: true }),
        p("summary", "string", "Why the step exists or what it checks.", "为什么执行这一步，或它在检查什么。"),
        p("action", "string", "Registered action or governed business operation id.", "已注册动作或受治理业务操作的 id。", { required: true }),
        p("args", "object | ((values, binding) => object)", "Static arguments, a template from collected values, or a function that also reads the bound record.", "静态参数、从已填字段生成参数的函数，或同时读取绑定记录的参数函数。"),
        p("optional", "boolean", "When true, a failure becomes skipped and later steps continue.", "为 `true` 时，失败记为跳过，后续步骤继续。", { defaultValue: "false" }),
        p("handoff", "boolean | string", "Marks this step as human work. The run waits for handoff and the host performs the actual verification.", "把该步骤标记为人工完成。运行进入等待接力状态，由宿主完成真正的校验。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Check before writing",
          "先检查再写入",
          `const steps: TaskStep[] = [
  { label: "检查时段", action: "check_slot", args: (values) => ({ slot: values.slot }) },
  { label: "创建课程", action: "create_lesson", args: (values) => ({ slot: values.slot }) },
];`,
        ),
      ],
    },
  },

  TaskStepSnapshot: {
    parameters: {
      all: [
        p("index", "number", "1-based position in the step list.", "在步骤列表中的位置，从 1 开始。"),
        p("id", "string", "Stable step id, generated from the index when omitted.", "稳定的步骤 id；省略时按序号生成。"),
        p("label", "string", "Human-facing step name.", "展示给用户的步骤名。"),
        p("summary", "string", "Why the step exists or what it checks.", "为什么执行这一步，或它在检查什么。"),
        p("action", "string", "Action id this step invoked or will invoke.", "该步骤调用或将要调用的动作 id。"),
        p("status", '"pending" | "running" | "ok" | "skipped" | "failed"', "Current step state.", "当前步骤状态。"),
        p("optional", "boolean", "Whether a failure is allowed to continue.", "失败后是否允许继续。"),
        p("handoff", "boolean | string", "Present when the step must be completed by a person.", "步骤必须由人完成时出现。"),
        p("error", "TaskRunError", "Failure code and message for a failed or skipped step.", "失败或跳过步骤的错误码与消息。"),
        p("result", "unknown", "Opaque value returned by the execution bridge.", "执行桥返回的不透明结果。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Render progress without inventing state",
          "直接渲染进度，不另造状态",
          `for (const step of snapshot.steps) {
  row.dataset.status = step.status;
  row.textContent = step.index + ". " + step.label;
  if (step.error) note.textContent = step.error.message;
}`,
        ),
      ],
    },
  },

  TaskRunStatus: {
    parameters: {
      all: [
        p("collecting", '"collecting"', "Required values are still missing.", "仍缺少必填值。"),
        p("ready", '"ready"', "Values are complete; execution has not started.", "字段已齐全，尚未开始执行。"),
        p("planned", '"planned"', "The plan is fixed and visible; a task-level confirmation may still be pending.", "计划已经确定并可见；仍可能在等待任务级确认。"),
        p("running", '"running"', "A step is in progress.", "某个步骤正在执行。"),
        p("waiting", '"waiting"', "Waiting for confirmation or a human handoff. Check waitingFor.", "正在等待确认或人工接力。查看 `waitingFor`。"),
        p("verifying", '"verifying"', "An action returned and the host is checking the result. It is not a repeated running state.", "动作已返回，宿主正在核对结果。它不是重复的 running 状态。"),
        p("done", '"done"', "All required steps completed.", "所有必需步骤已完成。"),
        p("failed", '"failed"', "A required step failed.", "某个必需步骤失败。"),
        p("cancelled", '"cancelled"', "The user or a new run cancelled this run.", "用户或新的运行取消了本次运行。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Handle waiting without guessing",
          "处理等待状态时读取原因",
          `if (snapshot.status === "waiting") {
  showPrompt(snapshot.waitingFor === "confirmation"
    ? "Review the plan, then confirm."
    : "Complete this step in the page.");
}`,
        ),
      ],
    },
  },

  TaskWaitingFor: {
    parameters: {
      all: [
        p("confirmation", '"confirmation"', "A task-level confirmation is pending. Call confirm() after the user approves.", "任务级确认尚未完成。用户批准后调用 `confirm()`。"),
        p("handoff", '"handoff"', "The user must complete the step in the page. The host verifies the result.", "用户必须在页面上亲自完成该步骤，由宿主核对结果。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Distinguish two kinds of waiting",
          "区分两种等待",
          `switch (snapshot.waitingFor) {
  case "confirmation": return renderConfirm(snapshot);
  case "handoff": return renderHandoff(snapshot.steps.find((step) => step.status === "running"));
  default: return renderProgress(snapshot);
}`,
        ),
      ],
    },
  },

  TaskRunContext: {
    parameters: {
      all: [
        p("taskId", "string", "Definition id of the active run.", "当前运行的任务定义 id。"),
        p("values", "TaskValues", "Snapshot of collected values, copied before invoke.", "调用前复制的已填字段快照。"),
        p("binding", "TaskBinding", "Snapshot of page facts supplied when the run started.", "运行开始时提供的页面事实快照。"),
        p("signal", "AbortSignal", "Aborted when the run is cancelled or replaced.", "运行被取消或替换时中止。"),
        p("report", "(status, waitingFor?) => void", "Marks a long step as running, waiting, or verifying. Stale runs ignore it.", "把长步骤标记为运行中、等待或核对中。已过期的运行会忽略该调用。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Report a handoff from a long-running bridge",
          "在长执行桥中上报人工接力",
          `const invoke: TaskInvoke = async (action, args, context) => {
  if (action === "confirm_payment") context.report("waiting", "handoff");
  return executor.execute(action, JSON.stringify(args), { signal: context.signal });
};`,
        ),
      ],
    },
  },

  TaskRunSnapshot: {
    parameters: {
      all: [
        p("taskId", "string", "Definition id for this run.", "本次运行对应的任务定义 id。"),
        p("status", "TaskRunStatus", "The current run state, including planned and verifying.", "当前运行状态，包括 `planned` 与 `verifying`。"),
        p("values", "TaskValues", "Current field values. Treat them as user input, not trusted server facts.", "当前字段值。把它们当作用户输入，而不是可信的服务端事实。"),
        p("binding", "TaskBinding", "Present when the host supplied a page record or other binding at start().", "启动时由宿主提供页面记录或其他绑定时出现。"),
        p("steps", "readonly TaskStepSnapshot[]", "Per-step status, human-readable error, and returned result.", "每一步的状态、面向用户的错误与返回结果。"),
        p("prompt", "string", "Agent-mode prompt generated from values.", "Agent 模式根据字段值生成的提示词。"),
        p("waitingFor", "TaskWaitingFor", "Present while status is waiting: confirmation or handoff.", "状态为等待时出现：确认或人工接力。"),
        p("confirmation", "{ required: true; confirmed: boolean }", "Present when the definition asks for task-level confirmation.", "任务定义要求任务级确认时出现。"),
        p("error", "TaskRunError", "Failure code and message when the run or a required step fails.", "运行或必需步骤失败时的错误码与消息。"),
        p("startedAt", "number", "Millisecond timestamp from the injected clock.", "来自注入时钟的毫秒时间戳。"),
        p("finishedAt", "number", "Present after completion, failure, or cancellation.", "完成、失败或取消后出现。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Render from one snapshot",
          "用同一份快照渲染",
          `controller.subscribe((snapshot) => {
  progress.textContent = snapshot.status;
  for (const step of snapshot.steps) {
    renderStep(step.label, step.status, step.error?.message);
  }
});`,
        ),
      ],
    },
  },

  TaskController: {
    parameters: {
      all: [
        p("register", "(definition) => () => void", "Adds a definition and returns its unregister function. Duplicate ids throw.", "注册任务定义并返回注销函数。重复 id 会抛错。"),
        p("start", "(id, values?, binding?) => TaskRunSnapshot", "Starts a run, applies defaults, records page bindings, and cancels the previous active run. Throws when requiresRecord is true and no record id is supplied.", "启动运行、应用默认值、记录页面绑定，并取消此前的活动运行。`requiresRecord` 为 `true` 且没有记录 id 时抛错。"),
        p("setValue", "(name, value) => TaskRunSnapshot", "Updates a field while collecting or ready. Mutating after execution throws.", "在收集或就绪阶段更新字段。开始执行后再修改会抛错。"),
        p("plan", "() => TaskRunSnapshot", "Freezes the current values into planned state without invoking the bridge. Missing fields return TASK_FIELDS_REQUIRED.", "把当前字段值冻结为 `planned` 状态，不调用执行桥。缺少必填字段时返回 `TASK_FIELDS_REQUIRED`。"),
        p("confirm", "() => TaskRunSnapshot", "Completes a pending task-level confirmation. Throws when the run is not waiting for confirmation.", "完成待处理的任务级确认。运行不在等待确认时抛错。"),
        p("run", "() => Promise<TaskRunSnapshot>", "Executes fixed steps or returns the agent-mode prompt.", "执行固定步骤，或返回 Agent 模式提示词。"),
        p("cancel", "() => TaskRunSnapshot", "Aborts the active step and marks the run cancelled.", "中止当前步骤并把运行标记为取消。"),
        p("subscribe", "(listener) => () => void", "Receives a snapshot after every state transition.", "每次状态变化后接收一份快照。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Collect fields, then run",
          "先收集字段，再运行",
          `controller.start("student.cards");
controller.setValue("studentRef", "stu_1");
controller.plan();
const run = await controller.run();
if (run.error?.code === "TASK_FIELDS_REQUIRED") showMissingFields(run);`,
        ),
      ],
    },
  },

  TaskChoice: {
    parameters: {
      all: [
        p("value", "string", "Stable reference passed to the action, such as a student id.", "传给动作的稳定引用，例如学员 id。", { required: true }),
        p("label", "string", "Name shown to the user and offered to the model.", "展示给用户、也提供给模型选择的名称。", { required: true }),
        p("description", "string", "Optional detail that separates duplicate names, such as a masked phone number.", "用于区分同名项的补充信息，例如脱敏手机号。"),
      ],
    },
    examples: {
      all: [
        ex(
          "A duplicate-safe choice",
          "能区分重名的选项",
          `const choice: TaskChoice = {
  value: "stu_2",
  label: "李娜",
  description: "139****5678 · 最近上课 10 月 18 日",
};`,
        ),
      ],
    },
  },

  QuickTask: {
    parameters: {
      all: [
        p("label", "string", "Short label shown on the assistant surface.", "助手入口上显示的短标签。", { required: true }),
        p("prompt", "string", "Full prompt sent when the user presses the entry.", "用户点击入口时发送的完整提示词。", { required: true }),
        p("description", "string", "Optional explanation available on hover or to assistive technology.", "悬停时或辅助技术可读的补充说明。"),
        p("disabled", "boolean", "Keeps the entry visible but temporarily unavailable.", "保留入口可见，但暂时不可用。", { defaultValue: "false" }),
      ],
    },
    examples: {
      all: [
        ex(
          "Keep the button short and the prompt specific",
          "按钮短，提示词具体",
          `const quick: QuickTask[] = [{
  label: "标记第一条完成",
  prompt: "把第 1 条待办标记为完成，然后新增两条待办：买牛奶、整理书桌。",
  description: "会先完成第一条，再创建两条新待办。",
}];`,
        ),
      ],
    },
  },

  QuickTaskItem: {
    parameters: {
      all: [
        p("item", "string | QuickTask", "A plain string keeps the one-line shorthand; an object supplies a separate label, prompt, and description.", "普通字符串保留单行简写；对象可分别提供标签、提示词与说明。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Mix shorthand and structured entries",
          "混合简写与结构化入口",
          `const quick: QuickTaskItem[] = [
  "显示本周未完成的订单",
  { label: "整理今日待办", prompt: "检查今天的待办，把已完成的归档。" },
];`,
        ),
      ],
    },
  },

  TaskInvoke: {
    parameters: {
      all: [
        p("action", "string", "Action id from the current step.", "当前步骤中的动作 id。"),
        p("args", "Record<string, unknown>", "Resolved arguments for this invocation.", "本次调用已解析的参数。"),
        p("context", "TaskRunContext", "Task id, values, page binding, abort signal, and a report() function for long-running sub-states.", "任务 id、字段值、页面绑定、取消信号，以及用于长步骤状态上报的 `report()`。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Adapt the task bridge to an executor",
          "把任务执行桥接到现有执行器",
          `const invoke: TaskInvoke = async (action, args, context) => {
  if (context.signal.aborted) throw new Error("Cancelled");
  return executor.execute(action, JSON.stringify(args));
};`,
        ),
      ],
    },
  },

  registerTaskLookupActions: {
    parameters: {
      all: [
        p("host", 'Pick<VanillaHost, "registry" | "warn">', "Registry and warning sink that receive the generated read actions.", "接收生成只读动作的注册表与告警出口。", { required: true }),
        p("definitions", "readonly TaskDefinition[]", "Task definitions whose lookup fields should become actions.", "其 lookup 字段需要注册成动作的任务定义。", { required: true }),
        p("options.maxResults", "number", "Maximum candidates returned to the model. Defaults to 8 and is clamped to 1–50.", "返回给模型的最多候选数。默认 8，限制在 1–50。", { defaultValue: "8" }),
        p("options.actionId", "(field, task) => string", "Override the generated action id.", "覆盖生成的动作 id。"),
        p("options.description", "(field, task) => string", "Override the model-facing description.", "覆盖面向模型的说明。"),
        p("options.onWarning", "(message) => void", "Receives non-fatal conflicts, such as two fields claiming one action id.", "接收非致命冲突，例如两个字段声明了同一个动作 id。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Expose lookups as search actions",
          "把查找暴露成搜索动作",
          `const off = registerTaskLookupActions(pling, [
  {
    id: "lesson.note",
    title: "写课程备注",
    requiresRecord: true,
    fields: [{ name: "note", label: "备注", type: "textarea" }],
    steps: [{ label: "保存备注", action: "update_lesson_note" }],
  },
]);

// The model can now call search_studentRef before a write that needs the id.
off();`,
        ),
      ],
    },
  },

  TaskLookupActionOptions: {
    parameters: {
      all: [
        p("maxResults", "number", "Maximum candidates returned to the model.", "返回给模型的最多候选数。", { defaultValue: "8" }),
        p("actionId", "(field, task) => string", "Override the id derived from the field.", "覆盖从字段派生的动作 id。"),
        p("description", "(field, task) => string", "Override the model-facing description.", "覆盖面向模型的说明。"),
        p("onWarning", "(message) => void", "Receives non-fatal binding conflicts.", "接收非致命绑定冲突。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Reuse one search across tasks",
          "让多个任务共用一次搜索",
          `registerTaskLookupActions(pling, tasks, {
  actionId: (field, task) => task.id.startsWith("lesson.") ? "search_lessons" : "search_" + field.name,
  maxResults: 5,
});`,
        ),
      ],
    },
  },

  TaskLookupResult: {
    parameters: {
      all: [
        p("query", "string", "Normalized query that was executed.", "实际执行的规范化查询。"),
        p("minChars", "number", "Present when the query was too short; no search was run.", "查询过短时出现；此时没有执行搜索。"),
        p("choices", "TaskChoice[]", "At most maxResults candidates for the model to choose from.", "供模型选择的最多 `maxResults` 个候选。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Read the narrowed result",
          "读取收敛后的结果",
          `const result = await search_students({ query: "李" });
if (result.minChars) return askForMoreCharacters(result.minChars);
const [first, second] = result.choices;`,
        ),
      ],
    },
  },

  SurfaceTask: {
    parameters: {
      all: [
        p("id", "string", "Stable task id for external agents.", "面向外部 Agent 的稳定任务 id。", { required: true }),
        p("title", "string", "Human-facing task name.", "面向人的任务名称。", { required: true }),
        p("description", "string", "What the task accomplishes and when it is appropriate.", "任务完成什么，以及何时适用。"),
        p("examples", "readonly string[]", "Example requests an external agent can adapt.", "外部 Agent 可参考的示例说法。"),
        p("risk", '"read" | "write" | "destructive"', "Risk hint. The actual capability and session scope still decide whether an invoke is allowed.", "风险提示。真正能否调用仍由能力与会话范围决定。"),
        p("fields", "readonly SurfaceTaskField[]", "Descriptions of the values the task needs.", "任务所需字段的说明。"),
        p("steps", "readonly SurfaceTaskStep[]", "Existing capabilities that make up the task.", "组成该任务的已有能力。"),
        p("playbook", "readonly string[]", "Ordered operating notes for an external agent.", "给外部 Agent 的有序操作提示。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Describe a task without granting it",
          "描述任务，但不授予权限",
          `const tasks: SurfaceTask[] = [{
  id: "order.approve",
  title: "审批订单",
  steps: [{ action: "approve@order", label: "批准当前订单" }],
  risk: "destructive",
  playbook: ["先用 describe 读取订单字段", "确认订单状态后再调用审批能力"],
}];`,
        ),
      ],
    },
  },

  SurfaceTaskField: {
    parameters: {
      all: [
        p("name", "string", "Field name used in the task description.", "任务说明中的字段名。", { required: true }),
        p("label", "string", "Human-facing field label.", "面向人的字段名。", { required: true }),
        p("type", '"text" | "textarea" | "number" | "boolean" | "date" | "select" | "lookup"', "Input kind hint.", "输入类型提示。"),
        p("description", "string", "What the value means or how to obtain it.", "字段值的含义或获取方式。"),
        p("required", "boolean", "Whether the task normally needs this value.", "任务通常是否需要该值。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Describe a lookup field",
          "描述查找字段",
          `const fields: SurfaceTaskField[] = [{
  name: "studentRef",
  label: "学员",
  type: "lookup",
  required: true,
  description: "先搜索学员，再把返回值传给后续能力。",
}];`,
        ),
      ],
    },
  },

  SurfaceTaskStep: {
    parameters: {
      all: [
        p("action", "string", "Existing capability id.", "已有能力 id。", { required: true }),
        p("label", "string", "Human-facing step name.", "面向人的步骤名。", { required: true }),
        p("summary", "string", "Why the step exists or what it checks.", "为什么执行这一步，或它在检查什么。"),
        p("optional", "boolean", "Whether the step can be skipped.", "该步骤是否可跳过。"),
      ],
    },
    examples: {
      all: [
        ex(
          "Name existing capabilities only",
          "只引用已有能力",
          `const steps: SurfaceTaskStep[] = [
  { action: "search_orders", label: "搜索订单" },
  { action: "approve@order", label: "批准订单", optional: false },
];`,
        ),
      ],
    },
  },

  createTaskPanel: {
    parameters: {
      vanilla: [
        p("controller", "TaskController", "Task controller whose snapshots the panel renders.", "面板要渲染其快照的任务控制器。", { required: true }),
        p("options.locale", "string", "Locale for panel-owned labels. Task titles and field labels remain application-defined.", "面板自有文案的语言。任务标题与字段名仍由应用定义。", { defaultValue: '"en-US"' }),
        p("options.t", "(key, params?) => string", "Optional translator, for example pling.ui.t.", "可选翻译函数，例如 `pling.ui.t`。"),
        p("options.title", "string", "Heading above the task list.", "任务列表上方的标题。"),
        p("options.variant", '"panel" | "card"', "Standalone workspace or the compact conversation card. createTaskCard() sets card for you.", "独立工作区或紧凑的对话卡片。`createTaskCard()` 会自动使用 `card`。", { defaultValue: '"panel"' }),
        p("options.catalog", "boolean", "In card mode, show task entries while no run is active. Set false when the page already has its own entrances.", "卡片模式下，无运行任务时是否显示任务目录。页面已有入口时传 `false`。", { defaultValue: "true" }),
        p("options.initialTask", "string", "Open a task immediately instead of the list.", "直接打开某个任务，而不是显示列表。"),
        p("options.onPrompt", "(prompt, snapshot) => void", "Receives agent-mode prompts for handoff to the existing assistant.", "接收 Agent 模式提示词，交给现有助手入口。"),
        p("options.onComplete", "(snapshot) => void", "Called after a deterministic run finishes, fails, or is cancelled.", "确定性任务完成、失败或取消后调用。"),
      ],
    },
    examples: {
      vanilla: [
        ex(
          "Mount the reference task panel",
          "挂载参考任务面板",
          `import { createTaskPanel } from "@plingjs/vanilla";

const panel = createTaskPanel(controller, {
  locale: "zh-CN",
  initialTask: "course.schedule",
  onPrompt: (prompt) => pling.ask(prompt),
});
document.querySelector("#task-host")!.append(panel.element);`,
        ),
      ],
    },
  },

  createTaskCard: {
    parameters: {
      vanilla: [
        p("controller", "TaskController", "Task controller whose snapshots the card renders.", "任务卡要渲染其快照的任务控制器。", { required: true }),
        p("options.locale", "string", "Locale for card-owned labels. Task titles and field labels remain application-defined.", "卡片自有文案的语言。任务标题与字段名仍由应用定义。", { defaultValue: '"en-US"' }),
        p("options.t", "(key, params?) => string", "Optional translator, for example pling.ui.t.", "可选翻译函数，例如 `pling.ui.t`。"),
        p("options.title", "string", "Heading above the task card.", "任务卡上方的标题。"),
        p("options.catalog", "boolean", "Whether the task catalog is visible while no run is active. Set false when entrances live on the page.", "无运行任务时是否显示任务目录。入口在页面上时传 `false`。", { defaultValue: "true" }),
        p("options.initialTask", "string", "Open a task immediately instead of the catalog.", "直接打开某个任务，而不是显示目录。"),
        p("options.onPrompt", "(prompt, snapshot) => void", "Receives agent-mode prompts for the existing assistant.", "接收 Agent 模式提示词，交给现有助手。"),
        p("options.onComplete", "(snapshot) => void", "Called after a deterministic run finishes, fails, or is cancelled.", "确定性任务完成、失败或取消后调用。"),
      ],
    },
    examples: {
      vanilla: [
        ex(
          "Put the task card in the conversation",
          "把任务卡放进对话",
          `import { createTaskCard } from "@plingjs/vanilla";

const card = createTaskCard(controller, {
  locale: "zh-CN",
  catalog: false,
  onPrompt: (prompt) => pling.ask(prompt),
});

pling.dock({ layout: "sidebar", sidebarMode: "fused", task: card.element });
card.open("lesson.note", {}, { record: { id: lesson.id, label: lesson.course } });`,
        ),
      ],
    },
  },

  createTaskGuide: {
    parameters: {
      vanilla: [
        p("options.definition", "TaskGuideDefinition", "Human-facing steps and completion copy to render.", "要渲染的面向人的步骤与完成文案。", { required: true }),
        p("options.snapshot", "TaskRunSnapshot | null", "Initial task snapshot for dynamic rows and completion data.", "用于动态摘要与完成数据的初始任务快照。", { defaultValue: "null" }),
        p("options.step", "number", "One-based initial step.", "从 1 开始的初始步骤。", { defaultValue: "1" }),
        p("options.initialStep", "number", "Backward-compatible alias for the initial step.", "初始步骤的向后兼容别名。"),
        p("options.onCommand", "(command: TaskGuideCommand) => void", "Receives command names from primary, secondary, and completion buttons.", "接收主按钮、次按钮与完成按钮发出的命令名。", { required: true }),
      ],
    },
    examples: {
      vanilla: [
        ex(
          "Render a guide in a normal DOM container",
          "在普通 DOM 容器中渲染引导",
          `import { createTaskGuide } from "@plingjs/vanilla";

const guide = createTaskGuide({
  definition: courseGuide,
  snapshot: tasks.snapshot(),
  onCommand: (command) => runCourseCommand(command),
});

document.querySelector("#task-guide")!.replaceChildren(guide.element);`,
        ),
      ],
    },
  },

  GuidedTaskGuide: {
    parameters: {
      vanilla: [
        p("element", "readonly HTMLElement", "Host element produced by the renderer.", "渲染器生成的宿主元素。"),
        p("setSnapshot(snapshot)", "void", "Re-renders dynamic rows from a new task snapshot.", "用新的任务快照重新渲染动态摘要。"),
        p("setStep(step)", "void", "Moves the guide to a one-based step.", "切换到从 1 开始的指定步骤。"),
        p("setBusy(busy)", "void", "Disables commands and shows the active command's busy label.", "禁用命令，并显示当前命令的忙碌文案。"),
        p("setError(message)", "void", "Shows or clears a business-facing error.", "显示或清除面向业务的错误。"),
        p("complete()", "void", "Switches to the completion card.", "切换到完成卡。"),
        p("reset()", "void", "Returns from completion to the step view.", "从完成状态返回步骤视图。"),
        p("refresh()", "void", "Re-renders from the current snapshot and step.", "按当前快照与步骤重新渲染。"),
        p("destroy()", "void", "Releases DOM listeners and removes the host content when appropriate.", "释放 DOM 监听，并在适当时清理宿主内容。"),
      ],
    },
    examples: {
      vanilla: [
        ex(
          "Update one step without rebuilding the guide",
          "不重建引导，只更新当前步骤",
          `guide.setSnapshot(tasks.snapshot());
guide.setStep(2);
guide.setBusy(true);`,
        ),
      ],
    },
  },

  createGuideActions: {
    parameters: {
      core: [
        p("options.items", "readonly GuideActionItem[]", "Actions to show, in order. The renderer never adds an implicit action.", "要依次展示的操作。渲染器不会自动追加隐式操作。", { required: true }),
        p("options.onCommand", "(command: string) => void", "Receives the opaque command declared by the host. The renderer does not execute business logic.", "接收宿主声明的业务命令。渲染器本身不执行业务逻辑。", { required: true }),
        p("options.hint", "string", "Optional line above the row, such as “Check once before saving”. Hidden when empty.", "操作行上方的可选提示，例如“保存前再核对一次”。为空时隐藏。"),
        p("options.ariaLabel", "string", "Accessible name for the action group. Defaults to the localized “Task actions” catalog entry.", "操作组的无障碍名称。默认使用本地化的“任务操作”文案。"),
        p("options.locale", "string", "Locale for framework-owned fallback labels. Business copy is never translated by the renderer.", "框架自有兜底文案的语言。业务文案不会被渲染器翻译。"),
      ],
    },
    examples: {
      core: [
        ex(
          "Render a compact row with a long recommendation",
          "渲染带长推荐内容的紧凑操作行",
          `import { createGuideActions } from "@plingjs/dom";

const row = createGuideActions({
  ariaLabel: "Booking note actions",
  onCommand: (command) => runCourseCommand(command),
  items: [
    {
      id: "locate-note",
      label: "Point to the field",
      command: "focus-note",
      kind: "primary",
    },
    {
      id: "use-note",
      label: "Fill it in",
      preview: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      ariaLabel: "Fill in booking notes: Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      command: "apply-note",
      kind: "suggestion",
    },
    { id: "skip-note", label: "Skip", command: "skip-note", kind: "skip" },
  ],
});

document.querySelector("#course-actions")!.replaceChildren(row.element);`,
        ),
      ],
    },
  },
  AgentGuideActions: {
    parameters: {
      vue3: [
        p("items", "readonly GuideActionItem[]", "Actions to show, in order. Re-rendered in place when the array changes.", "要依次展示的操作。数组变化时原地更新，不重建宿主页面。", { required: true }),
        p("@command", "(command: string) => void", "Receives the opaque command declared by the host.", "接收宿主声明的业务命令。", { required: true }),
        p("hint", "string", "Optional line above the row.", "操作行上方的可选提示。"),
        p("aria-label", "string", "Accessible name for the action group.", "操作组的无障碍名称。"),
      ],
      react: [
        p("items", "readonly GuideActionItem[]", "Actions to show, in order. Re-rendered in place when the array changes.", "要依次展示的操作。数组变化时原地更新，不重建宿主页面。", { required: true }),
        p("onCommand", "(command: string) => void", "Receives the opaque command declared by the host.", "接收宿主声明的业务命令。", { required: true }),
        p("hint", "string", "Optional line above the row.", "操作行上方的可选提示。"),
        p("ariaLabel", "string", "Accessible name for the action group.", "操作组的无障碍名称。"),
      ],
    },
    examples: {
      vue3: [
        ex(
          "Put the row under the latest assistant message",
          "把操作行放在最新一条助手消息下方",
          `<AgentGuideActions
  :items="guideActions"
  :hint="reviewOpen ? '保存前再核对一次' : ''"
  aria-label="任务操作"
  @command="onGuideCommand"
/>`,
          "vue",
        ),
      ],
      react: [
        ex(
          "Put the row under the latest assistant message",
          "把操作行放在最新一条助手消息下方",
          `<AgentGuideActions
  items={guideActions}
  hint={reviewOpen ? "Check once before saving" : ""}
  ariaLabel="Task actions"
  onCommand={handleGuideCommand}
/>`,
          "tsx",
        ),
      ],
    },
  },
  GuideActionItem: {
    parameters: {
      core: [
        p("id", "string", "Stable id for tests and host bookkeeping. It is not sent to the model.", "用于测试与宿主记录的稳定 id，不会发送给模型。", { required: true }),
        p("label", "string", "Short verb shown on the button, for example “Fill it in” or “Point to · Course name”.", "按钮上的短动作，例如“自动填写”“定位 · 课程名称”。", { required: true }),
        p("command", "string", "Business-owned command emitted on click. The host decides what it means.", "点击时发出的业务命令，由宿主决定其含义。", { required: true }),
        p("kind", '"primary" | "secondary" | "suggestion" | "skip"', "Visual emphasis. A suggestion is the only kind that renders preview text.", "视觉强调。只有 `suggestion` 会渲染预览文本。"),
        p("preview", "string", "Long recommendation rendered as a single-line, ellipsised preview. The full value stays in title and aria-label.", "长推荐的单行省略预览。完整值保留在 `title` 与 `aria-label` 中。"),
        p("ariaLabel", "string", "Accessible name when the visible label omits the field name or the preview is truncated.", "当可见标签省略字段名或预览被截断时使用的无障碍名称。"),
        p("disabled", "boolean", "Disables the action while a write is running. Disabled buttons never emit a command.", "写入进行中时禁用操作。禁用按钮不会发出命令。"),
      ],
    },
    examples: {
      core: [
        ex(
          "Keep the value out of the label",
          "不要把手值拼进标签",
          `{
  id: "use-note",
  label: "Fill it in",
  preview: "Please arrive 10 minutes early…",
  ariaLabel: "Fill in booking notes: Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
  command: "apply-note",
  kind: "suggestion",
}`,
        ),
      ],
    },
  },
  AgentTaskGuide: {
    parameters: {
      vue3: [
        p("definition", "TaskGuideDefinition", "The human-facing guide to render.", "要渲染的面向人的引导。", { required: true }),
        p("snapshot", "TaskRunSnapshot | null", "Current task snapshot for dynamic rows and completion data.", "用于动态摘要与完成数据的当前任务快照。", { defaultValue: "null" }),
        p("step", "number", "One-based active step.", "从 1 开始的当前步骤。", { defaultValue: "1" }),
        p("busy", "boolean", "Disables commands while the page finishes the current step.", "页面完成当前步骤时禁用命令。", { defaultValue: "false" }),
        p("error", "string", "Business-facing error shown beside the guide.", "显示在引导旁的业务错误。"),
        p("completed", "boolean", "Shows the completion state.", "显示完成状态。", { defaultValue: "false" }),
        p("@command", "(command: TaskGuideCommand) => void", "Receives command names from guide buttons.", "接收引导按钮发出的命令名。"),
        p("ref.refresh()", "void", "Re-renders from the current props.", "按当前 props 重新渲染。"),
      ],
    },
    examples: {
      vue3: [
        ex(
          "Use the low-level guide directly",
          "直接使用低层引导",
          `<AgentTaskGuide
  :definition="active.guide"
  :snapshot="active.state.snapshot"
  :step="active.state.step ?? 1"
  :busy="active.state.busy ?? false"
  :completed="active.state.completed ?? false"
  @command="pling.task.command"
/>`,
        ),
      ],
    },
  },

  AgentTaskCard: {
    parameters: {
      vue3: [
        p("controller", "TaskController", "Task controller rendered by the shared DOM card.", "共享 DOM 任务卡要渲染的任务控制器。", { required: true }),
        p("title", "string", "Optional heading override. Task titles still come from the definition.", "可选标题覆盖；任务标题仍来自定义。"),
        p("catalog", "boolean", "Whether to show registered tasks while no run is active.", "无运行任务时是否显示已登记任务。", { defaultValue: "true" }),
        p("@prompt", "(prompt, snapshot) => void", "Agent-mode prompts, forwarded to the existing assistant.", "Agent 模式提示词，转交给现有助手。"),
        p("@complete", "(snapshot) => void", "Deterministic run completion.", "确定性任务完成回调。"),
        p("ref.open(taskId, values?, binding?)", "void", "Opens a task, optionally with a page-selected record.", "打开任务，可带页面已选记录。"),
        p("ref.setCatalog(visible)", "void", "Shows or hides the catalog without losing the current run.", "显示或隐藏目录，不丢失当前运行。"),
      ],
      react: [
        p("controller", "TaskController", "Task controller rendered by the shared DOM card.", "共享 DOM 任务卡要渲染的任务控制器。", { required: true }),
        p("title", "string", "Optional heading override. Task titles still come from the definition.", "可选标题覆盖；任务标题仍来自定义。"),
        p("catalog", "boolean", "Whether to show registered tasks while no run is active.", "无运行任务时是否显示已登记任务。", { defaultValue: "true" }),
        p("onPrompt", "(prompt, snapshot) => void", "Agent-mode prompts, forwarded to the existing assistant.", "Agent 模式提示词，转交给现有助手。"),
        p("onComplete", "(snapshot) => void", "Deterministic run completion.", "确定性任务完成回调。"),
        p("ref.open(taskId, values?, binding?)", "void", "Opens a task, optionally with a page-selected record.", "打开任务，可带页面已选记录。"),
        p("ref.setCatalog(visible)", "void", "Shows or hides the catalog without losing the current run.", "显示或隐藏目录，不丢失当前运行。"),
      ],
    },
    examples: {
      vue3: [
        ex(
          "Mount the card in AgentDock",
          "把任务卡放进 AgentDock",
          `<AgentDock layout="sidebar" sidebar-mode="fused" default-open>
  <template #task>
    <AgentTaskCard ref="card" :controller="tasks" @prompt="pling.ask" />
  </template>
</AgentDock>`,
        ),
      ],
      react: [
        ex(
          "Mount the card in AgentDock",
          "把任务卡放进 AgentDock",
          `<AgentDock
  layout="sidebar"
  sidebarMode="fused"
  defaultOpen
  task={<AgentTaskCard ref={card} controller={tasks} onPrompt={pling.ask} />}
/>`,
          "tsx",
        ),
      ],
    },
  },

  AgentTaskCardHandle: {
    parameters: {
      react: [
        p("open(taskId, values?, binding?)", "void", "Opens a task with optional initial values and the record already selected on the page.", "打开任务，可带初始字段值与页面已选记录。"),
        p("close()", "void", "Returns to the catalog or hides the card without destroying the controller.", "返回目录或隐藏任务卡，不销毁控制器。"),
        p("refresh()", "void", "Re-renders from the controller's current snapshot.", "按控制器当前快照重新渲染。"),
        p("setCatalog(visible)", "void", "Shows or hides the task catalog while preserving the active run and its values.", "显示或隐藏任务目录，同时保留当前运行及其字段值。"),
      ],
    },
    examples: {
      react: [
        ex(
          "Open a row-bound task",
          "打开绑定记录的任务",
          `card.current?.open("lesson.note", {}, {
  record: { id: lesson.id, label: lesson.course },
});`,
          "tsx",
        ),
      ],
    },
  },

  GuidedTaskPanelOptions: {
    parameters: {
      vanilla: [
        p("locale", "string", "Locale for panel-owned labels; defaults to en-US.", "面板自有文案的语言，默认 `en-US`。", { defaultValue: '"en-US"' }),
        p("t", "(key, params?) => string", "Translator used instead of the built-in catalog.", "替代内置文案目录的翻译函数。"),
        p("title", "string", "Custom heading above the task list.", "自定义任务列表标题。"),
        p("variant", '"panel" | "card"', "Standalone workspace or compact conversation card.", "独立工作区或紧凑的对话卡片。", { defaultValue: '"panel"' }),
        p("catalog", "boolean", "Card mode: show task entries while no run is active.", "卡片模式：无运行任务时是否显示任务目录。", { defaultValue: "true" }),
        p("initialTask", "string", "Task id to open on mount.", "挂载后立即打开的任务 id。"),
        p("onPrompt", "(prompt, snapshot) => void", "Handoff callback for agent-mode tasks.", "Agent 模式任务的提示词回传回调。"),
        p("onComplete", "(snapshot) => void", "Completion callback for deterministic tasks.", "确定性任务的完成回调。"),
      ],
    },
    examples: {
      vanilla: [
        ex(
          "Forward prompts into the assistant dock",
          "把提示词送入助手浮窗",
          `const options: GuidedTaskPanelOptions = {
  onPrompt: (prompt) => pling.ask(prompt),
  onComplete: (snapshot) => console.log(snapshot.status),
};`,
        ),
      ],
    },
  },

  GuidedTaskPanel: {
    parameters: {
      vanilla: [
        p("element", "HTMLElement", "The mounted panel element.", "已挂载的面板元素。"),
        p("open", "(taskId, values?, binding?) => void", "Opens one task with optional initial values and page bindings. Pass the selected record for tasks with requiresRecord.", "打开一个任务，可带初始字段值与页面绑定。`requiresRecord` 任务要在这里传入选中的记录。"),
        p("close", "() => void", "Hides the panel without destroying its controller.", "隐藏面板，不销毁控制器。"),
        p("refresh", "() => void", "Re-renders from the controller's current snapshot.", "按控制器当前快照重新渲染。"),
        p("setCatalog", "(visible: boolean) => void", "Shows or hides the task catalog without losing the current run.", "显示或隐藏任务目录，不丢失当前运行。"),
        p("destroy", "() => void", "Removes listeners and the panel element.", "移除监听器与面板元素。"),
      ],
    },
    examples: {
      vanilla: [
        ex(
          "Control panel lifecycle",
          "控制面板生命周期",
          `panel.open("teacher.create");
panel.close();
panel.destroy();`,
        ),
      ],
    },
  },
};
