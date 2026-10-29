<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

type Locale = "zh" | "en";
type CodeTab = "vue" | "react" | "vanilla";

const props = defineProps<{ locale: Locale }>();

const copy = {
  zh: {
    kicker: "Pling · 页灵 / Page Intelligence",
    titleLead: "让应用能力",
    titleAccent: "变成可控资产。",
    lede: "Pling 是 Web 应用的 Agent 能力层：把已有操作变成可发现、可调用、可授权、可审计的能力资产。",
    aside: "不用重写应用，也不让 Agent 靠截图猜下一步。",
    primaryCta: "5 分钟接入",
    secondaryCta: "运行一个真实案例",
    trust: ["Apache-2.0", "Vue · React · Vanilla", "Agent Surface 0.1"],
    traceTitle: "一次可核验的操作",
    traceLive: "实时轨迹",
    traceRun: "重新运行",
    traceRunning: "正在运行",
    traceTask: "任务",
    tracePrompt: "把「预约设计评审」标记完成",
    pageLabel: "页面",
    pageTitle: "待办工作台",
    pageCount: "3 条记录",
    pageSummary: "2 项未完成",
    pageTasks: [
      { text: "检查发布清单", state: "未完成" },
      { text: "预约设计评审", state: "未完成", target: true },
      { text: "跟进客户", state: "已完成", done: true },
    ],
    pageCapabilities: "当前开放 3 个动作",
    agentLabel: "Agent",
    agentKind: "外部客户端",
    agentWaiting: "读取能力面…",
    actionName: "toggle",
    actionArg: '{ record: "t2" }',
    actionNote: "已声明的记录级动作",
    resultLabel: "页面已核验",
    resultValue: "open → completed",
    resultNote: "返回的是一条执行证据，而不是一句“完成”。",
    bridgeLabel: "Pling",
    bridgeItems: ["describe", "invoke", "verify"],
    traceSteps: ["读取能力", "选择动作", "页面执行", "核验结果"],
    traceMetrics: ["1 个区域", "3 条记录", "3 个动作"],
    valueEyebrow: "谁最需要 · 得到什么",
    valueTitle: "把 AI 从信息提供，\n变成可交付的业务能力。",
    valueBody: "Pling 面向已经在真实业务中使用 Web 应用的团队：不推翻现有产品，也不把控制权交给模型。",
    valuePainLabel: "痛点",
    valueGainLabel: "接入后",
    valueCards: [
      {
        index: "01",
        who: "已上线的 Web 产品",
        title: "让 AI 真正进入业务流程",
        pain: "AI 只能聊天，复杂操作仍要用户自己完成。",
        gain: "已有页面动作直接成为 Agent 能力，不用重做产品。",
      },
      {
        index: "02",
        who: "复杂后台与企业系统",
        title: "每一次操作都可定位、可确认、可核验",
        pain: "截图点击不知道影响哪条记录，也不敢开放高风险动作。",
        gain: "记录 id、风险分级、确认与执行证据进入同一条调用链。",
      },
      {
        index: "03",
        who: "向第三方 Agent 开放能力的平台",
        title: "开放能力，不交出系统",
        pain: "开放 API 太重，交出 DOM 又无法治理。",
        gain: "只暴露选定的能力面，权限与撤销仍由应用和后端决定。",
      },
      {
        index: "04",
        who: "Vue / React / 原生 JS / 旧系统",
        title: "从一两个动作开始，不推翻现有实现",
        pain: "为 AI 重写界面和业务层，成本和风险都不可控。",
        gain: "保留组件、状态、校验和权限，逐步扩大可操作范围。",
      },
    ],
    problemEyebrow: "问题不在模型不够聪明",
    problemTitle: "它看得见按钮，却不知道这个按钮意味着什么。",
    problemBody:
      "同一个 DOM，可以渲染出两个外观完全相同的按钮。对页面来说，一个是“通过订单”，另一个是“拒绝订单”；对只看到标签、坐标或截图的 Agent 来说，它们几乎没有区别。",
    problemBodyTwo:
      "缺的不是点击能力，而是对象、语义、风险、权限和结果。Pling 把这层事实放回界面本来就有定义的地方。",
    domLabel: "只有界面",
    domCaption: "模型需要试探、截图、再试探。",
    domButtonA: "通过",
    domButtonB: "拒绝",
    domUnknowns: ["影响哪条记录？", "这是不是高风险操作？", "当前用户有权限吗？", "执行成功了吗？"],
    capabilityLabel: "有能力面的页面",
    capabilityCaption: "每个操作都带着完成一次业务动作所需的最小事实。",
    capabilityName: "approve_order",
    capabilityRows: [
      ["record", "order:1042"],
      ["kind", "danger"],
      ["confirm", "required"],
      ["result", "status → approved"],
    ],
    capabilityReady: "对象、风险、授权点与结果，均可被模型和审计系统读取。",
    loopEyebrow: "执行闭环",
    loopTitle: "页面负责执行，契约负责说明。",
    loopBody:
      "Pling 不把浏览器变成一个新的自动化入口。它让 Agent 在页面声明的能力中选择，再由页面自己的事件、校验和业务函数完成操作。",
    loopSteps: [
      {
        index: "01",
        title: "声明",
        body: "在原有控件上补充稳定 id、业务说明与风险分类。",
      },
      {
        index: "02",
        title: "投影",
        body: "只向模型提供当前区域、相关记录和真正可执行的动作。",
      },
      {
        index: "03",
        title: "执行",
        body: "调用沿页面原有路径运行，不绕过组件、校验或服务端权限。",
      },
      {
        index: "04",
        title: "核验",
        body: "返回执行前后的可观察变化；成功必须能被验证。",
      },
    ],
    loopCodeLabel: "在原按钮上增加一条语义声明",
    loopFootnote: "没有声明，就不在能力面内。没有授权，可用也不等于可执行。",
    benefitsEyebrow: "为什么是能力层",
    benefitsTitle: "更快，不是因为动作更多，而是因为猜测更少。",
    benefitsBody: "精准、省 token、安全与可审计来自同一条设计约束：让 Agent 只看见完成当前任务所需的东西。",
    benefitPrecisionTag: "精准",
    benefitPrecisionTitle: "面向记录与动作，不面向像素。",
    benefitPrecisionBody: "稳定的记录 id 与动作 id，让“第 2 条”始终指向同一条业务数据，而不是屏幕上的某个坐标。",
    benefitPrecisionUi: ["记录 t2", "动作 toggle@t2", "页面处理函数"],
    benefitContextTag: "上下文",
    benefitContextTitle: "上下文有边界，Agent 才不必反复试探。",
    benefitContextBody: "当前区域、命中的记录、可执行的动作；没有整棵 DOM，也没有整个前端状态仓库。",
    benefitContextBefore: "页面全量",
    benefitContextAfter: "当前能力面",
    benefitContextItems: ["区域 1", "记录 3", "动作 3"],
    benefitSafetyTag: "安全",
    benefitSafetyTitle: "Agent 拿不到 click(selector)，也无法执行 eval()。",
    benefitSafetyBody: "Agent 不能凭空获得页面的全部操作权。能力是否出现、是否可用、是否需要确认，都由应用决定。",
    benefitSafetyBadge: "未声明 → 不可调用",
    benefitAuditTag: "证据",
    benefitAuditTitle: "“完成”必须能被检查。",
    benefitAuditBody: "执行记录包含动作、目标、结果、确认与变更证据。失败也能明确区分“没有执行”和“执行后未生效”。",
    benefitAuditBadge: "open → completed",
    benefitSurfaceTag: "Agent Surface",
    benefitSurfaceTitle: "一份能力，多个 Agent。",
    benefitSurfaceBody: "页面内助手和页面外客户端使用同一组声明。外部 Agent 不接触 DOM、密钥或底层实现。",
    benefitSurfaceClients: ["页面助手", "Codex", "Claude / Hermes"],
    surfaceEyebrow: "Agent Surface",
    surfaceTitle: "把界面能力变成可治理的应用资产。",
    surfaceBody:
      "不是把整个应用交给 Agent。应用先决定哪些能力可以被发现、被谁调用、在什么条件下调用；协议只定义 describe 与 invoke，不提供选择器点击或脚本执行。",
    surfacePoints: ["按身份与场景限制暴露范围", "风险动作保留确认与人工接力", "委托、撤销与调用记录可供审计"],
    surfaceLink: "了解 Agent Surface",
    surfaceMatrixTitle: "能力暴露矩阵",
    surfaceMatrixHint: "同一份能力目录，按使用场景开放不同范围。",
    surfaceColumns: ["页面内", "外部 Agent", "自动化"],
    surfaceRows: [
      { name: "view_orders", detail: "查看订单与状态", access: [true, true, true] },
      { name: "update_note", detail: "修改订单备注", access: [true, true, false] },
      { name: "refund_order", detail: "退款，需人工确认", access: [true, false, false] },
    ],
    surfaceMatrixFoot: "暴露范围由应用与后端共同决定；协议本身不携带任何隐式权限。",
    startEyebrow: "接入",
    startTitle: "是补充，不是重写。",
    startBody:
      "保留组件、状态、表单、校验和权限。只需要把已有的操作说清楚，并在入口创建一次运行时。",
    startPoints: ["业务状态与渲染不变", "动作落到真实控件", "未声明的能力保持关闭"],
    codeTabs: { vue: "Vue", react: "React", vanilla: "Vanilla" },
    codeCaption: "已有按钮，增加一条能力声明：",
    codeDocs: "阅读接入教程",
    examplesEyebrow: "真实案例",
    examplesTitle: "不是录屏，而是可以打开、操作、检查源码的应用。",
    examplesBody: "五个案例覆盖从最小闭环到外部 Agent。每个案例都保留真实业务组件，并在同一套执行路径上接入模型。",
    allExamples: "查看全部案例",
    openCase: "打开案例",
    cases: [
      {
        index: "01",
        title: "待办事项",
        detail: "最小可用闭环：真实 Todo、声明动作、模型执行与结果核验。",
        tags: ["Vue 3", "最小接入"],
        href: "/examples/quickstart",
      },
      {
        index: "02",
        title: "订单工作台",
        detail: "记录、行内动作、确认与证据，在一张真实业务表上展开。",
        tags: ["Vue 3", "业务工作台"],
        href: "/examples/orders",
      },
      {
        index: "03",
        title: "单页多路由工作台",
        detail: "任务跨路由继续，页面身份与可用能力随当前页面更新。",
        tags: ["Vue Router", "任务连续性"],
        href: "/examples/vue3-spa-routing",
      },
      {
        index: "04",
        title: "多页工作台",
        detail: "整页导航之后，目标、上下文与执行边界仍然连续。",
        tags: ["MPA", "上下文恢复"],
        href: "/examples/multi-page-continuity",
      },
      {
        index: "05",
        title: "暴露能力给外部",
        detail: "通过 Surface 连接 Codex、Claude 等外部 Agent，权限仍留在页面与后端。",
        tags: ["Agent Surface", "MCP"],
        href: "/examples/external-agent-surface",
      },
    ],
    finalEyebrow: "从第一个动作开始",
    finalTitle: "给页面一份 Agent 真正能读懂的能力面。",
    finalBody: "十分钟内，让模型在一个真实页面上完成一次可验证的操作。",
    finalPrimary: "开始接入",
    finalSecondary: "先理解运行原理",
    footerTagline: "给页面赋予灵魂。",
    footerLinks: ["文档", "在线案例", "协议", "许可证"],
  },
  en: {
    kicker: "Pling · Page Intelligence",
    titleLead: "App actions,",
    titleAccent: "governed as assets.",
    lede: "Pling is the Agent capability layer for web applications: existing operations become capabilities a model can discover, invoke, authorize, and audit.",
    aside: "Keep the application. Remove the guessing.",
    primaryCta: "Get started in 5 minutes",
    secondaryCta: "Run a real example",
    trust: ["Apache-2.0", "Vue · React · Vanilla", "Agent Surface 0.1"],
    traceTitle: "One verified operation",
    traceLive: "Live trace",
    traceRun: "Run again",
    traceRunning: "Running",
    traceTask: "Task",
    tracePrompt: "Mark “Design review” as complete",
    pageLabel: "Page",
    pageTitle: "Todo workspace",
    pageCount: "3 records",
    pageSummary: "2 open",
    pageTasks: [
      { text: "Check the release list", state: "open" },
      { text: "Design review", state: "open", target: true },
      { text: "Follow up with the customer", state: "done", done: true },
    ],
    pageCapabilities: "3 actions exposed",
    agentLabel: "Agent",
    agentKind: "external client",
    agentWaiting: "Reading the capability surface…",
    actionName: "toggle",
    actionArg: '{ record: "t2" }',
    actionNote: "declared record action",
    resultLabel: "Verified by the page",
    resultValue: "open → completed",
    resultNote: "The result is evidence, not merely the word “done”.",
    bridgeLabel: "Pling",
    bridgeItems: ["describe", "invoke", "verify"],
    traceSteps: ["Read", "Choose", "Execute", "Verify"],
    traceMetrics: ["1 region", "3 records", "3 actions"],
    valueEyebrow: "Who needs it · What changes",
    valueTitle: "Move AI beyond answers—into business capabilities you can ship.",
    valueBody: "Pling is for teams whose web application already runs real work—and who need agents to participate without rebuilding the product or giving up control.",
    valuePainLabel: "Friction",
    valueGainLabel: "With Pling",
    valueCards: [
      {
        index: "01",
        who: "Live web products",
        title: "Let AI enter the real workflow",
        pain: "The assistant can chat, but users still perform the actual work.",
        gain: "Existing interface actions become agent capabilities without rebuilding the product.",
      },
      {
        index: "02",
        who: "Complex back offices",
        title: "Every operation is located, confirmable, and verifiable",
        pain: "Screenshot clicks do not identify the record or justify a high-risk action.",
        gain: "Record ids, risk levels, confirmation, and evidence share one execution path.",
      },
      {
        index: "03",
        who: "Platforms exposing capabilities",
        title: "Open the capability, not the whole system",
        pain: "A broad API is too much; handing over the DOM is impossible to govern.",
        gain: "Expose only selected capabilities while the app and backend retain authority.",
      },
      {
        index: "04",
        who: "Vue, React, vanilla, and legacy apps",
        title: "Start with one or two actions",
        pain: "Rewriting the interface and business layer for AI is too costly and risky.",
        gain: "Keep components, state, validation, and permissions; expand the surface gradually.",
      },
    ],
    problemEyebrow: "The model is not the problem",
    problemTitle: "It can see the button. It cannot infer the operation.",
    problemBody:
      "The same DOM can render two identical-looking buttons. To the page, one approves an order and the other rejects it. To an agent reading labels, pixels, or a screenshot, they are almost indistinguishable.",
    problemBodyTwo:
      "What is missing is not a click. It is the object, meaning, risk, permission, and outcome. Pling restores that information where the interface already defines it.",
    domLabel: "Interface only",
    domCaption: "The agent has to probe, capture, and probe again.",
    domButtonA: "Approve",
    domButtonB: "Reject",
    domUnknowns: ["Which record?", "Is this high risk?", "Is this user allowed?", "Did it succeed?"],
    capabilityLabel: "Interface with a capability surface",
    capabilityCaption: "Every operation carries the minimum facts needed to complete one business action.",
    capabilityName: "approve_order",
    capabilityRows: [
      ["record", "order:1042"],
      ["kind", "danger"],
      ["confirm", "required"],
      ["result", "status → approved"],
    ],
    capabilityReady: "Object, risk, authority, and outcome are legible to both the agent and the audit trail.",
    loopEyebrow: "The execution loop",
    loopTitle: "The page executes. The contract explains.",
    loopBody:
      "Pling does not turn the browser into a new automation backdoor. The agent chooses from declared capabilities; the page's own events, validation, and business functions perform the operation.",
    loopSteps: [
      { index: "01", title: "Declare", body: "Attach a stable id, business meaning, and risk class to an existing control." },
      { index: "02", title: "Project", body: "Send only the active region, relevant records, and genuinely available actions." },
      { index: "03", title: "Execute", body: "Run through the page's existing path. Do not bypass the component or backend authorization." },
      { index: "04", title: "Verify", body: "Return an observable change. Success has to be checkable." },
    ],
    loopCodeLabel: "One semantic declaration on an existing button",
    loopFootnote: "No declaration means no capability. Available never means authorized.",
    benefitsEyebrow: "Why a capability layer",
    benefitsTitle: "Faster because there is less to guess—not because there are more actions.",
    benefitsBody: "Precision, token economy, safety, and auditability follow from one constraint: show the agent only what this task needs.",
    benefitPrecisionTag: "Precision",
    benefitPrecisionTitle: "Records and actions, not pixels.",
    benefitPrecisionBody: "Stable record and action ids keep “the second item” tied to the same business object instead of a coordinate on a screen.",
    benefitPrecisionUi: ["record t2", "action toggle@t2", "page handler"],
    benefitContextTag: "Context",
    benefitContextTitle: "A bounded context ends exploration.",
    benefitContextBody: "The active region, matched records, and available actions. No whole DOM. No complete client store.",
    benefitContextBefore: "Entire page",
    benefitContextAfter: "Current surface",
    benefitContextItems: ["1 region", "3 records", "3 actions"],
    benefitSafetyTag: "Safety",
    benefitSafetyTitle: "No click(selector). No eval().",
    benefitSafetyBody: "An agent does not acquire the page's full control surface by default. The application decides what is visible, available, and confirmation-gated.",
    benefitSafetyBadge: "undeclared → uncallable",
    benefitAuditTag: "Evidence",
    benefitAuditTitle: "“Done” has to be checkable.",
    benefitAuditBody: "Every run records the action, target, result, confirmation, and observed change. Failures distinguish “not executed” from “executed but not observed”.",
    benefitAuditBadge: "open → completed",
    benefitSurfaceTag: "Agent Surface",
    benefitSurfaceTitle: "One capability set. Many agents.",
    benefitSurfaceBody: "The in-page assistant and external clients share the same declarations. External agents never receive the DOM, provider keys, or implementation details.",
    benefitSurfaceClients: ["In-page", "Codex", "Claude / Hermes"],
    surfaceEyebrow: "Agent Surface",
    surfaceTitle: "Turn interface capability into a governed application asset.",
    surfaceBody:
      "This is not handing the whole application to an agent. The application decides which capabilities can be discovered, by whom, and under what conditions. The protocol defines describe and invoke—not selector clicks or script execution.",
    surfacePoints: ["Expose by identity and context", "Keep confirmation and handoff for risky actions", "Make delegation, revocation, and invocation records auditable"],
    surfaceLink: "Read about Agent Surface",
    surfaceMatrixTitle: "Capability exposure",
    surfaceMatrixHint: "One capability catalogue, with different surfaces for different clients.",
    surfaceColumns: ["In-page", "External", "Automation"],
    surfaceRows: [
      { name: "view_orders", detail: "Read orders and status", access: [true, true, true] },
      { name: "update_note", detail: "Edit an order note", access: [true, true, false] },
      { name: "refund_order", detail: "Refund, with human approval", access: [true, false, false] },
    ],
    surfaceMatrixFoot: "The application and its backend decide exposure. The protocol carries no implicit authority.",
    startEyebrow: "Integration",
    startTitle: "An addition, not a rewrite.",
    startBody: "Keep your components, state, forms, validation, and permissions. Describe operations that already exist, then create one runtime at the application entry point.",
    startPoints: ["Business state and rendering stay intact", "Actions attach to real controls", "Undeclared capabilities stay closed"],
    codeTabs: { vue: "Vue", react: "React", vanilla: "Vanilla" },
    codeCaption: "An existing button gains one capability declaration:",
    codeDocs: "Read the integration guide",
    examplesEyebrow: "Real applications",
    examplesTitle: "Not recordings. Pages you can open, operate, and inspect.",
    examplesBody: "Five examples move from the smallest loop to external agents. Each keeps its real business components and joins the model through the same execution path.",
    allExamples: "Explore all examples",
    openCase: "Open example",
    cases: [
      { index: "01", title: "Todo", detail: "The smallest useful loop: a real Todo, a declared action, model execution, and verification.", tags: ["Vue 3", "Minimal"], href: "/examples/quickstart" },
      { index: "02", title: "Order workspace", detail: "Records, row actions, approval, and evidence on a real business table.", tags: ["Vue 3", "Workspace"], href: "/examples/orders" },
      { index: "03", title: "Single-page routing", detail: "A task continues across routes while identity and capabilities follow the current page.", tags: ["Vue Router", "Continuity"], href: "/examples/vue3-spa-routing" },
      { index: "04", title: "Multi-page workspace", detail: "A full navigation still preserves the goal, context, and execution boundary.", tags: ["MPA", "Continuity"], href: "/examples/multi-page-continuity" },
      { index: "05", title: "External capability surface", detail: "Connect Codex, Claude, and other agents through Surface while authority stays with the page and backend.", tags: ["Agent Surface", "MCP"], href: "/examples/external-agent-surface" },
    ],
    finalEyebrow: "Start with one action",
    finalTitle: "Give your interface a capability surface agents can actually read.",
    finalBody: "In ten minutes, let a model complete one verified operation on a real page.",
    finalPrimary: "Start building",
    finalSecondary: "See how it works",
    footerTagline: "Give every page a soul.",
    footerLinks: ["Docs", "Cases", "Specification", "License"],
  },
} as const;

const text = computed(() => copy[props.locale]);
const langPrefix = computed(() => (props.locale === "zh" ? "/zh" : ""));
const route = (path: string) => `${langPrefix.value}${path}`;

const rootEl = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | undefined;

onMounted(() => {
  const nodes = rootEl.value?.querySelectorAll<HTMLElement>("[data-reveal]");
  if (!nodes?.length) return;

  if (typeof IntersectionObserver === "undefined") {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add("is-visible");
        observer?.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  nodes.forEach((node) => observer?.observe(node));
});

onUnmounted(() => {
  observer?.disconnect();
  traceTimers.forEach((timer) => window.clearTimeout(timer));
});

const traceStage = ref(4);
const tracePlaying = ref(false);
const traceTimers: number[] = [];

function runTrace(): void {
  traceTimers.forEach((timer) => window.clearTimeout(timer));
  traceTimers.length = 0;
  tracePlaying.value = true;
  traceStage.value = 0;

  [1, 2, 3, 4].forEach((stage, index) => {
    const timer = window.setTimeout(() => {
      traceStage.value = stage;
      if (stage === 4) tracePlaying.value = false;
    }, 520 + index * 720);
    traceTimers.push(timer);
  });
}

const traceStatus = computed(() => {
  if (tracePlaying.value) return text.value.traceRunning;
  if (traceStage.value >= 4) return text.value.resultLabel;
  return text.value.traceLive;
});

const codeTab = ref<CodeTab>("vue");

function selectCodeTab(tab: CodeTab): void {
  codeTab.value = tab;
}

const taskActionDescription = computed(() =>
  props.locale === "zh" ? "完成「${task.text}」" : "Complete “${task.text}”",
);

const codeSamples = computed<Record<CodeTab, { file: string; code: string }>>(() => ({
  vue: {
    file: "TaskRow.vue",
    code: `<button
  @click="toggle(task.id)"
  v-tool="{
    id: \`toggle@\${task.id}\`,
    desc: \`${taskActionDescription.value}\`
  }"
>
  {{ task.text }}
</button>`,
  },
  react: {
    file: "TaskRow.tsx",
    code: `const toggleRef = usePlingTool<HTMLButtonElement>({
  id: \`toggle@\${task.id}\`,
  desc: \`${taskActionDescription.value}\`,
});

<button
  ref={toggleRef}
  onClick={() => toggle(task.id)}
>
  {task.text}
</button>`,
  },
  vanilla: {
    file: "todo.ts",
    code: `const off = pling.tool(check, {
  id: \`toggle@\${task.id}\`,
  desc: \`${taskActionDescription.value}\`,
});

check.addEventListener("click", () => {
  toggle(task.id);
});`,
  },
}));

const activeCode = computed(() => codeSamples.value[codeTab.value]);
const loopTaskDescription = computed(() =>
  props.locale === "zh" ? "完成「${task.text}」" : "Complete “${task.text}”",
);
</script>

<template>
  <div ref="rootEl" class="pling-landing" :class="`pling-landing--${locale}`">
    <section class="hero" aria-labelledby="pling-home-title">
      <div class="hero__atmosphere" aria-hidden="true">
        <span class="hero__grid" />
        <span class="hero__orb hero__orb--one" />
        <span class="hero__orb hero__orb--two" />
      </div>

      <div class="shell hero__layout">
        <div class="hero__copy" data-reveal>
          <p class="kicker">
            <span class="kicker__mark" aria-hidden="true" />
            <span>{{ text.kicker }}</span>
          </p>

          <h1 id="pling-home-title" class="hero__title">
            <span>{{ text.titleLead }}</span>
            <span class="hero__title-accent">{{ text.titleAccent }}</span>
          </h1>

          <p class="hero__lede">{{ text.lede }}</p>
          <p class="hero__aside">{{ text.aside }}</p>

          <div class="hero__actions">
            <a class="button button--primary" :href="route('/start/')">
              <span>{{ text.primaryCta }}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5" />
              </svg>
            </a>
            <a class="button button--secondary" :href="route('/examples/quickstart')">
              <span class="button__play" aria-hidden="true" />
              <span>{{ text.secondaryCta }}</span>
            </a>
          </div>

          <ul class="trust-list" :aria-label="locale === 'zh' ? '项目信息' : 'Project facts'">
            <li v-for="item in text.trust" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="hero__visual" data-reveal style="--reveal-delay: 90ms">
          <div class="trace" :data-stage="traceStage" :class="{ 'is-playing': tracePlaying }">
            <div class="trace__glow" aria-hidden="true" />
            <header class="trace__head">
              <div class="trace__title-group">
                <span class="trace__live-dot" aria-hidden="true" />
                <span>{{ text.traceTitle }}</span>
              </div>
              <button class="trace__run" type="button" @click="runTrace">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M13 8a5 5 0 1 1-1.5-3.55M13 3.5v3h-3" />
                </svg>
                <span>{{ text.traceRun }}</span>
              </button>
            </header>

            <div class="trace__task">
              <span class="trace__task-label">{{ text.traceTask }}</span>
              <p>{{ text.tracePrompt }}</p>
            </div>

            <div class="trace__canvas">
              <article class="app-node" :class="{ 'is-targeting': traceStage >= 2, 'is-complete': traceStage >= 4 }">
                <div class="app-node__bar">
                  <span>{{ text.pageLabel }}</span>
                  <span class="app-node__count">{{ text.pageCount }}</span>
                </div>
                <div class="app-node__surface">
                  <div class="app-node__heading">
                    <strong>{{ text.pageTitle }}</strong>
                    <span>{{ text.pageSummary }}</span>
                  </div>
                  <div class="task-list">
                    <div
                      v-for="(task, index) in text.pageTasks"
                      :key="task.text"
                      class="task-row"
                      :class="{
                        'task-row--target': task.target && traceStage >= 2,
                        'task-row--done': task.done || (task.target && traceStage >= 4),
                      }"
                    >
                      <span class="task-row__check" aria-hidden="true">
                        <svg v-if="task.done || (task.target && traceStage >= 4)" viewBox="0 0 12 12">
                          <path d="m2.4 6.2 2.1 2.1 5-5" />
                        </svg>
                      </span>
                      <span class="task-row__text">{{ task.text }}</span>
                      <span class="task-row__state">{{ task.state }}</span>
                      <span v-if="task.target" class="task-row__id">t{{ index + 1 }}</span>
                    </div>
                  </div>
                  <div class="app-node__foot">
                    <span>{{ text.pageCapabilities }}</span>
                    <span class="capability-dots" aria-hidden="true"><i /><i /><i /></span>
                  </div>
                </div>
              </article>

              <div class="bridge" aria-hidden="true">
                <span class="bridge__halo" />
                <span class="bridge__label">{{ text.bridgeLabel }}</span>
                <span class="bridge__line" />
                <span class="bridge__items">
                  <span v-for="(item, index) in text.bridgeItems" :key="item" :class="{ 'is-active': traceStage > index }">{{ item }}</span>
                </span>
              </div>

              <article class="agent-node">
                <div class="agent-node__bar">
                  <span>{{ text.agentLabel }}</span>
                  <span class="agent-node__kind">{{ text.agentKind }}</span>
                </div>
                <div class="agent-node__body">
                  <div class="agent-node__prompt">
                    <span class="agent-node__avatar" aria-hidden="true">π</span>
                    <p>{{ text.tracePrompt }}</p>
                  </div>

                  <div v-if="traceStage < 2" class="agent-node__waiting">
                    <span v-for="index in 3" :key="index" />
                    <p>{{ text.agentWaiting }}</p>
                  </div>

                  <div v-else class="tool-call" :class="{ 'is-running': traceStage < 3 }">
                    <div class="tool-call__top">
                      <span class="tool-call__name">{{ text.actionName }}</span>
                      <span class="tool-call__arg">{{ text.actionArg }}</span>
                    </div>
                    <div class="tool-call__note">
                      <span class="tool-call__pulse" aria-hidden="true" />
                      {{ text.actionNote }}
                    </div>
                  </div>

                  <div v-if="traceStage >= 4" class="verified" aria-live="polite">
                    <span class="verified__icon" aria-hidden="true">
                      <svg viewBox="0 0 14 14"><path d="m3 7.2 2.5 2.5L11 4.1" /></svg>
                    </span>
                    <div>
                      <strong>{{ text.resultLabel }}</strong>
                      <code>{{ text.resultValue }}</code>
                      <p>{{ text.resultNote }}</p>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <footer class="trace__foot">
              <div class="trace__steps">
                <span
                  v-for="(step, index) in text.traceSteps"
                  :key="step"
                  class="trace-step"
                  :class="{ 'is-active': traceStage >= index + 1, 'is-done': traceStage > index + 1 }"
                >
                  <i aria-hidden="true" />
                  {{ step }}
                </span>
              </div>
              <div class="trace__metrics" :aria-label="traceStatus">
                <span v-for="metric in text.traceMetrics" :key="metric">{{ metric }}</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </section>

    <section class="section value-section" aria-labelledby="value-title">
      <div class="shell">
        <div class="section-heading section-heading--split value-heading" data-reveal>
          <div>
            <p class="eyebrow">{{ text.valueEyebrow }}</p>
            <h2 id="value-title">{{ text.valueTitle }}</h2>
          </div>
          <div class="section-heading__copy">
            <p>{{ text.valueBody }}</p>
          </div>
        </div>

        <div class="value-grid">
          <article
            v-for="(card, index) in text.valueCards"
            :key="card.index"
            class="value-card"
            data-reveal
            :style="`--reveal-delay: ${index * 55}ms`"
          >
            <header class="value-card__head">
              <span>{{ card.who }}</span>
              <span class="value-card__index">{{ card.index }}</span>
            </header>
            <h3>{{ card.title }}</h3>
            <dl class="value-card__rows">
              <div class="value-card__row value-card__row--pain">
                <dt>{{ text.valuePainLabel }}</dt>
                <dd>{{ card.pain }}</dd>
              </div>
              <div class="value-card__row value-card__row--gain">
                <dt>{{ text.valueGainLabel }}</dt>
                <dd>{{ card.gain }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </div>
    </section>

    <section class="section problem-section" aria-labelledby="problem-title">
      <div class="shell">
        <div class="section-heading section-heading--split" data-reveal>
          <div>
            <p class="eyebrow">{{ text.problemEyebrow }}</p>
            <h2 id="problem-title">{{ text.problemTitle }}</h2>
          </div>
          <div class="section-heading__copy">
            <p>{{ text.problemBody }}</p>
            <p>{{ text.problemBodyTwo }}</p>
          </div>
        </div>

        <div class="compare" data-reveal>
          <article class="compare-card compare-card--dom">
            <header class="compare-card__head">
              <span>{{ text.domLabel }}</span>
              <span class="compare-card__signal compare-card__signal--weak" aria-hidden="true" />
            </header>
            <div class="dom-preview" aria-hidden="true">
              <div class="dom-preview__chrome"><i /><i /><i /></div>
              <div class="dom-preview__body">
                <span class="dom-preview__label">order #1042</span>
                <div class="dom-preview__buttons">
                  <span class="dom-preview__button">{{ text.domButtonA }}</span>
                  <span class="dom-preview__button">{{ text.domButtonB }}</span>
                </div>
                <code>&lt;button class="btn"&gt;?</code>
                <code>&lt;button class="btn"&gt;?</code>
              </div>
            </div>
            <div class="unknown-list">
              <span v-for="item in text.domUnknowns" :key="item">{{ item }}</span>
            </div>
            <p class="compare-card__caption">{{ text.domCaption }}</p>
          </article>

          <article class="compare-card compare-card--capability">
            <header class="compare-card__head">
              <span>{{ text.capabilityLabel }}</span>
              <span class="compare-card__signal" aria-hidden="true" />
            </header>
            <div class="capability-preview">
              <div class="capability-preview__top">
                <span class="capability-preview__dot" aria-hidden="true" />
                <code>{{ text.capabilityName }}</code>
                <span class="capability-preview__badge">danger</span>
              </div>
              <dl>
                <div v-for="[key, value] in text.capabilityRows" :key="key">
                  <dt>{{ key }}</dt>
                  <dd>{{ value }}</dd>
                </div>
              </dl>
            </div>
            <p class="compare-card__ready">
              <span aria-hidden="true">✓</span>
              {{ text.capabilityReady }}
            </p>
            <p class="compare-card__caption">{{ text.capabilityCaption }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section loop-section" aria-labelledby="loop-title">
      <div class="shell">
        <div class="loop-panel" data-reveal>
          <div class="loop-panel__copy">
            <div>
              <p class="eyebrow eyebrow--on-dark">{{ text.loopEyebrow }}</p>
              <h2 id="loop-title">{{ text.loopTitle }}</h2>
            </div>
            <p>{{ text.loopBody }}</p>
          </div>
          <div class="loop-panel__steps">
            <article v-for="(step, index) in text.loopSteps" :key="step.index" class="loop-step">
              <span class="loop-step__index">{{ step.index }}</span>
              <div>
                <h3>{{ step.title }}</h3>
                <p>{{ step.body }}</p>
              </div>
              <span v-if="index < text.loopSteps.length - 1" class="loop-step__connector" aria-hidden="true" />
            </article>
          </div>
          <div class="loop-panel__code">
            <div class="loop-code__head">
              <span>{{ text.loopCodeLabel }}</span>
              <code>TaskRow.tsx</code>
            </div>
            <pre><code><span class="tok-keyword">const</span> toggle = <span class="tok-function">usePlingTool</span>({
  id: <span class="tok-string">`toggle@${task.id}`</span>,
  desc: <span class="tok-string">`{{ loopTaskDescription }}`</span>,
  kind: <span class="tok-string">"write"</span>,
});</code></pre>
          </div>
          <p class="loop-panel__foot">{{ text.loopFootnote }}</p>
        </div>
      </div>
    </section>

    <section class="section benefits-section" aria-labelledby="benefits-title">
      <div class="shell">
        <div class="section-heading section-heading--center" data-reveal>
          <p class="eyebrow">{{ text.benefitsEyebrow }}</p>
          <h2 id="benefits-title">{{ text.benefitsTitle }}</h2>
          <p>{{ text.benefitsBody }}</p>
        </div>

        <div class="benefit-grid">
          <article class="benefit-card benefit-card--precision" data-reveal>
            <div class="benefit-card__copy">
              <p class="benefit-card__tag">{{ text.benefitPrecisionTag }}</p>
              <h3>{{ text.benefitPrecisionTitle }}</h3>
              <p>{{ text.benefitPrecisionBody }}</p>
            </div>
            <div class="precision-visual" aria-hidden="true">
              <div class="precision-visual__page">
                <span class="precision-visual__row"><i /> 检查发布清单 <b>t1</b></span>
                <span class="precision-visual__row is-focus"><i /> 预约设计评审 <b>t2</b></span>
                <span class="precision-visual__row"><i /> 跟进客户 <b>t3</b></span>
              </div>
              <span class="precision-visual__beam" />
              <div class="precision-visual__target">
                <span>t2</span>
                <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="15" /><circle cx="22" cy="22" r="7" /></svg>
              </div>
              <div class="precision-visual__path">
                <span v-for="item in text.benefitPrecisionUi" :key="item">{{ item }}</span>
              </div>
            </div>
          </article>

          <article class="benefit-card benefit-card--context" data-reveal style="--reveal-delay: 70ms">
            <div class="benefit-card__copy">
              <p class="benefit-card__tag">{{ text.benefitContextTag }}</p>
              <h3>{{ text.benefitContextTitle }}</h3>
              <p>{{ text.benefitContextBody }}</p>
            </div>
            <div class="context-visual" aria-hidden="true">
              <div class="context-visual__whole">
                <span v-for="index in 18" :key="index" />
                <em>{{ text.benefitContextBefore }}</em>
              </div>
              <svg viewBox="0 0 26 16"><path d="M1 8h22m-5-5 5 5-5 5" /></svg>
              <div class="context-visual__slice">
                <span v-for="item in text.benefitContextItems" :key="item">{{ item }}</span>
                <em>{{ text.benefitContextAfter }}</em>
              </div>
            </div>
          </article>

          <article class="benefit-card benefit-card--small" data-reveal>
            <p class="benefit-card__tag">{{ text.benefitSafetyTag }}</p>
            <h3>{{ text.benefitSafetyTitle }}</h3>
            <p>{{ text.benefitSafetyBody }}</p>
            <div class="safety-visual" aria-hidden="true">
              <span>{{ text.benefitSafetyBadge }}</span>
              <i />
            </div>
          </article>

          <article class="benefit-card benefit-card--small" data-reveal style="--reveal-delay: 60ms">
            <p class="benefit-card__tag">{{ text.benefitAuditTag }}</p>
            <h3>{{ text.benefitAuditTitle }}</h3>
            <p>{{ text.benefitAuditBody }}</p>
            <div class="audit-visual" aria-hidden="true">
              <span class="audit-visual__check">✓</span>
              <code>{{ text.benefitAuditBadge }}</code>
            </div>
          </article>

          <article class="benefit-card benefit-card--small" data-reveal style="--reveal-delay: 120ms">
            <p class="benefit-card__tag">{{ text.benefitSurfaceTag }}</p>
            <h3>{{ text.benefitSurfaceTitle }}</h3>
            <p>{{ text.benefitSurfaceBody }}</p>
            <div class="agents-visual" aria-hidden="true">
              <span class="agents-visual__core">pling</span>
              <span v-for="client in text.benefitSurfaceClients" :key="client">{{ client }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section surface-section" aria-labelledby="surface-title">
      <div class="shell">
        <div class="surface-layout">
          <div class="surface-copy" data-reveal>
            <p class="eyebrow">{{ text.surfaceEyebrow }}</p>
            <h2 id="surface-title">{{ text.surfaceTitle }}</h2>
            <p>{{ text.surfaceBody }}</p>
            <ul class="surface-points">
              <li v-for="point in text.surfacePoints" :key="point">
                <span aria-hidden="true">✓</span>
                {{ point }}
              </li>
            </ul>
            <a class="text-link" :href="route('/surface/')">
              {{ text.surfaceLink }}
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5" /></svg>
            </a>
          </div>

          <div class="surface-matrix" data-reveal style="--reveal-delay: 80ms">
            <header class="surface-matrix__head">
              <div>
                <span>{{ text.surfaceMatrixTitle }}</span>
                <p>{{ text.surfaceMatrixHint }}</p>
              </div>
              <code>pling.surface/0.1</code>
            </header>
            <div class="surface-matrix__columns" aria-hidden="true">
              <span />
              <span v-for="column in text.surfaceColumns" :key="column">{{ column }}</span>
            </div>
            <div class="surface-matrix__rows">
              <div v-for="row in text.surfaceRows" :key="row.name" class="surface-row">
                <div class="surface-row__name">
                  <code>{{ row.name }}</code>
                  <span>{{ row.detail }}</span>
                </div>
                <span
                  v-for="(allowed, index) in row.access"
                  :key="index"
                  class="surface-row__access"
                  :class="{ 'is-allowed': allowed }"
                  :aria-label="allowed ? (locale === 'zh' ? '允许' : 'Allowed') : (locale === 'zh' ? '不暴露' : 'Not exposed')"
                >
                  <svg v-if="allowed" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.3 6.2 2.2 2.2 5.2-5" /></svg>
                  <span v-else aria-hidden="true">—</span>
                </span>
              </div>
            </div>
            <p class="surface-matrix__foot">{{ text.surfaceMatrixFoot }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section start-section" aria-labelledby="start-title">
      <div class="shell start-layout">
        <div class="start-copy" data-reveal>
          <p class="eyebrow">{{ text.startEyebrow }}</p>
          <h2 id="start-title">{{ text.startTitle }}</h2>
          <p>{{ text.startBody }}</p>
          <ul class="start-points">
            <li v-for="point in text.startPoints" :key="point">
              <span aria-hidden="true">✓</span>
              {{ point }}
            </li>
          </ul>
          <a class="text-link" :href="route('/start/')">
            {{ text.codeDocs }}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5" /></svg>
          </a>
        </div>

        <div class="code-card" data-reveal style="--reveal-delay: 80ms">
          <div class="code-card__tabs" role="tablist" :aria-label="text.startEyebrow">
            <button
              v-for="(label, key) in text.codeTabs"
              :key="key"
              type="button"
              role="tab"
              :aria-selected="codeTab === key"
              :class="{ 'is-active': codeTab === key }"
              @click="selectCodeTab(key)"
            >
              {{ label }}
            </button>
          </div>
          <div class="code-card__head">
            <span>{{ text.codeCaption }}</span>
            <code>{{ activeCode.file }}</code>
          </div>
          <pre class="code-card__body"><code>{{ activeCode.code }}</code></pre>
          <div class="code-card__foot">
            <span><i aria-hidden="true" /> {{ text.trust[0] }}</span>
            <span>{{ text.trust[2] }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section examples-section" aria-labelledby="examples-title">
      <div class="shell">
        <div class="section-heading section-heading--split examples-heading" data-reveal>
          <div>
            <p class="eyebrow">{{ text.examplesEyebrow }}</p>
            <h2 id="examples-title">{{ text.examplesTitle }}</h2>
          </div>
          <div class="section-heading__copy">
            <p>{{ text.examplesBody }}</p>
            <a class="text-link" :href="route('/examples/')">
              {{ text.allExamples }}
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5" /></svg>
            </a>
          </div>
        </div>

        <div class="case-grid">
          <a
            v-for="(item, index) in text.cases"
            :key="item.index"
            class="case-card"
            :class="{ 'case-card--wide': index < 2 }"
            :href="route(item.href)"
            data-reveal
            :style="{ '--reveal-delay': `${index * 45}ms` }"
          >
            <span class="case-card__index">{{ item.index }}</span>
            <div class="case-card__body">
              <div class="case-card__tags">
                <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
              </div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.detail }}</p>
              <span class="case-card__link">
                {{ text.openCase }}
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5" /></svg>
              </span>
            </div>
            <span class="case-card__glyph" aria-hidden="true">{{ item.index }}</span>
          </a>
        </div>
      </div>
    </section>

    <section class="final-cta" aria-labelledby="final-title">
      <div class="final-cta__grid" aria-hidden="true" />
      <div class="shell final-cta__inner" data-reveal>
        <p class="eyebrow eyebrow--on-dark">{{ text.finalEyebrow }}</p>
        <h2 id="final-title">{{ text.finalTitle }}</h2>
        <p>{{ text.finalBody }}</p>
        <div class="hero__actions hero__actions--center">
          <a class="button button--light" :href="route('/vue/quick-start-add-pling-to-a-vue-app')">
            <span>{{ text.finalPrimary }}</span>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5" /></svg>
          </a>
          <a class="button button--ghost-light" :href="route('/concepts/how-pling-works')">{{ text.finalSecondary }}</a>
        </div>
      </div>
    </section>

    <footer class="home-footer">
      <div class="shell home-footer__inner">
        <div class="home-footer__brand">
          <span class="kicker__mark" aria-hidden="true" />
          <div>
            <strong>Pling <span>页灵</span></strong>
            <p>{{ text.footerTagline }}</p>
          </div>
        </div>
        <nav :aria-label="locale === 'zh' ? '首页页脚' : 'Homepage footer'">
          <a :href="route('/start/')">{{ text.footerLinks[0] }}</a>
          <a :href="route('/examples/')">{{ text.footerLinks[1] }}</a>
          <a :href="route('/spec/')">{{ text.footerLinks[2] }}</a>
          <a :href="route('/license/')">{{ text.footerLinks[3] }}</a>
        </nav>
        <span class="home-footer__meta">© 2026 Pling · Apache-2.0</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.pling-landing {
  --home-accent: #168ef0;
  --home-accent-deep: #076fb9;
  --home-ink: #0b1728;
  --home-body: #435166;
  --home-muted: #5a6b7f;
  --home-faint: #65788c;
  --home-line: #dfe9f3;
  --home-line-strong: #cbdbea;
  --home-canvas: #ffffff;
  --home-soft: #f6faff;
  --home-wash: #edf7ff;
  --home-navy: #07111f;
  --home-violet: #7168ff;
  --home-mint: #36c7b2;
  color: var(--home-ink);
  background: var(--home-canvas);
  font-family: var(--vp-font-family-base);
}

:global(.dark .pling-landing) {
  --home-accent: #47aefc;
  --home-accent-deep: #8ed1ff;
  --home-ink: #e8f0fa;
  --home-body: #bac9da;
  --home-muted: #93a8bf;
  --home-faint: #8ea4bb;
  --home-line: #1d334d;
  --home-line-strong: #2b4d6e;
  --home-canvas: #0b1220;
  --home-soft: #0f1a2c;
  --home-wash: #10243a;
  --home-navy: #060d17;
}

.pling-landing *,
.pling-landing *::before,
.pling-landing *::after {
  box-sizing: border-box;
}

.pling-landing a {
  text-decoration: none;
}

.pling-landing h1,
.pling-landing h2 {
  scroll-margin-top: calc(var(--vp-nav-height) + 28px);
}

.pling-landing button {
  font: inherit;
}

.shell {
  width: min(1200px, calc(100% - 64px));
  margin-inline: auto;
}

[data-reveal] {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 680ms cubic-bezier(.2, .7, .2, 1), transform 680ms cubic-bezier(.2, .7, .2, 1);
  transition-delay: var(--reveal-delay, 0ms);
}

[data-reveal].is-visible {
  opacity: 1;
  transform: none;
}

.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 760px;
  padding: 118px 0 104px;
  border-bottom: 1px solid var(--home-line);
}

.hero__atmosphere {
  position: absolute;
  z-index: -1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.hero__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgb(80 140 190 / 7%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(80 140 190 / 7%) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: linear-gradient(to bottom, #000 0%, rgb(0 0 0 / 70%) 52%, transparent 92%);
}

:global(.dark) .hero__grid {
  background-image:
    linear-gradient(to right, rgb(122 181 228 / 6%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(122 181 228 / 6%) 1px, transparent 1px);
}

.hero__orb {
  position: absolute;
  display: block;
  border-radius: 999px;
  filter: blur(12px);
  opacity: .7;
}

.hero__orb--one {
  width: 650px;
  height: 650px;
  top: -350px;
  right: -40px;
  background: radial-gradient(circle, rgb(46 157 247 / 16%), rgb(113 104 255 / 9%) 40%, transparent 70%);
}

.hero__orb--two {
  width: 520px;
  height: 520px;
  bottom: -360px;
  left: 4%;
  background: radial-gradient(circle, rgb(54 199 178 / 10%), transparent 66%);
}

.hero__layout {
  display: grid;
  grid-template-columns: minmax(0, .92fr) minmax(560px, 1.08fr);
  gap: clamp(44px, 5vw, 78px);
  align-items: center;
}

.hero__copy {
  padding: 8px 0 4px;
}

.kicker,
.eyebrow {
  margin: 0;
  color: var(--home-accent-deep);
  font-size: 11px;
  font-weight: 740;
  line-height: 1.4;
  letter-spacing: .13em;
  text-transform: uppercase;
}

.kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 29px;
  color: var(--home-muted);
  letter-spacing: .09em;
}

.kicker__mark {
  display: inline-block;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: url("/pling-mark-dark.png") center / contain no-repeat;
  filter: drop-shadow(0 5px 10px rgb(23 58 116 / 16%));
}

:global(.dark) .kicker__mark {
  background-image: url("/pling-mark-light.png");
  filter: drop-shadow(0 5px 12px rgb(0 0 0 / 34%));
}

.hero__title {
  max-width: 640px;
  margin: 0;
  font-size: clamp(58px, 7.4vw, 104px);
  font-weight: 760;
  line-height: .96;
  letter-spacing: -.075em;
}

.pling-landing--zh .hero__title {
  font-size: clamp(56px, 5.9vw, 76px);
  letter-spacing: -.07em;
}

.hero__title > span {
  display: block;
}

.hero__title-accent {
  position: relative;
  width: fit-content;
  color: transparent;
  background: linear-gradient(100deg, var(--home-accent) 2%, #655ffc 48%, #28b8bf 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

.hero__title-accent::after {
  position: absolute;
  right: 4%;
  bottom: .035em;
  left: 2%;
  height: .045em;
  min-height: 3px;
  border-radius: 99px;
  background: linear-gradient(90deg, rgb(46 157 247 / 0%), rgb(71 174 252 / 28%), rgb(40 184 191 / 0%));
  content: "";
}

.hero__lede {
  max-width: 580px;
  margin: 30px 0 0;
  color: var(--home-body);
  font-size: 18px;
  line-height: 1.72;
  letter-spacing: -.012em;
}

.hero__aside {
  margin: 11px 0 0;
  color: var(--home-muted);
  font-size: 15px;
  line-height: 1.6;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 34px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: 11px;
  font-size: 13.5px;
  font-weight: 630;
  line-height: 1;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.button:hover {
  transform: translateY(-1px);
}

.button:focus-visible,
.trace__run:focus-visible,
.code-card__tabs button:focus-visible,
.case-card:focus-visible,
.pling-landing a:focus-visible {
  outline: 2px solid var(--home-accent);
  outline-offset: 3px;
}

.button svg,
.text-link svg,
.case-card__link svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.pling-landing .button--primary {
  color: #fff;
  background: linear-gradient(135deg, #1388e8, #256ed6 58%, #5f67eb);
  box-shadow: 0 10px 24px rgb(28 108 205 / 22%), inset 0 1px rgb(255 255 255 / 20%);
}

.pling-landing .button--primary:hover {
  box-shadow: 0 14px 32px rgb(28 108 205 / 30%), inset 0 1px rgb(255 255 255 / 24%);
}

.pling-landing .button--secondary {
  border-color: var(--home-line-strong);
  color: var(--home-body);
  background: color-mix(in srgb, var(--home-canvas) 86%, transparent);
  box-shadow: 0 5px 18px rgb(22 48 80 / 5%);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.pling-landing .button--secondary:hover {
  border-color: color-mix(in srgb, var(--home-accent) 45%, var(--home-line));
  color: var(--home-accent-deep);
  background: var(--home-soft);
}

.button__play {
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid currentColor;
  opacity: .8;
}

.trust-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 0;
  margin: 38px 0 0;
  padding: 0;
  list-style: none;
}

.trust-list li {
  display: flex;
  align-items: center;
  color: var(--home-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  letter-spacing: .015em;
  white-space: nowrap;
}

.trust-list li + li::before {
  display: inline-block;
  width: 3px;
  height: 3px;
  margin: 0 13px;
  border-radius: 50%;
  background: var(--home-line-strong);
  content: "";
}

.hero__visual {
  min-width: 0;
}

.trace {
  position: relative;
  overflow: hidden;
  padding: 15px;
  border: 1px solid color-mix(in srgb, var(--home-line-strong) 82%, transparent);
  border-radius: 24px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--home-soft) 88%, transparent), color-mix(in srgb, var(--home-canvas) 96%, transparent)),
    var(--home-canvas);
  box-shadow:
    0 40px 90px rgb(18 55 94 / 12%),
    0 10px 28px rgb(18 55 94 / 7%),
    inset 0 1px rgb(255 255 255 / 72%);
}

:global(.dark) .trace {
  box-shadow:
    0 40px 90px rgb(0 0 0 / 38%),
    0 10px 28px rgb(0 0 0 / 30%),
    inset 0 1px rgb(255 255 255 / 5%);
}

.trace__glow {
  position: absolute;
  top: -180px;
  right: -100px;
  width: 380px;
  height: 380px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(46 157 247 / 15%), transparent 68%);
  pointer-events: none;
}

.trace__head,
.trace__foot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.trace__head {
  padding: 1px 3px 14px;
}

.trace__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--home-muted);
  font-size: 10px;
  font-weight: 680;
  letter-spacing: .07em;
  text-transform: uppercase;
}

.trace__live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--home-mint);
  box-shadow: 0 0 0 4px rgb(54 199 178 / 10%);
}

.is-playing .trace__live-dot {
  animation: pulse-dot 1.1s ease-in-out infinite;
}

.trace__run {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid var(--home-line);
  border-radius: 7px;
  color: var(--home-faint);
  background: color-mix(in srgb, var(--home-canvas) 70%, transparent);
  font-size: 9.5px;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease, background-color 150ms ease;
}

.trace__run:hover {
  border-color: color-mix(in srgb, var(--home-accent) 40%, var(--home-line));
  color: var(--home-accent-deep);
  background: var(--home-wash);
}

.trace__run svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.4;
}

.trace__task {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  margin-bottom: 11px;
  padding: 10px 12px;
  border: 1px solid var(--home-line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--home-canvas) 78%, transparent);
}

.trace__task-label {
  padding: 3px 6px;
  border-radius: 4px;
  color: var(--home-accent-deep);
  background: var(--home-wash);
  font-size: 8.5px;
  font-weight: 720;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.trace__task p {
  margin: 0;
  overflow: hidden;
  color: var(--home-body);
  font-size: 11.5px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace__canvas {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px minmax(0, .88fr);
  gap: 0;
  align-items: stretch;
  min-height: 310px;
  border: 1px solid var(--home-line);
  border-radius: 16px;
  background: color-mix(in srgb, var(--home-canvas) 82%, transparent);
}

.app-node,
.agent-node {
  min-width: 0;
  padding: 12px;
}

.app-node {
  border-right: 0;
  border-radius: 15px 0 0 15px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--home-soft) 90%, transparent), color-mix(in srgb, var(--home-canvas) 95%, transparent));
}

.app-node__bar,
.agent-node__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--home-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 8.5px;
  letter-spacing: .02em;
}

.app-node__count,
.agent-node__kind {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--home-wash);
  color: var(--home-accent-deep);
}

.app-node__surface {
  overflow: hidden;
  border: 1px solid var(--home-line);
  border-radius: 10px;
  background: var(--home-canvas);
  box-shadow: 0 9px 24px rgb(31 66 102 / 6%);
}

.app-node__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  padding: 15px 13px 12px;
  border-bottom: 1px solid var(--home-line);
}

.app-node__heading strong {
  color: var(--home-ink);
  font-size: 12px;
  font-weight: 670;
  letter-spacing: -.02em;
}

.app-node__heading span {
  color: var(--home-faint);
  font-size: 8px;
}

.task-list {
  padding: 6px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 7px;
  border-radius: 6px;
  color: var(--home-body);
  transition: background-color 220ms ease, color 220ms ease;
}

.task-row + .task-row {
  border-top: 1px solid color-mix(in srgb, var(--home-line) 62%, transparent);
}

.task-row__check {
  display: grid;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--home-line-strong) 84%, transparent);
  border-radius: 4px;
  background: var(--home-canvas);
  transition: border-color 220ms ease, background-color 220ms ease;
}

.task-row__check svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: #fff;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.task-row__text {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-row__state {
  margin-left: auto;
  color: var(--home-faint);
  font-size: 7.5px;
  white-space: nowrap;
}

.task-row__id {
  display: none;
  padding: 2px 4px;
  border-radius: 3px;
  color: var(--home-accent-deep);
  background: var(--home-wash);
  font-family: var(--vp-font-family-mono);
  font-size: 7.5px;
}

.task-row--target {
  background: color-mix(in srgb, var(--home-accent) 8%, var(--home-canvas));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--home-accent) 24%, transparent);
}

.task-row--target .task-row__check {
  border-color: var(--home-accent);
}

.task-row--target .task-row__id {
  display: inline-flex;
}

.task-row--target .task-row__state {
  display: none;
}

.task-row--done {
  color: var(--home-faint);
}

.task-row--done .task-row__text {
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--home-faint) 50%, transparent);
}

.task-row--done .task-row__check {
  border-color: var(--home-accent);
  background: var(--home-accent);
}

.app-node__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-top: 1px solid var(--home-line);
  color: var(--home-faint);
  font-size: 8px;
}

.capability-dots {
  display: flex;
  gap: 3px;
}

.capability-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--home-accent) 55%, var(--home-line));
}

.bridge {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  background:
    linear-gradient(90deg, transparent, color-mix(in srgb, var(--home-accent) 4%, transparent), transparent);
}

.bridge__line {
  position: absolute;
  z-index: -1;
  top: 30px;
  bottom: 30px;
  left: 50%;
  width: 1px;
  background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--home-accent) 28%, transparent) 18%, color-mix(in srgb, var(--home-accent) 28%, transparent) 82%, transparent);
}

.bridge__halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 56px;
  height: 56px;
  border: 1px solid color-mix(in srgb, var(--home-accent) 15%, transparent);
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--home-accent) 10%, transparent), transparent 67%);
  transform: translate(-50%, -50%);
  animation: breathe 4.8s ease-in-out infinite;
}

.bridge__label {
  position: relative;
  z-index: 1;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--home-accent) 35%, var(--home-line));
  border-radius: 11px;
  color: var(--home-accent-deep);
  background: var(--home-canvas);
  box-shadow: 0 7px 20px rgb(24 105 184 / 12%);
  font-family: var(--vp-font-family-mono);
  font-size: 8px;
  font-weight: 650;
  letter-spacing: -.02em;
}

.bridge__items {
  position: absolute;
  inset: 0;
}

.bridge__items span {
  position: absolute;
  left: 50%;
  padding: 2px 4px;
  border-radius: 3px;
  color: var(--home-faint);
  background: color-mix(in srgb, var(--home-canvas) 86%, transparent);
  font-family: var(--vp-font-family-mono);
  font-size: 6.5px;
  transform: translateX(-50%);
  transition: color 220ms ease, background-color 220ms ease;
}

.bridge__items span:nth-child(1) { top: 27%; }
.bridge__items span:nth-child(2) { top: 48%; }
.bridge__items span:nth-child(3) { top: 69%; }

.bridge__items span.is-active {
  color: var(--home-accent-deep);
  background: var(--home-wash);
}

.agent-node {
  border-radius: 0 15px 15px 0;
  background: color-mix(in srgb, var(--home-canvas) 90%, transparent);
}

.agent-node__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 246px;
}

.agent-node__prompt {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px;
  border: 1px solid var(--home-line);
  border-radius: 9px;
  background: var(--home-soft);
}

.agent-node__avatar {
  display: grid;
  flex: 0 0 auto;
  width: 19px;
  height: 19px;
  place-items: center;
  border-radius: 6px;
  color: #fff;
  background: linear-gradient(145deg, #2ca4f8, #615ff2);
  font-size: 9px;
  font-weight: 700;
}

.agent-node__prompt p {
  margin: 0;
  color: var(--home-body);
  font-size: 9.5px;
  line-height: 1.55;
}

.agent-node__waiting {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 16px;
}

.agent-node__waiting span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--home-accent) 35%, var(--home-line));
  animation: waiting 1.2s ease-in-out infinite;
}

.agent-node__waiting span:nth-child(2) { animation-delay: .13s; }
.agent-node__waiting span:nth-child(3) { animation-delay: .26s; }

.agent-node__waiting p {
  flex-basis: 100%;
  margin: 4px 0 0;
  color: var(--home-faint);
  font-size: 8px;
}

.tool-call {
  margin-top: 14px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--home-accent) 22%, var(--home-line));
  border-radius: 9px;
  background: color-mix(in srgb, var(--home-accent) 5%, var(--home-canvas));
}

.tool-call.is-running {
  animation: tool-arrive 620ms ease both;
}

.tool-call__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tool-call__name {
  color: var(--home-accent-deep);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-weight: 650;
}

.tool-call__arg {
  min-width: 0;
  overflow: hidden;
  color: var(--home-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 7.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-call__note {
  display: flex;
  gap: 5px;
  align-items: center;
  margin-top: 8px;
  color: var(--home-faint);
  font-size: 7.5px;
}

.tool-call__pulse {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--home-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--home-accent) 11%, transparent);
}

.verified {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 12px;
  padding: 9px 10px;
  border: 1px solid color-mix(in srgb, var(--home-mint) 28%, var(--home-line));
  border-radius: 9px;
  background: color-mix(in srgb, var(--home-mint) 6%, var(--home-canvas));
  animation: tool-arrive 520ms ease both;
}

.verified__icon {
  display: grid;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 50%;
  background: var(--home-mint);
}

.verified__icon svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: #fff;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.verified strong {
  display: block;
  color: color-mix(in srgb, var(--home-mint) 70%, var(--home-ink));
  font-size: 8.5px;
  font-weight: 720;
}

.verified code {
  display: block;
  margin-top: 3px;
  color: var(--home-body);
  font-family: var(--vp-font-family-mono);
  font-size: 8px;
}

.verified p {
  margin: 6px 0 0;
  color: var(--home-faint);
  font-size: 7.5px;
  line-height: 1.45;
}

.trace__foot {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  padding: 13px 4px 1px;
}

.trace__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.trace-step {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--home-faint);
  font-size: 7.5px;
  white-space: nowrap;
  transition: color 180ms ease;
}

.trace-step i {
  width: 4px;
  height: 4px;
  border: 1px solid currentColor;
  border-radius: 50%;
}

.trace-step.is-active {
  color: var(--home-accent-deep);
}

.trace-step.is-done i {
  border-color: var(--home-mint);
  background: var(--home-mint);
}

.trace__metrics {
  display: flex;
  justify-content: flex-end;
  gap: 0;
  color: var(--home-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 7px;
}

.trace__metrics span + span::before {
  margin: 0 5px;
  content: "·";
}

.section {
  position: relative;
  padding: 112px 0;
}

.section-heading {
  display: grid;
  gap: 22px;
}

.section-heading--split {
  grid-template-columns: minmax(0, 1.05fr) minmax(300px, .72fr);
  gap: clamp(40px, 7vw, 110px);
  align-items: start;
}

.section-heading h2,
.loop-panel h2,
.surface-copy h2,
.start-copy h2,
.final-cta h2 {
  margin: 12px 0 0;
  color: var(--home-ink);
  font-size: clamp(34px, 4.2vw, 58px);
  font-weight: 730;
  line-height: 1.12;
  letter-spacing: -.055em;
}

#value-title {
  white-space: pre-line;
}

.section-heading__copy {
  padding-top: 25px;
}

.section-heading__copy p,
.surface-copy > p,
.start-copy > p,
.final-cta__inner > p {
  margin: 0;
  color: var(--home-body);
  font-size: 15px;
  line-height: 1.82;
}

.section-heading__copy p + p {
  margin-top: 15px;
}

.value-heading .section-heading__copy {
  max-width: 430px;
  justify-self: end;
}

.value-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 58px;
}

.value-card {
  position: relative;
  overflow: hidden;
  padding: 27px 28px 25px;
  border: 1px solid var(--home-line);
  border-radius: 19px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--home-soft) 78%, var(--home-canvas)), var(--home-canvas) 54%);
  box-shadow: 0 14px 38px rgb(23 55 90 / 4%);
}

.value-card::after {
  position: absolute;
  top: 0;
  right: 28px;
  left: 28px;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--home-accent) 24%, transparent), transparent);
  content: "";
}

.value-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: var(--home-accent-deep);
  font-size: 13px;
  font-weight: 720;
  letter-spacing: .01em;
}

.value-card__index {
  color: var(--home-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: .04em;
}

.value-card h3 {
  max-width: 510px;
  margin: 15px 0 0;
  color: var(--home-ink);
  font-size: clamp(20px, 1.8vw, 25px);
  font-weight: 680;
  line-height: 1.35;
  letter-spacing: -.035em;
}

.value-card__rows {
  display: grid;
  gap: 0;
  margin: 22px 0 0;
}

.value-card__row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 12px 0;
  border-top: 1px solid color-mix(in srgb, var(--home-line) 78%, transparent);
}

.value-card__row dt,
.value-card__row dd {
  margin: 0;
}

.value-card__row dt {
  padding-top: 1px;
  color: var(--home-faint);
  font-size: 11.5px;
  font-weight: 710;
  letter-spacing: .06em;
}

.value-card__row dd {
  color: var(--home-body);
  font-size: 15px;
  line-height: 1.68;
}

.value-card__row--gain dt {
  color: color-mix(in srgb, var(--home-mint) 72%, var(--home-muted));
}

.compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 65px;
}

.compare-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 455px;
  padding: 23px;
  border: 1px solid var(--home-line);
  border-radius: 20px;
  background: var(--home-canvas);
  box-shadow: 0 18px 44px rgb(21 52 85 / 5%);
}

.compare-card--capability {
  border-color: color-mix(in srgb, var(--home-accent) 25%, var(--home-line));
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--home-accent) 5%, var(--home-canvas)), var(--home-canvas) 56%);
  box-shadow: 0 24px 56px rgb(25 98 164 / 8%);
}

.compare-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--home-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.compare-card__signal {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--home-mint);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--home-mint) 10%, transparent);
}

.compare-card__signal--weak {
  background: var(--home-faint);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--home-faint) 8%, transparent);
}

.dom-preview {
  overflow: hidden;
  margin-top: 27px;
  border: 1px solid var(--home-line);
  border-radius: 13px;
  background: var(--home-soft);
}

.dom-preview__chrome {
  display: flex;
  gap: 4px;
  padding: 9px 11px;
  border-bottom: 1px solid var(--home-line);
}

.dom-preview__chrome i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--home-line-strong);
}

.dom-preview__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 27px 16px 24px;
}

.dom-preview__label {
  color: var(--home-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 9px;
}

.dom-preview__buttons {
  display: flex;
  gap: 7px;
  margin: 14px 0 17px;
}

.dom-preview__button {
  min-width: 66px;
  padding: 8px 11px;
  border: 1px solid var(--home-line-strong);
  border-radius: 5px;
  color: var(--home-body);
  background: var(--home-canvas);
  font-size: 10px;
  text-align: center;
}

.dom-preview code {
  margin-top: 4px;
  color: color-mix(in srgb, var(--home-faint) 65%, transparent);
  font-family: var(--vp-font-family-mono);
  font-size: 8px;
}

.unknown-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 21px;
}

.unknown-list span {
  position: relative;
  padding: 8px 9px 8px 23px;
  border: 1px solid color-mix(in srgb, var(--home-line) 80%, transparent);
  border-radius: 6px;
  color: var(--home-muted);
  font-size: 9.5px;
  line-height: 1.4;
}

.unknown-list span::before {
  position: absolute;
  top: 10px;
  left: 9px;
  color: #c36c64;
  content: "?";
  font-family: var(--vp-font-family-mono);
  font-size: 8px;
  font-weight: 700;
}

.compare-card__caption {
  margin: auto 0 0;
  padding-top: 26px;
  color: var(--home-muted);
  font-size: 11px;
  line-height: 1.6;
}

.capability-preview {
  margin-top: 27px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--home-accent) 24%, var(--home-line));
  border-radius: 13px;
  background: var(--home-canvas);
  box-shadow: 0 12px 28px rgb(26 104 172 / 7%);
}

.capability-preview__top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 15px 16px;
  border-bottom: 1px solid var(--home-line);
}

.capability-preview__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--home-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--home-accent) 10%, transparent);
}

.capability-preview__top code {
  color: var(--home-ink);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 630;
}

.capability-preview__badge {
  margin-left: auto;
  padding: 3px 6px;
  border: 1px solid color-mix(in srgb, #d47c74 36%, transparent);
  border-radius: 4px;
  color: #b45750;
  background: color-mix(in srgb, #d47c74 9%, transparent);
  font-family: var(--vp-font-family-mono);
  font-size: 7.5px;
}

.capability-preview dl {
  margin: 0;
  padding: 10px 16px 14px;
}

.capability-preview dl > div {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--home-line) 65%, transparent);
}

.capability-preview dl > div:last-child {
  border-bottom: 0;
}

.capability-preview dt,
.capability-preview dd {
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 9px;
}

.capability-preview dt {
  color: var(--home-faint);
}

.capability-preview dd {
  color: var(--home-body);
}

.compare-card__ready {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 19px 0 0;
  color: var(--home-body);
  font-size: 11px;
  line-height: 1.65;
}

.compare-card__ready span {
  color: var(--home-mint);
  font-weight: 800;
}

.loop-section {
  padding-top: 0;
}

.loop-panel {
  position: relative;
  overflow: hidden;
  padding: clamp(32px, 5vw, 64px);
  border-radius: 28px;
  color: #dce8f6;
  background:
    radial-gradient(circle at 100% 0%, rgb(60 131 224 / 25%), transparent 34%),
    radial-gradient(circle at 0% 100%, rgb(73 194 179 / 11%), transparent 32%),
    #081423;
  box-shadow: 0 30px 70px rgb(7 21 39 / 26%);
}

.loop-panel::before {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgb(129 182 231 / 6%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(129 182 231 / 6%) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(90deg, #000, transparent 78%);
  content: "";
  pointer-events: none;
}

.loop-panel > * {
  position: relative;
  z-index: 1;
}

.eyebrow--on-dark {
  color: #63bdfb;
}

.loop-panel__copy {
  display: grid;
  grid-template-columns: minmax(0, .92fr) minmax(300px, .52fr);
  gap: clamp(32px, 6vw, 90px);
  align-items: end;
}

.loop-panel h2 {
  color: #f0f7ff;
}

.loop-panel__copy > p:last-child {
  margin: 0;
  color: #98aec4;
  font-size: 13px;
  line-height: 1.8;
}

.loop-panel__steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin-top: 51px;
  border: 1px solid rgb(120 169 212 / 15%);
  border-radius: 15px;
  background: rgb(120 169 212 / 9%);
  overflow: hidden;
}

.loop-step {
  position: relative;
  min-height: 155px;
  padding: 23px 20px;
  background: rgb(8 20 35 / 72%);
}

.loop-step__index {
  display: block;
  margin-bottom: 18px;
  color: #4e8dc4;
  font-family: var(--vp-font-family-mono);
  font-size: 9px;
}

.loop-step h3 {
  margin: 0;
  color: #f0f7ff;
  font-size: 15px;
  font-weight: 630;
  letter-spacing: -.015em;
}

.loop-step p {
  margin: 8px 0 0;
  color: #899fb5;
  font-size: 10.5px;
  line-height: 1.7;
}

.loop-step__connector {
  position: absolute;
  z-index: 2;
  top: 50%;
  right: -4px;
  width: 7px;
  height: 7px;
  border-top: 1px solid #3d6d9c;
  border-right: 1px solid #3d6d9c;
  transform: translateY(-50%) rotate(45deg);
}

.loop-panel__code {
  overflow: hidden;
  max-width: 550px;
  margin-top: 26px;
  border: 1px solid rgb(119 169 217 / 17%);
  border-radius: 12px;
  background: rgb(4 12 23 / 70%);
}

.loop-code__head {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 11px 15px;
  border-bottom: 1px solid rgb(119 169 217 / 13%);
  color: #819ab2;
  font-size: 9px;
}

.loop-code__head code {
  color: #5f7d9a;
  font-family: var(--vp-font-family-mono);
}

.loop-panel__code pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  color: #b9cce0;
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  line-height: 1.8;
}

.tok-keyword { color: #8f9cff; }
.tok-function { color: #5fc7df; }
.tok-string { color: #7fd1a8; }

.loop-panel__foot {
  margin: 24px 0 0;
  color: #6e899f;
  font-size: 10px;
  font-family: var(--vp-font-family-mono);
}

.section-heading--center {
  max-width: 900px;
  margin-inline: auto;
  text-align: center;
}

.section-heading--center > p:last-child {
  max-width: 740px;
  margin: 2px auto 0;
  color: var(--home-body);
  font-size: 15px;
  line-height: 1.82;
}

.benefit-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  margin-top: 62px;
}

.benefit-card {
  position: relative;
  overflow: hidden;
  padding: 28px;
  border: 1px solid var(--home-line);
  border-radius: 19px;
  background: var(--home-canvas);
  box-shadow: 0 14px 38px rgb(23 55 90 / 4%);
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.benefit-card:hover {
  border-color: color-mix(in srgb, var(--home-accent) 28%, var(--home-line));
  box-shadow: 0 22px 52px rgb(23 67 113 / 7%);
  transform: translateY(-2px);
}

.benefit-card--precision {
  grid-column: span 7;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(230px, .7fr);
  gap: 20px;
  min-height: 340px;
}

.benefit-card--context {
  grid-column: span 5;
  min-height: 340px;
}

.benefit-card--small {
  grid-column: span 4;
  min-height: 308px;
}

.benefit-card__copy {
  position: relative;
  z-index: 1;
}

.benefit-card__tag {
  margin: 0 0 17px;
  color: var(--home-accent-deep);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .11em;
  text-transform: uppercase;
}

.benefit-card h3 {
  max-width: 520px;
  margin: 0;
  color: var(--home-ink);
  font-size: clamp(20px, 2vw, 26px);
  font-weight: 680;
  line-height: 1.34;
  letter-spacing: -.035em;
}

.benefit-card p:not(.benefit-card__tag) {
  max-width: 520px;
  margin: 13px 0 0;
  color: var(--home-body);
  font-size: 12.5px;
  line-height: 1.75;
}

.precision-visual {
  position: relative;
  align-self: center;
  min-height: 230px;
}

.precision-visual__page {
  position: absolute;
  top: 19px;
  right: 118px;
  left: 0;
  padding: 9px;
  border: 1px solid var(--home-line);
  border-radius: 10px;
  background: var(--home-soft);
}

.precision-visual__row {
  display: flex;
  gap: 7px;
  align-items: center;
  min-height: 35px;
  padding: 0 8px;
  border-radius: 5px;
  color: var(--home-muted);
  font-size: 8.5px;
  white-space: nowrap;
}

.precision-visual__row + .precision-visual__row {
  border-top: 1px solid var(--home-line);
}

.precision-visual__row i {
  width: 9px;
  height: 9px;
  border: 1px solid var(--home-line-strong);
  border-radius: 3px;
}

.precision-visual__row b {
  margin-left: auto;
  color: var(--home-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 7.5px;
  font-weight: 500;
}

.precision-visual__row.is-focus {
  color: var(--home-ink);
  background: color-mix(in srgb, var(--home-accent) 8%, var(--home-canvas));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--home-accent) 26%, transparent);
}

.precision-visual__row.is-focus i {
  border-color: var(--home-accent);
  background: var(--home-accent);
}

.precision-visual__row.is-focus b {
  color: var(--home-accent-deep);
}

.precision-visual__target {
  position: absolute;
  top: 57px;
  right: 43px;
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--home-accent) 28%, var(--home-line));
  border-radius: 50%;
  background: var(--home-canvas);
  box-shadow: 0 10px 25px rgb(28 108 186 / 9%);
}

.precision-visual__target span {
  position: relative;
  z-index: 1;
  color: var(--home-accent-deep);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 650;
}

.precision-visual__target svg {
  position: absolute;
  inset: 6px;
  width: 58px;
  height: 58px;
  fill: none;
  stroke: color-mix(in srgb, var(--home-accent) 20%, transparent);
  stroke-width: 1;
}

.precision-visual__beam {
  position: absolute;
  top: 93px;
  right: 113px;
  width: 39px;
  height: 1px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--home-accent) 15%, transparent), var(--home-accent));
}

.precision-visual__path {
  position: absolute;
  right: 0;
  bottom: 3px;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-end;
}

.precision-visual__path span {
  padding: 4px 6px;
  border: 1px solid var(--home-line);
  border-radius: 4px;
  color: var(--home-faint);
  background: var(--home-canvas);
  font-family: var(--vp-font-family-mono);
  font-size: 7px;
}

.context-visual {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 30px;
}

.context-visual__whole {
  position: relative;
  display: grid;
  flex: 1;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 13px;
  border: 1px solid var(--home-line);
  border-radius: 9px;
  background: var(--home-soft);
  opacity: .56;
}

.context-visual__whole span {
  height: 6px;
  border-radius: 2px;
  background: var(--home-line-strong);
}

.context-visual__whole span:nth-child(3n) { width: 74%; }
.context-visual__whole span:nth-child(4n) { width: 42%; }
.context-visual__whole span:nth-child(7n) { width: 88%; }

.context-visual__whole em,
.context-visual__slice em {
  position: absolute;
  right: 8px;
  bottom: -17px;
  left: 8px;
  color: var(--home-faint);
  font-size: 7.5px;
  font-style: normal;
  text-align: center;
  white-space: nowrap;
}

.context-visual > svg {
  flex: 0 0 auto;
  width: 19px;
  height: 12px;
  fill: none;
  stroke: color-mix(in srgb, var(--home-accent) 42%, var(--home-line));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.2;
}

.context-visual__slice {
  position: relative;
  display: flex;
  flex: 0 0 108px;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--home-accent) 28%, var(--home-line));
  border-radius: 9px;
  background: color-mix(in srgb, var(--home-accent) 5%, var(--home-canvas));
  box-shadow: 0 8px 18px rgb(30 103 172 / 6%);
}

.context-visual__slice span {
  padding: 4px 5px;
  border-radius: 3px;
  color: var(--home-muted);
  background: var(--home-canvas);
  font-family: var(--vp-font-family-mono);
  font-size: 7px;
  text-align: center;
}

.safety-visual,
.audit-visual,
.agents-visual {
  position: absolute;
  right: 27px;
  bottom: 25px;
  left: 27px;
}

.safety-visual {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 19px;
  border-top: 1px solid var(--home-line);
}

.safety-visual span {
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, #d47c74 25%, var(--home-line));
  border-radius: 5px;
  color: color-mix(in srgb, #b45750 72%, var(--home-muted));
  background: color-mix(in srgb, #d47c74 6%, transparent);
  font-family: var(--vp-font-family-mono);
  font-size: 7.5px;
}

.safety-visual i {
  position: relative;
  width: 35px;
  height: 35px;
  border: 1px solid var(--home-line);
  border-radius: 50%;
  background: var(--home-soft);
}

.safety-visual i::before {
  position: absolute;
  top: 10px;
  left: 12px;
  width: 9px;
  height: 7px;
  border: 1.4px solid var(--home-faint);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  content: "";
}

.safety-visual i::after {
  position: absolute;
  top: 17px;
  left: 9px;
  width: 15px;
  height: 11px;
  border: 1px solid var(--home-line-strong);
  border-radius: 3px;
  background: var(--home-canvas);
  content: "";
}

.audit-visual {
  display: flex;
  gap: 9px;
  align-items: center;
  padding-top: 19px;
  border-top: 1px solid var(--home-line);
}

.audit-visual__check {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--home-mint);
  font-size: 10px;
  font-weight: 800;
}

.audit-visual code {
  color: var(--home-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 8.5px;
}

.agents-visual {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  padding-top: 19px;
  border-top: 1px solid var(--home-line);
}

.agents-visual__core {
  padding: 4px 6px;
  border-radius: 4px;
  color: #fff;
  background: linear-gradient(135deg, var(--home-accent), var(--home-violet));
  font-family: var(--vp-font-family-mono);
  font-size: 7px;
}

.agents-visual span:not(.agents-visual__core) {
  padding: 4px 6px;
  border: 1px solid var(--home-line);
  border-radius: 4px;
  color: var(--home-faint);
  background: var(--home-canvas);
  font-size: 7px;
}

.surface-section {
  border-top: 1px solid var(--home-line);
  border-bottom: 1px solid var(--home-line);
  background:
    radial-gradient(circle at 12% 12%, color-mix(in srgb, var(--home-accent) 7%, transparent), transparent 30%),
    var(--home-soft);
}

.surface-layout {
  display: grid;
  grid-template-columns: minmax(0, .84fr) minmax(480px, 1fr);
  gap: clamp(50px, 8vw, 120px);
  align-items: center;
}

.surface-copy > p:nth-of-type(1) {
  max-width: 560px;
  margin-top: 22px;
}

.surface-points,
.start-points {
  display: grid;
  gap: 11px;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}

.surface-points li,
.start-points li {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  color: var(--home-body);
  font-size: 12px;
  line-height: 1.6;
}

.surface-points li span,
.start-points li span {
  display: grid;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  place-items: center;
  border-radius: 50%;
  color: var(--home-accent-deep);
  background: var(--home-wash);
  font-size: 8px;
  font-weight: 800;
}

.text-link {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  margin-top: 29px;
  color: var(--home-accent-deep) !important;
  font-size: 11.5px;
  font-weight: 650;
}

.text-link:hover {
  color: var(--home-accent) !important;
}

.surface-matrix {
  overflow: hidden;
  border: 1px solid var(--home-line);
  border-radius: 19px;
  background: var(--home-canvas);
  box-shadow: 0 24px 60px rgb(20 66 108 / 8%);
}

.surface-matrix__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 23px 19px;
  border-bottom: 1px solid var(--home-line);
}

.surface-matrix__head span {
  color: var(--home-ink);
  font-size: 13px;
  font-weight: 650;
}

.surface-matrix__head p {
  margin: 5px 0 0;
  color: var(--home-faint);
  font-size: 9.5px;
}

.surface-matrix__head code {
  flex: 0 0 auto;
  padding: 4px 7px;
  border: 1px solid var(--home-line);
  border-radius: 4px;
  color: var(--home-accent-deep);
  background: var(--home-wash);
  font-family: var(--vp-font-family-mono);
  font-size: 7.5px;
}

.surface-matrix__columns,
.surface-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) repeat(3, 72px);
}

.surface-matrix__columns {
  padding: 9px 19px;
  color: var(--home-faint);
  background: color-mix(in srgb, var(--home-soft) 70%, transparent);
  font-size: 7.5px;
  text-align: center;
}

.surface-matrix__columns span:first-child {
  text-align: left;
}

.surface-row {
  align-items: center;
  padding: 13px 19px;
  border-top: 1px solid color-mix(in srgb, var(--home-line) 68%, transparent);
}

.surface-row__name {
  display: grid;
  gap: 3px;
}

.surface-row__name code {
  color: var(--home-ink);
  font-family: var(--vp-font-family-mono);
  font-size: 9.5px;
}

.surface-row__name span {
  color: var(--home-faint);
  font-size: 8.5px;
}

.surface-row__access {
  display: grid;
  width: 21px;
  height: 21px;
  margin-inline: auto;
  place-items: center;
  border: 1px solid var(--home-line);
  border-radius: 50%;
  color: var(--home-faint);
  font-size: 9px;
}

.surface-row__access.is-allowed {
  border-color: color-mix(in srgb, var(--home-mint) 25%, var(--home-line));
  color: color-mix(in srgb, var(--home-mint) 82%, var(--home-ink));
  background: color-mix(in srgb, var(--home-mint) 7%, transparent);
}

.surface-row__access svg {
  width: 9px;
  height: 9px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.surface-matrix__foot {
  margin: 0;
  padding: 14px 20px 16px;
  border-top: 1px solid var(--home-line);
  color: var(--home-faint);
  font-size: 8.5px;
  line-height: 1.55;
}

.start-layout {
  display: grid;
  grid-template-columns: minmax(300px, .7fr) minmax(480px, 1fr);
  gap: clamp(45px, 8vw, 120px);
  align-items: center;
}

.start-copy > p:nth-of-type(1) {
  margin-top: 22px;
}

.start-copy h2 {
  max-width: 9.2em;
  font-size: clamp(34px, 3.8vw, 49px);
}

.code-card {
  overflow: hidden;
  border: 1px solid #1b314a;
  border-radius: 18px;
  background: #081321;
  box-shadow: 0 26px 60px rgb(8 24 43 / 22%);
}

.code-card__tabs {
  display: flex;
  gap: 4px;
  padding: 10px 10px 0;
  border-bottom: 1px solid #172b42;
  background: #0a1727;
}

.code-card__tabs button {
  padding: 8px 13px;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  color: #7189a1;
  background: transparent;
  font-size: 9px;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}

.code-card__tabs button:hover {
  color: #b7cae0;
}

.code-card__tabs button.is-active {
  border-color: #1b314a;
  color: #d7e7f7;
  background: #081321;
}

.code-card__head {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 17px 19px 8px;
  color: #7189a1;
  font-size: 9px;
}

.code-card__head code {
  color: #536b83;
  font-family: var(--vp-font-family-mono);
}

.code-card__body {
  min-height: 247px;
  margin: 0;
  padding: 18px 21px 23px;
  overflow-x: auto;
  color: #aec4d9;
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  line-height: 1.85;
  tab-size: 2;
}

.code-card__foot {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  padding: 11px 18px;
  border-top: 1px solid #172b42;
  color: #5b7289;
  font-family: var(--vp-font-family-mono);
  font-size: 7.5px;
}

.code-card__foot span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.code-card__foot i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #44c7ac;
}

.examples-section {
  padding-top: 105px;
}

.examples-heading {
  align-items: end;
}

.examples-heading .text-link {
  margin-top: 19px;
}

.case-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin-top: 60px;
}

.case-card {
  position: relative;
  display: flex;
  min-height: 255px;
  grid-column: span 2;
  overflow: hidden;
  padding: 22px;
  border: 1px solid var(--home-line);
  border-radius: 17px;
  background:
    linear-gradient(150deg, color-mix(in srgb, var(--home-soft) 78%, var(--home-canvas)), var(--home-canvas) 68%);
  box-shadow: 0 12px 32px rgb(22 58 96 / 3%);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.case-card:hover {
  border-color: color-mix(in srgb, var(--home-accent) 28%, var(--home-line));
  box-shadow: 0 20px 46px rgb(18 69 120 / 8%);
  transform: translateY(-3px);
}

.case-card--wide {
  grid-column: span 3;
}

.case-card__index {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  color: var(--home-accent-deep);
  font-family: var(--vp-font-family-mono);
  font-size: 9px;
}

.case-card__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  padding-left: 26px;
}

.case-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 11px;
}

.case-card__tags span {
  padding: 3px 6px;
  border: 1px solid var(--home-line);
  border-radius: 3px;
  color: var(--home-faint);
  background: color-mix(in srgb, var(--home-canvas) 75%, transparent);
  font-size: 7.5px;
}

.case-card h3 {
  max-width: 390px;
  margin: 0;
  color: var(--home-ink);
  font-size: 19px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -.026em;
}

.case-card p {
  max-width: 440px;
  margin: 9px 0 0;
  color: var(--home-muted);
  font-size: 11px;
  line-height: 1.65;
}

.case-card__link {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  margin-top: 18px;
  color: var(--home-accent-deep);
  font-size: 9px;
  font-weight: 650;
}

.case-card__glyph {
  position: absolute;
  right: -11px;
  bottom: -41px;
  color: color-mix(in srgb, var(--home-accent) 6%, transparent);
  font-family: var(--vp-font-family-mono);
  font-size: 150px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -.12em;
  pointer-events: none;
}

.final-cta {
  position: relative;
  overflow: hidden;
  padding: 105px 0 118px;
  color: #e8f2fc;
  background:
    radial-gradient(circle at 50% -30%, rgb(76 158 238 / 36%), transparent 54%),
    radial-gradient(circle at 12% 120%, rgb(67 191 180 / 15%), transparent 38%),
    #071321;
}

.final-cta__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgb(133 186 232 / 6%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(133 186 232 / 6%) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse at 50% 0%, #000 0%, transparent 70%);
}

.final-cta__inner {
  position: relative;
  z-index: 1;
  max-width: 870px;
  text-align: center;
}

.final-cta h2 {
  color: #f3f9ff;
  font-size: clamp(37px, 5vw, 66px);
}

.final-cta__inner > p {
  max-width: 640px;
  margin: 22px auto 0;
  color: #9eb3c8;
}

.final-cta .eyebrow--on-dark {
  color: #63bdfb;
}

.hero__actions--center {
  justify-content: center;
  margin-top: 33px;
}

.pling-landing .button--light {
  color: #0b2239;
  background: #eef8ff;
  box-shadow: 0 12px 28px rgb(0 0 0 / 22%);
}

.pling-landing .button--light:hover {
  color: #07192c;
  background: #fff;
}

.pling-landing .button--ghost-light {
  border-color: rgb(184 216 240 / 24%);
  color: #c8daeb;
  background: rgb(255 255 255 / 4%);
}

.pling-landing .button--ghost-light:hover {
  border-color: rgb(184 216 240 / 40%);
  color: #fff;
  background: rgb(255 255 255 / 8%);
}

.home-footer {
  padding: 30px 0;
  border-top: 1px solid var(--home-line);
  background: var(--home-canvas);
}

.home-footer__inner {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 34px;
  align-items: center;
}

.home-footer__brand {
  display: flex;
  gap: 11px;
  align-items: center;
}

.home-footer__brand .kicker__mark {
  width: 28px;
  height: 28px;
}

.home-footer__brand strong {
  display: block;
  color: var(--home-ink);
  font-size: 11px;
  font-weight: 680;
}

.home-footer__brand strong span {
  margin-left: 4px;
  color: var(--home-faint);
  font-weight: 400;
}

.home-footer__brand p {
  margin: 2px 0 0;
  color: var(--home-faint);
  font-size: 8px;
}

.home-footer nav {
  display: flex;
  gap: 19px;
}

.home-footer nav a,
.home-footer__meta {
  color: var(--home-faint);
  font-size: 8.5px;
}

.home-footer nav a:hover {
  color: var(--home-accent-deep);
}

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 4px rgb(54 199 178 / 10%); }
  50% { box-shadow: 0 0 0 7px rgb(54 199 178 / 4%); }
}

@keyframes breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(.92); opacity: .62; }
  50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
}

@keyframes waiting {
  0%, 100% { transform: translateY(0); opacity: .35; }
  50% { transform: translateY(-3px); opacity: 1; }
}

@keyframes tool-arrive {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 1180px) {
  .hero__layout {
    grid-template-columns: minmax(0, .86fr) minmax(510px, 1.14fr);
    gap: 42px;
  }

  .hero__title {
    font-size: clamp(58px, 7.1vw, 84px);
  }

  .benefit-card--precision {
    grid-column: span 12;
  }

  .benefit-card--context {
    grid-column: span 5;
  }

  .benefit-card--small {
    grid-column: span 4;
  }
}

@media (max-width: 1020px) {
  .shell {
    width: min(100% - 48px, 820px);
  }

  .hero {
    min-height: auto;
    padding-top: 92px;
  }

  .hero__layout {
    grid-template-columns: 1fr;
    gap: 58px;
  }

  .hero__copy {
    max-width: 720px;
  }

  .hero__title {
    font-size: clamp(66px, 10vw, 96px);
  }

  .pling-landing--zh .hero__title {
    font-size: clamp(56px, 7vw, 78px);
  }

  .hero__visual {
    max-width: 720px;
  }

  .section-heading--split,
  .surface-layout,
  .start-layout {
    grid-template-columns: 1fr;
  }

  .section-heading--split {
    gap: 24px;
  }

  .section-heading__copy {
    max-width: 680px;
    padding-top: 0;
  }

  .value-heading .section-heading__copy {
    justify-self: start;
  }

  .loop-panel__copy {
    grid-template-columns: 1fr;
    gap: 22px;
  }

  .loop-panel__copy > p:last-child {
    max-width: 650px;
  }

  .surface-copy,
  .start-copy {
    max-width: 650px;
  }

  .benefit-card--context {
    grid-column: span 12;
    min-height: 320px;
  }

  .benefit-card--small {
    grid-column: span 6;
  }

  .home-footer__inner {
    grid-template-columns: 1fr auto;
  }

  .home-footer__meta {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .shell {
    width: calc(100% - 36px);
  }

  .hero {
    padding: 74px 0 78px;
  }

  .kicker {
    margin-bottom: 22px;
    font-size: 9.5px;
  }

  .kicker__mark {
    width: 23px;
    height: 23px;
  }

  .hero__title {
    font-size: clamp(52px, 15.5vw, 80px);
    letter-spacing: -.068em;
  }

  .pling-landing--zh .hero__title {
    font-size: clamp(42px, 12.4vw, 64px);
    letter-spacing: -.065em;
  }

  #value-title {
    font-size: clamp(31px, 8.2vw, 34px);
    text-wrap: balance;
    white-space: normal;
  }

  .hero__lede {
    margin-top: 24px;
    font-size: 16px;
    line-height: 1.68;
  }

  .hero__actions {
    margin-top: 28px;
  }

  .value-grid {
    grid-template-columns: 1fr;
    margin-top: 42px;
  }

  .value-card {
    padding: 24px 22px 22px;
  }

  .button {
    min-height: 44px;
    padding-inline: 16px;
    font-size: 12.5px;
  }

  .trust-list {
    margin-top: 30px;
  }

  .trace {
    padding: 11px;
    border-radius: 19px;
  }

  .trace__head {
    padding-bottom: 11px;
  }

  .trace__run span {
    display: none;
  }

  .trace__run {
    padding: 7px;
  }

  .trace__canvas {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .app-node {
    border-radius: 13px 13px 0 0;
  }

  .bridge {
    flex-direction: row;
    gap: 8px;
    min-height: 48px;
    padding: 5px 12px;
  }

  .bridge__line {
    top: 50%;
    right: 20px;
    bottom: auto;
    left: 20px;
    width: auto;
    height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--home-accent) 25%, transparent) 30%, color-mix(in srgb, var(--home-accent) 25%, transparent) 70%, transparent);
  }

  .bridge__halo {
    display: none;
  }

  .bridge__label {
    flex: 0 0 auto;
    width: 42px;
    height: 23px;
    border-radius: 6px;
    font-size: 7px;
  }

  .bridge__items {
    position: static;
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  .bridge__items span {
    position: static;
    transform: none;
  }

  .agent-node {
    border-radius: 0 0 13px 13px;
  }

  .agent-node__body {
    min-height: 0;
  }

  .agent-node__prompt p {
    font-size: 10px;
  }

  .tool-call__name,
  .tool-call__arg {
    font-size: 8.5px;
  }

  .trace__foot {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .trace__metrics {
    justify-content: flex-start;
  }

  .section {
    padding: 82px 0;
  }

  .section-heading h2,
  .loop-panel h2,
  .surface-copy h2,
  .start-copy h2,
  .final-cta h2 {
    font-size: clamp(32px, 9.5vw, 45px);
  }

  .section-heading__copy p,
  .surface-copy > p,
  .start-copy > p,
  .final-cta__inner > p {
    font-size: 14px;
  }

  .compare {
    grid-template-columns: 1fr;
    margin-top: 43px;
  }

  .compare-card {
    min-height: 0;
    padding: 19px;
  }

  .compare-card__caption {
    padding-top: 22px;
  }

  .loop-panel {
    padding: 28px 20px 23px;
    border-radius: 20px;
  }

  .loop-panel__steps {
    grid-template-columns: 1fr 1fr;
    margin-top: 40px;
  }

  .loop-step {
    min-height: 145px;
    padding: 20px 16px;
  }

  .loop-step__connector {
    display: none;
  }

  .loop-panel__foot {
    line-height: 1.65;
  }

  .benefit-grid {
    gap: 12px;
    margin-top: 44px;
  }

  .benefit-card--precision,
  .benefit-card--context,
  .benefit-card--small {
    grid-column: span 12;
  }

  .benefit-card {
    padding: 22px;
  }

  .benefit-card--precision {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .precision-visual {
    min-height: 216px;
    margin-top: 15px;
  }

  .benefit-card h3 {
    font-size: 23px;
  }

  .benefit-card--small {
    min-height: 280px;
  }

  .surface-matrix {
    margin-top: 8px;
  }

  .surface-matrix__head {
    padding: 18px;
  }

  .surface-matrix__head code {
    display: none;
  }

  .surface-matrix__columns,
  .surface-row {
    grid-template-columns: minmax(0, 1fr) repeat(3, 52px);
  }

  .surface-matrix__columns,
  .surface-row {
    padding-inline: 14px;
  }

  .code-card__body {
    min-height: 0;
    font-size: 9.5px;
  }

  .case-grid {
    grid-template-columns: repeat(2, 1fr);
    margin-top: 43px;
  }

  .case-card,
  .case-card--wide {
    grid-column: span 1;
  }

  .case-card:last-child {
    grid-column: span 2;
  }

  .case-card {
    min-height: 230px;
  }

  .case-card__glyph {
    font-size: 126px;
  }

  .final-cta {
    padding: 82px 0 90px;
  }

  .home-footer__inner {
    grid-template-columns: 1fr;
    gap: 22px;
  }

  .home-footer nav {
    flex-wrap: wrap;
    gap: 15px;
  }
}

@media (max-width: 430px) {
  .case-grid {
    grid-template-columns: 1fr;
  }

  .case-card,
  .case-card--wide,
  .case-card:last-child {
    grid-column: auto;
  }

  .hero__title {
    font-size: clamp(48px, 15.5vw, 66px);
  }

  .hero__actions .button {
    width: 100%;
  }

  .trust-list li {
    font-size: 8.5px;
  }

  .trust-list li + li::before {
    margin-inline: 8px;
  }

  .trace__task {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .trace__task p {
    white-space: normal;
  }

  .trace__steps {
    gap: 6px;
  }

  .trace-step {
    font-size: 7px;
  }

  .loop-panel__steps {
    grid-template-columns: 1fr;
  }

  .loop-step {
    min-height: 0;
  }

  .unknown-list {
    grid-template-columns: 1fr;
  }

  .surface-matrix__columns,
  .surface-row {
    grid-template-columns: minmax(0, 1fr) repeat(3, 40px);
  }

  .surface-matrix__columns {
    font-size: 6.5px;
  }
}

@media (max-width: 360px) {
  .trust-list {
    gap: 5px 12px;
  }

  .trust-list li + li::before {
    display: none;
  }
}

/* Keep functional labels readable without flattening the page hierarchy. */
.pling-landing .kicker,
.pling-landing .eyebrow {
  font-size: 13px;
}

.pling-landing .trust-list li {
  font-size: 11.5px;
}

.pling-landing .trace__title-group {
  font-size: 12.5px;
}

.pling-landing .trace__run {
  font-size: 11.5px;
}

.pling-landing .trace__task-label {
  font-size: 10.5px;
}

.pling-landing .trace__task p {
  font-size: 13.5px;
}

.pling-landing .app-node__bar,
.pling-landing .agent-node__bar {
  font-size: 10.5px;
}

.pling-landing .app-node__heading strong {
  font-size: 14px;
}

.pling-landing .app-node__heading span {
  font-size: 10.5px;
}

.pling-landing .task-row__text {
  font-size: 12.5px;
}

.pling-landing .task-row__state,
.pling-landing .task-row__id {
  font-size: 10.5px;
}

.pling-landing .app-node__foot {
  font-size: 10.5px;
}

.pling-landing .bridge__label {
  font-size: 10px;
}

.pling-landing .bridge__items span {
  font-size: 10.5px;
}

.pling-landing .agent-node__prompt p {
  font-size: 12px;
}

.pling-landing .agent-node__waiting p {
  font-size: 10.5px;
}

.pling-landing .tool-call__name {
  font-size: 12.5px;
}

.pling-landing .tool-call__arg,
.pling-landing .tool-call__note {
  font-size: 10.5px;
}

.pling-landing .verified strong {
  font-size: 11.5px;
}

.pling-landing .verified code,
.pling-landing .verified p {
  font-size: 10.5px;
}

.pling-landing .trace-step {
  font-size: 10.5px;
}

.pling-landing .trace__metrics {
  font-size: 10.5px;
}

.pling-landing .section-heading__copy p,
.pling-landing .surface-copy > p,
.pling-landing .start-copy > p,
.pling-landing .section-heading--center > p:last-child {
  font-size: 16px;
}

.pling-landing .compare-card__head {
  font-size: 12.5px;
}

.pling-landing .dom-preview__label {
  font-size: 11.5px;
}

.pling-landing .dom-preview__button {
  font-size: 13px;
}

.pling-landing .dom-preview code {
  font-size: 11px;
}

.pling-landing .unknown-list span {
  font-size: 12.5px;
}

.pling-landing .compare-card__caption {
  font-size: 13.5px;
}

.pling-landing .capability-preview__badge {
  font-size: 10.5px;
}

.pling-landing .capability-preview dt,
.pling-landing .capability-preview dd {
  font-size: 11.5px;
}

.pling-landing .compare-card__ready {
  font-size: 13.5px;
}

.pling-landing .loop-panel__copy > p:last-child {
  font-size: 15px;
}

.pling-landing .loop-step__index {
  font-size: 11px;
}

.pling-landing .loop-step h3 {
  font-size: 17px;
}

.pling-landing .loop-step p {
  font-size: 14px;
}

.pling-landing .loop-code__head {
  font-size: 11px;
}

.pling-landing .loop-panel__code pre {
  font-size: 13px;
}

.pling-landing .loop-panel__foot {
  font-size: 12.5px;
}

.pling-landing .benefit-card__tag {
  font-size: 11px;
}

.pling-landing .benefit-card p:not(.benefit-card__tag) {
  font-size: 15px;
}

.pling-landing .benefit-card--small {
  min-height: 352px;
}

.pling-landing .precision-visual__row {
  font-size: 11px;
}

.pling-landing .precision-visual__row b {
  font-size: 10.5px;
}

.pling-landing .precision-visual__path span {
  font-size: 10.5px;
}

.pling-landing .context-visual__whole em,
.pling-landing .context-visual__slice em {
  font-size: 10.5px;
}

.pling-landing .context-visual__slice span,
.pling-landing .agents-visual__core,
.pling-landing .agents-visual span:not(.agents-visual__core) {
  font-size: 10.5px;
}

.pling-landing .safety-visual span {
  font-size: 11px;
}

.pling-landing .audit-visual code {
  font-size: 11.5px;
}

.pling-landing .surface-points li,
.pling-landing .start-points li {
  font-size: 15px;
}

.pling-landing .text-link {
  font-size: 14px;
}

.pling-landing .surface-matrix__head p {
  font-size: 12.5px;
}

.pling-landing .surface-matrix__head code {
  font-size: 10.5px;
}

.pling-landing .surface-matrix__columns {
  font-size: 10.5px;
}

.pling-landing .surface-row__name code {
  font-size: 12px;
}

.pling-landing .surface-row__name span {
  font-size: 11px;
}

.pling-landing .surface-matrix__foot {
  font-size: 11px;
}

.pling-landing .code-card__tabs button,
.pling-landing .code-card__head {
  font-size: 12px;
}

.pling-landing .code-card__body {
  font-size: 13.5px;
}

.pling-landing .code-card__foot {
  font-size: 11px;
}

.pling-landing .case-card {
  min-height: 270px;
}

.pling-landing .case-card__index {
  font-size: 11.5px;
}

.pling-landing .case-card__tags span {
  font-size: 11px;
}

.pling-landing .case-card h3 {
  font-size: 22px;
}

.pling-landing .case-card p {
  font-size: 14px;
}

.pling-landing .case-card__link {
  font-size: 12.5px;
}

.pling-landing .home-footer__brand strong {
  font-size: 13px;
}

.pling-landing .home-footer__brand p,
.pling-landing .home-footer nav a,
.pling-landing .home-footer__meta {
  font-size: 11.5px;
}

@media (prefers-reduced-motion: reduce) {
  .pling-landing *,
  .pling-landing *::before,
  .pling-landing *::after {
    scroll-behavior: auto !important;
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }

  [data-reveal] {
    opacity: 1;
    transform: none;
  }
}
</style>
