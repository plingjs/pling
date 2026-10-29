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
        p("task", "PlingTaskController", "Task routing controller used by built-in surfaces.", "内置界面使用的任务路由控制器。"),
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
        p("task", "PlingTaskController", "Task routing controller used by built-in surfaces.", "内置界面使用的任务路由控制器。"),
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
        p("tool", "(element: Element, options: ToolOptions) => () => void", "Declares an element action and returns an unbind function.", "把元素声明成动作，并返回解绑函数。"),
        p("action", "(options: ActionOptions) => () => void", "Declares an action with no DOM element.", "声明一个没有 DOM 元素的动作。"),
        p("record", "(element: Element, value: RecordValue | null | undefined) => () => void", "Declares a row record and returns an unbind function.", "把一行数据声明成记录，并返回解绑函数。"),
        p("scope", "(element: Element, options: ScopeOptions) => () => void", "Declares a page region and returns an unbind function.", "声明页面区域，并返回解绑函数。"),
        p("state", "(key: string, source: StateSource, options?: StateOptions | string) => () => void", "Exposes a read-only state view and returns an unregister function.", "暴露只读状态视图，并返回注销函数。"),
        p("setActiveScopes", "(scopes: Iterable<string>) => void", "Overrides the active region set.", "覆盖活跃区域集合。"),
        p("dock", "(options?: VanillaDockOptions) => VanillaDock", "Mounts the native floating assistant and returns its controller.", "挂载原生浮动助手，并返回控制器。"),
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
    },
    examples: {
      vue3: [ex("Expose a form error", "暴露表单错误", `<p v-feedback="error ? { message: error, field: 'email', severity: 'error' } : null" />`)],
      react: [ex("Expose a form error", "暴露表单错误", `usePlingFeedback(error ? { message: error, field: "email", severity: "error" } : null);`, "tsx")],
    },
  },

  "task-entry": {
    parameters: {
      vue3: [p("v-task", "string | TaskOptions", "A prompt string, or an object with prompt, surface, and disabled.", "提示词字符串，或包含 `prompt`、`surface`、`disabled` 的对象。", { required: true })],
      react: [p("prompt", "string", "Natural-language task sent to the mounted assistant surface.", "发送给已挂载助手界面的自然语言任务。", { required: true }), p("options.surface", "string", "Named surface id. Omit it when only one surface is mounted.", "具名界面 id。只挂载一个界面时可省略。"), p("options.source", "Element", "Element that triggered the task, for custom hosts and diagnostics.", "触发任务的元素，供自定义宿主与诊断使用。")],
    },
    examples: {
      vue3: [ex("Route a human task", "转交一条用户任务", `<button v-task="'整理今天的待办并标出最紧急的一项'">让助手整理</button>`)],
      react: [ex("Route a human task", "转交一条用户任务", `await pling.ask("整理今天的待办并标出最紧急的一项", { surface: "dock" });`, "tsx")],
    },
  },

  "guide-target": {
    parameters: {
      all: [p("id", "string", "Guide target id referenced by a HandoffStep.highlight value.", "被 `HandoffStep.highlight` 引用的引导目标 id。", { required: true })],
    },
    examples: {
      vue3: [ex("Highlight a handoff target", "高亮人工接力目标", `<input v-guide-target="'captcha'" />`)],
      react: [ex("Highlight a handoff target", "高亮人工接力目标", `const captchaRef = usePlingGuideTarget<HTMLInputElement>("captcha");\n\nreturn <input ref={captchaRef} />;`, "tsx")],
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
    },
    examples: {
      vue3: [ex("Allow BYOK on a trusted page", "在可信页面允许自带密钥", `createPling({\n  agent: { modelSettings: { mode: "byok", persist: "session" } },\n});`)],
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
        p("defaultOpen", "boolean", "Whether the surface starts open.", "界面是否默认展开。", { defaultValue: "false" }),
        p("config", "AgentConfigOverrides", "Overrides model and runtime settings for this surface only.", "只覆盖当前界面的模型与运行时设置。"),
        p("llm", "Llm", "Injected model function for this surface. Overrides application-level agent.llm.", "当前界面使用的模型函数，覆盖应用级 `agent.llm`。"),
        p("hooks", "HookRegistry", "Tool hooks for this surface. Falls back to application-level hooks.", "当前界面的工具钩子。未传时使用应用级钩子。"),
        p("gate", "() => boolean", "Confirmation-channel switch for this surface.", "当前界面的确认通道开关。"),
        p("registry", "Registry", "Action registry to operate. Defaults to the injected Pling registry.", "要操作的注册表。默认使用注入的 Pling 注册表。"),
        p("navigate", "(href: string) => void", "Navigation implementation after a completed task. Defaults to window.location.replace.", "任务完成后的导航实现。默认调用 `window.location.replace`。"),
        p("layout", '"dock" | "sidebar"', "Floating corner layout or viewport-edge sidebar.", "浮动角落布局或视口侧边栏。", { defaultValue: '"dock"' }),
        p("side", '"left" | "right"', "Sidebar edge when layout is sidebar.", "侧边栏模式下的贴边方向。", { defaultValue: '"right"' }),
        p("launcherPlacement", '"bottom" | "center"', "Position of the collapsed sidebar launcher.", "侧边栏收起后启动按钮的位置。", { defaultValue: '"bottom"' }),
        p("launcherLabel", "string", "Custom label for the collapsed launcher.", "收起状态启动按钮的自定义文案。"),
        p("debug", "boolean | AgentTraceOptions", "Enables the read-only request inspector inside Activity. Disabled by default.", "在“运行”中开启只读请求诊断器。默认关闭。", { defaultValue: "false" }),
        p("modelSettings", "ModelSettingsSetting", "Shows application model settings or permits BYOK in Activity.", "在“运行”中展示应用模型配置，或允许用户自带密钥。", { defaultValue: "off" }),
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
        p("side", '"left" | "right"', "Sidebar edge when layout is sidebar.", "侧边栏模式下的贴边方向。", { defaultValue: '"right"' }),
        p("launcherPlacement", '"bottom" | "center"', "Position of the collapsed sidebar launcher.", "侧边栏收起后启动按钮的位置。", { defaultValue: '"bottom"' }),
        p("launcherLabel", "string", "Custom label for the collapsed launcher.", "收起状态启动按钮的自定义文案。"),
        p("surfaceId", "string", "Named surface used by pling.ask({ surface }). Built-in docks default to dock.", "供 `pling.ask({ surface })` 路由的具名界面。内置浮窗默认 `dock`。", { defaultValue: '"dock"' }),
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
        p("quick", "readonly string[]", "Suggested prompts.", "推荐指令。", { defaultValue: "[]" }),
        p("config", "AgentConfigOverrides", "Surface-level model overrides.", "当前界面的模型覆盖。"),
        p("llm", "Llm", "Injected model function.", "注入的模型函数。"),
        p("hooks", "HookRegistry", "Surface-level tool hooks.", "当前界面的工具钩子。"),
        p("gate", "() => boolean", "Confirmation-channel switch.", "确认通道开关。"),
        p("registry", "Registry", "Registry to operate.", "要操作的注册表。"),
        p("navigate", "(href: string) => void", "Post-task navigation implementation.", "任务完成后的导航实现。"),
        p("visible", "boolean", "Controls visibility without unmounting, so conversation state survives collapse.", "控制是否可见但不卸载，从而保留对话状态。", { defaultValue: "true" }),
        p("variant", '"dock" | "inline"', "Compact dock width or a normal inline layout.", "使用紧凑浮窗宽度或常规内联布局。", { defaultValue: '"inline"' }),
        p("manageSurface", "boolean", "Registers this component with the page task router. Docks set it to false because the shell owns routing.", "把组件注册到页面任务路由器。浮窗外壳自己负责路由，因此传 `false`。", { defaultValue: "true" }),
        p("surfaceId", "string", "Task-routing name when manageSurface is enabled.", "启用 `manageSurface` 时用于任务路由的名称。", { defaultValue: '"inline"' }),
        p("collapsible", "boolean", "Shows the collapse control used by the dock shell.", "显示浮窗外壳使用的收起按钮。", { defaultValue: "false" }),
        p("debug", "boolean | AgentTraceOptions", "Enables the read-only request inspector.", "开启只读请求诊断器。", { defaultValue: "false" }),
        p("modelSettings", "ModelSettingsSetting", "Model settings entry in Activity.", "“运行”中的模型设置入口。", { defaultValue: "off" }),
        p("@event", "(event: SessionEvent) => void", "Session event stream.", "会话事件流。"),
        p("@collapse", "() => void", "Requests that the parent shell collapse the surface.", "请求父级外壳收起界面。"),
        p("@status", "(status: { running; resume }) => void", "Reports running state and resume availability.", "报告运行状态与是否有可恢复任务。"),
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
        p("tools", "boolean", "Includes raw tool-call lines in the transcript.", "在对话中显示原始工具调用行。", { defaultValue: "false" }),
        p("reveal", "(text: string) => string", "Render-only text transform, commonly used to reveal sensitive tokens.", "仅用于渲染的文本转换，常用于还原敏感值代号。"),
        p("resume", "{ goal?: string; interrupted?: boolean } | null", "Shows the continue-previous-task banner.", "显示“继续上次任务”提示。", { defaultValue: "null" }),
        p("@send", "(text: string) => void", "User submitted a message.", "用户提交消息。"),
        p("@reply", '(decision: boolean | "always") => void', "User answered an approval request.", "用户回答了确认请求。"),
        p("@handoff", "(done: boolean) => void", "User completed or cancelled a handoff.", "用户完成或取消人工接力。"),
        p("@handoffStep", "(delta: number) => void", "User moved between handoff steps.", "用户切换人工接力步骤。"),
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
        p("ui", "PlingUiController", "Locale and theme controller. Defaults to an English standalone controller.", "语言与主题控制器。默认使用英文独立控制器。"),
        p("className", "string", "Extra class for the outer chat surface.", "外层对话界面的附加 class。"),
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

  createPlingUi: {
    parameters: {
      vue3: [
        ...uiOptions.map((row) => ({ ...row, name: row.name.replace(/^ui\./, "") })),
        p("defaultLocale", "string", "Fallback locale used when ui.locale is not supplied.", "未传 `ui.locale` 时使用的兜底语言。", { defaultValue: "en-US" }),
      ],
    },
    examples: {
      vue3: [ex("Create a standalone UI controller", "创建独立界面控制器", `const ui = createPlingUi({ locale: "zh-CN", theme: "auto" });\nui.setTheme("dark");\nconsole.log(ui.t("chat.send"));`)],
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
    },
    examples: {
      vue3: [ex("Expose route identity without tokens", "暴露路由身份但不暴露令牌", `createPling({\n  page: {\n    queryKeys: ["tab"],\n    title: () => route.meta.title as string | undefined,\n  },\n});`)],
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
        p("return.total", "number", "Recognized actionable controls in the root.", "根元素内识别到的可操作控件总数。"),
        p("return.declared", "number", "Controls with a direct declaration.", "有直接声明的控件数。"),
        p("return.derived", "number", "Controls produced by optional L1 derivation.", "由可选 L1 派生生成的动作数。"),
        p("return.grouped", "number", "Controls covered by a declaration on an ancestor. Review these manually.", "由祖先声明覆盖的控件数。需要人工复核映射关系。"),
        p("return.missing", "number", "Actionable controls with no declaration in their ancestry.", "祖先链上没有任何声明的可操作控件数。"),
        p("return.coveragePercent", "number | null", "Covered controls divided by total; null when there are no controls.", "覆盖控件数除以总数；没有控件时为 `null`。"),
        p("return.targets", "CoverageTarget[]", "Grouped and missing controls with labels and nearby action ids.", "分组与缺失控件列表，包含标签和附近动作 id。"),
      ],
    },
    examples: {
      vue3: [ex("Inspect Vue coverage", "检查 Vue 覆盖率", `const report = pling.inspectCoverage();\nconsole.log(report.coveragePercent, report.targets);`)],
      react: [ex("Inspect React coverage", "检查 React 覆盖率", `const report = pling.inspectCoverage(document.getElementById("root"));`, "tsx")],
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
        p("context", "ContextOptions", "Bounds for actions, records, state, scopes, feedback, and page identity in model context.", "模型上下文中动作、记录、状态、区域、反馈与页面身份的有界设置。"),
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
};
