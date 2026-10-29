<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import type { SurfaceSession } from "@plingjs/surface";
import type {
  SurfaceAgentAccess,
  SurfaceConnectionState,
  SurfacePageSession,
} from "@plingjs/vue";
import type { DemoLocale } from "./copy";

type ClientId = "codex" | "claude" | "hermes" | "workbuddy";

interface ClientSetup {
  id: ClientId;
  label: string;
  title: string;
  steps: string[];
  payload: string;
  language: string;
  note: string;
}

const props = defineProps<{
  locale: DemoLocale;
  state: SurfaceConnectionState | "idle";
  page: SurfacePageSession | null;
  access: SurfaceAgentAccess | null;
  agent: SurfaceSession | null;
  busy: string;
  error: string;
}>();

defineEmits<{ access: []; revoke: []; retry: [] }>();

const now = ref(Date.now());
const timer = setInterval(() => (now.value = Date.now()), 1_000);
const copied = ref("");
const activeClient = ref<ClientId>("codex");

onUnmounted(() => clearInterval(timer));

const copy = computed(() =>
  props.locale === "zh"
    ? {
        eyebrow: "03 · 公网 Surface",
        title: "让外部 Agent 操作",
        lead: "页面通过公网网关暴露六项具名能力。选择你的客户端，复制对应的接入片段。这个案例不再挂页面聊天助手，操作者与 Agent 共用同一个业务页面。",
        status: "网关",
        idleHint: "还没有申请页面会话。",
        connect: "连接公网网关",
        states: {
          idle: "未连接",
          connecting: "正在连接",
          connected: "页面已连接",
          disconnected: "正在重连",
          closed: "会话已关闭",
        },
        session: "页面会话",
        remaining: "剩余时间",
        expires: "到期时间",
        capabilities: "对外能力",
        access: "Agent 访问 token",
        accessHint: "这枚 token 只属于当前页面会话。请只复制到可信终端，不要发到对话、提交到仓库或转给其他人。",
        create: "生成访问 token",
        renew: "重新生成 token",
        creating: "正在生成…",
        clients: "接入客户端",
        payload: "接入片段",
        copyPayload: "复制片段",
        copied: "已复制",
        copy: "复制",
        tokenCopied: "token 已复制",
        codexNote: "Codex 使用 --bearer-token-env-var，把 token 留在环境变量里，不进入工具参数。",
        claudeNote: "Claude Code 通过 HTTP 请求头携带 token；如果你的 Claude 版本使用 Connectors 界面，填同一个 URL 与 Authorization 头即可。",
        remoteNote: "不同版本的菜单名可能是 Remote MCP、Streamable HTTP 或 MCP Servers。选择远程 HTTP，填入 URL 与 Authorization 头；下面也给出版本较新客户端常用的 mcpServers JSON。",
        expired: "token 已过期",
        expiredHint: "页面会话或 Agent token 已过期。重新连接会创建新的页面会话和 token；旧 token 不再可用。",
        agent: "Agent 已绑定当前页面",
        agentHint: "删除和清除已完成仍会在本页等待你确认；Agent 不能替自己批准。",
        revoke: "撤销这个 Agent",
        revoking: "正在撤销…",
        retry: "重新连接",
        hour: "小时",
        minute: "分钟",
        second: "秒",
        rulesTitle: "连接规则",
        rules: [
          "页面会话与 Agent token 最长有效 24 小时；到期后刷新页面，重新领取。",
          "刷新页面会创建新的页面会话和新 token；旧 token 不能继续操作刷新后的页面。",
          "一个页面会话只绑定一个 Agent。要同时接 Codex、Claude 等多个客户端，请为每个 Agent 新开一个页面。",
          "页面必须保持打开。关闭页面或撤销 Agent 后，即使 token 尚未到期，也无法继续调用。",
          "删除和清除已完成不会由 Agent 自行批准，确认框只会出现在这个业务页面。",
        ],
        boundary: "公开案例把 token 放在页面里，方便你直接看到完整链路；页面脚本、浏览器扩展或截图工具都可能读到它。生产环境应使用 OAuth 或设备授权，不要把长期凭证交给页面。网关仍不暴露 DOM、脚本执行、Cookie 或模型密钥。",
      }
    : {
        eyebrow: "03 · Hosted Surface",
        title: "Connect an outside agent",
        lead: "The page exposes six named capabilities through a public gateway. Pick your client and copy the matching setup. This example deliberately has no page chat assistant: the operator and the external Agent share one business page.",
        status: "Gateway",
        idleHint: "No page session has been requested yet.",
        connect: "Connect to the gateway",
        states: {
          idle: "idle",
          connecting: "connecting",
          connected: "page connected",
          disconnected: "reconnecting",
          closed: "session closed",
        },
        session: "Page session",
        remaining: "Time left",
        expires: "Expires",
        capabilities: "Capabilities",
        access: "Agent access token",
        accessHint: "This token belongs to the current page session. Copy it only into a trusted terminal; do not paste it into chat, commit it, or share it.",
        create: "Create access token",
        renew: "Create a new token",
        creating: "Creating…",
        clients: "Client",
        payload: "Setup",
        copyPayload: "Copy setup",
        copied: "Copied",
        copy: "Copy",
        tokenCopied: "Token copied",
        codexNote: "Codex reads the token through --bearer-token-env-var, so it never becomes a tool argument.",
        claudeNote: "Claude Code sends the token as an HTTP header. If your Claude build uses the Connectors screen instead, enter the same URL and Authorization header there.",
        remoteNote: "The menu may be called Remote MCP, Streamable HTTP, or MCP Servers depending on the client version. Choose remote HTTP and enter the URL plus Authorization header; the mcpServers JSON below is accepted by many recent clients.",
        expired: "Token expired",
        expiredHint: "The page session or Agent token has expired. Reconnecting creates a fresh page session and token; the old token will no longer work.",
        agent: "Agent bound to this page",
        agentHint: "Deleting a task and clearing completed tasks still wait for your confirmation here. The Agent cannot approve its own request.",
        revoke: "Revoke this Agent",
        revoking: "Revoking…",
        retry: "Reconnect",
        hour: "h",
        minute: "min",
        second: "s",
        rulesTitle: "Connection rules",
        rules: [
          "The page session and Agent token last at most 24 hours. Reload the page to obtain fresh credentials after expiry.",
          "Reloading the page creates a new page session and token. The old token cannot operate the reloaded page.",
          "One page session is bound to one Agent. To run Codex, Claude, and other clients at the same time, open a separate page for each Agent.",
          "Keep the page open. Closing it or revoking the Agent makes the token unusable even before its stated expiry.",
          "Delete and clear-completed are not self-approved by the Agent. The confirmation appears on this business page.",
        ],
        boundary: "The public example puts the token in the page so the full path is visible. Page scripts, browser extensions, and screenshots can read it. Production integrations should use OAuth or device authorization and keep long-lived credentials out of the page. The gateway still exposes no DOM, script execution, cookies, or model keys.",
      },
);

const statusText = computed(() => copy.value.states[props.state]);
const pageExpired = computed(() => Boolean(props.page && props.page.expiresAt <= now.value));
const accessExpired = computed(() => Boolean(props.access && props.access.expiresAt <= now.value));
const sessionExpired = computed(() => pageExpired.value || accessExpired.value);
const sessionEndsAt = computed(() => {
  if (!props.page) return null;
  return props.access ? Math.min(props.access.expiresAt, props.page.expiresAt) : props.page.expiresAt;
});
const remainingMs = computed(() => Math.max(0, (sessionEndsAt.value ?? now.value) - now.value));
const remainingLabel = computed(() => {
  if (!sessionEndsAt.value) return "—";
  const totalSeconds = Math.ceil(remainingMs.value / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}${copy.value.hour} ${minutes}${copy.value.minute}`;
  if (minutes > 0) return `${minutes}${copy.value.minute} ${seconds}${copy.value.second}`;
  return `${seconds}${copy.value.second}`;
});
const expiryLabel = computed(() => {
  if (!sessionEndsAt.value) return "—";
  return new Date(sessionEndsAt.value).toLocaleString(props.locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const codexCommand = computed(() => {
  if (!props.access) return "";
  return `export PLING_AGENT_TOKEN='${props.access.token}'
codex mcp remove pling-todo 2>/dev/null || true
codex mcp add pling-todo --url ${props.access.mcpUrl} --bearer-token-env-var PLING_AGENT_TOKEN
codex --no-daemon`;
});

const claudeCommand = computed(() => {
  if (!props.access) return "";
  return `export PLING_AGENT_TOKEN='${props.access.token}'
claude mcp remove pling-todo >/dev/null 2>&1 || true
claude mcp add --transport http pling-todo ${props.access.mcpUrl} --header "Authorization: Bearer $PLING_AGENT_TOKEN"
claude`;
});

const remoteConfig = computed(() => {
  if (!props.access) return "";
  return JSON.stringify(
    {
      mcpServers: {
        "pling-todo": {
          type: "http",
          url: props.access.mcpUrl,
          headers: { Authorization: `Bearer ${props.access.token}` },
        },
      },
    },
    null,
    2,
  );
});

const clientSetups = computed<ClientSetup[]>(() => {
  const zh = props.locale === "zh";
  return [
    {
      id: "codex",
      label: "Codex",
      title: zh ? "在 Codex CLI 中接入" : "Connect from the Codex CLI",
      steps: zh
        ? ["把整段命令粘到同一个终端执行。", "最后一行使用 codex --no-daemon，避免复用没有这枚 token 的旧 daemon。", "先让它调用 pling_surface_describe，再操作返回的能力。"]
        : ["Paste the whole command into one terminal.", "The last line uses codex --no-daemon so it cannot reuse an older daemon without this token.", "Ask it to call pling_surface_describe before invoking a capability."],
      payload: codexCommand.value,
      language: "bash",
      note: copy.value.codexNote,
    },
    {
      id: "claude",
      label: "Claude",
      title: zh ? "在 Claude Code 中接入" : "Connect from Claude Code",
      steps: zh
        ? ["在同一个终端导出 token，并注册远程 HTTP MCP。", "启动 Claude 后让它先调用 pling_surface_describe。", "如果使用 Claude 的 Connectors 界面，选择远程 MCP 并填同一个 URL 与 Authorization 头。"]
        : ["Export the token and register the remote HTTP MCP server in one terminal.", "Start Claude and ask it to call pling_surface_describe first.", "If you use Claude's Connectors screen, choose remote MCP and enter the same URL and Authorization header."],
      payload: claudeCommand.value,
      language: "bash",
      note: copy.value.claudeNote,
    },
    {
      id: "hermes",
      label: "Hermes Agent",
      title: zh ? "在 Hermes Agent 的 MCP 设置中接入" : "Connect from Hermes Agent MCP settings",
      steps: zh
        ? ["打开 Hermes Agent 的 MCP / 工具连接设置。", "新增 Remote 或 Streamable HTTP MCP，名称填 pling-todo。", `URL 填 ${props.access?.mcpUrl ?? "页面上的 MCP 地址"}，请求头填 Authorization: Bearer <当前 token>。`]
        : ["Open Hermes Agent's MCP or tool connection settings.", "Add a Remote or Streamable HTTP MCP server named pling-todo.", `Use ${props.access?.mcpUrl ?? "the MCP URL shown on the page"} and the header Authorization: Bearer <current token>.`],
      payload: remoteConfig.value,
      language: "json",
      note: copy.value.remoteNote,
    },
    {
      id: "workbuddy",
      label: "WorkBuddy",
      title: zh ? "在 WorkBuddy 的 MCP / 连接器中接入" : "Connect from WorkBuddy MCP or connectors",
      steps: zh
        ? ["打开 WorkBuddy 的 MCP、连接器或工具设置。", "新增远程 MCP 服务，名称填 pling-todo。", `URL 填 ${props.access?.mcpUrl ?? "页面上的 MCP 地址"}，请求头填 Authorization: Bearer <当前 token>。`]
        : ["Open WorkBuddy's MCP, connector, or tool settings.", "Add a remote MCP server named pling-todo.", `Use ${props.access?.mcpUrl ?? "the MCP URL shown on the page"} and the header Authorization: Bearer <current token>.`],
      payload: remoteConfig.value,
      language: "json",
      note: copy.value.remoteNote,
    },
  ];
});

const activeSetup = computed(() => clientSetups.value.find((client) => client.id === activeClient.value) ?? clientSetups.value[0]!);

async function copyText(label: string, value: string): Promise<void> {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copied.value = label;
    setTimeout(() => {
      if (copied.value === label) copied.value = "";
    }, 1_500);
  } catch {
    copied.value = "";
  }
}

function moveClient(event: KeyboardEvent, index: number): void {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const last = clientSetups.value.length - 1;
  const next =
    event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowLeft" ? (index - 1 + last + 1) % (last + 1) : (index + 1) % (last + 1);
  activeClient.value = clientSetups.value[next]!.id;
  const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  tabs?.[next]?.focus();
}
</script>

<template>
  <section class="gateway-guide" aria-labelledby="gateway-guide-title" data-pling-ui data-pling-ignore>
    <header class="guide-head">
      <div>
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h2 id="gateway-guide-title">{{ copy.title }}</h2>
      </div>
      <span class="state" :data-state="agent ? 'agent' : state">
        <i aria-hidden="true"></i>{{ copy.status }} · {{ statusText }}
      </span>
    </header>
    <p class="lead">{{ copy.lead }}</p>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div v-if="state === 'idle' || state === 'connecting' || !page" class="loading">
      <span v-if="state !== 'idle'" class="spinner" aria-hidden="true"></span>
      <span>{{ state === "connecting" ? copy.states.connecting : copy.idleHint }}</span>
      <button v-if="state === 'idle'" class="primary" type="button" @click="$emit('retry')">{{ copy.connect }}</button>
    </div>

    <template v-else>
      <dl class="session">
        <div>
          <dt>{{ copy.session }}</dt>
          <dd><code>{{ page.pageSessionId }}</code></dd>
        </div>
        <div>
          <dt>{{ copy.remaining }}</dt>
          <dd><strong>{{ remainingLabel }}</strong></dd>
        </div>
        <div>
          <dt>{{ copy.expires }}</dt>
          <dd>{{ expiryLabel }}</dd>
        </div>
        <div>
          <dt>{{ copy.capabilities }}</dt>
          <dd>{{ page.scope.length }}</dd>
        </div>
      </dl>

      <section v-if="access && !sessionExpired" class="access">
        <div class="token-row">
          <div>
            <p class="eyebrow">{{ copy.access }}</p>
            <code class="token">{{ access.token }}</code>
          </div>
          <button type="button" @click="copyText('token', access.token)">
            {{ copied === "token" ? copy.tokenCopied : copy.copy }}
          </button>
        </div>
        <p class="hint">{{ copy.accessHint }}</p>

        <div class="client-head">
          <p class="eyebrow">{{ copy.clients }}</p>
          <div class="client-tabs" role="tablist" :aria-label="copy.clients">
            <button
              v-for="(client, index) in clientSetups"
              :id="`client-tab-${client.id}`"
              :key="client.id"
              type="button"
              role="tab"
              :aria-selected="activeClient === client.id"
              :aria-controls="`client-panel-${client.id}`"
              :tabindex="activeClient === client.id ? 0 : -1"
              :class="{ 'is-active': activeClient === client.id }"
              @click="activeClient = client.id"
              @keydown="moveClient($event, index)"
            >
              {{ client.label }}
            </button>
          </div>
        </div>

        <section
          :id="`client-panel-${activeSetup.id}`"
          class="client-panel"
          role="tabpanel"
          :aria-labelledby="`client-tab-${activeSetup.id}`"
        >
          <div class="client-panel__head">
            <div>
              <p class="eyebrow">{{ activeSetup.label }}</p>
              <h3>{{ activeSetup.title }}</h3>
            </div>
            <button type="button" @click="copyText(activeSetup.id, activeSetup.payload)">
              {{ copied === activeSetup.id ? copy.copied : copy.copyPayload }}
            </button>
          </div>
          <ol class="steps">
            <li v-for="step in activeSetup.steps" :key="step">{{ step }}</li>
          </ol>
          <pre :data-language="activeSetup.language">{{ activeSetup.payload }}</pre>
          <p class="hint">{{ activeSetup.note }}</p>
        </section>

        <div v-if="agent" class="agent-state">
          <div>
            <p class="eyebrow">{{ copy.agent }}</p>
            <strong>{{ agent.agentId }}</strong>
            <p class="hint">{{ copy.agentHint }}</p>
          </div>
          <button class="danger" type="button" :disabled="Boolean(busy)" @click="$emit('revoke')">
            {{ busy === "revoke" ? copy.revoking : copy.revoke }}
          </button>
        </div>
      </section>

      <section v-else class="ready">
        <p class="eyebrow">{{ sessionExpired ? copy.expired : copy.access }}</p>
        <p class="hint">{{ sessionExpired ? copy.expiredHint : copy.accessHint }}</p>
        <button class="primary" type="button" :disabled="Boolean(busy) || (!pageExpired && state !== 'connected')" @click="pageExpired ? $emit('retry') : $emit('access')">
          {{ busy === "access" ? copy.creating : pageExpired ? copy.retry : accessExpired ? copy.renew : copy.create }}
        </button>
      </section>

      <details class="scope-details">
        <summary>{{ copy.capabilities }} · {{ page.scope.length }}</summary>
        <ul class="scope">
          <li v-for="item in page.scope" :key="item">{{ item }}</li>
        </ul>
      </details>
    </template>

    <section class="rules">
      <h3>{{ copy.rulesTitle }}</h3>
      <ul>
        <li v-for="rule in copy.rules" :key="rule">{{ rule }}</li>
      </ul>
    </section>

    <p class="boundary">{{ copy.boundary }}</p>
  </section>
</template>

<style scoped>
.gateway-guide {
  padding: 22px;
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 44px rgb(15 23 42 / 7%);
}
.guide-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.eyebrow {
  margin: 0 0 3px;
  color: #2e9df7;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
h2 { margin: 0; font-size: 20px; line-height: 1.3; letter-spacing: -0.02em; }
h3 { margin: 0; color: #193045; font-size: 14px; line-height: 1.4; }
.state {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  font-weight: 650;
}
.state i { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; }
.state[data-state="connected"], .state[data-state="agent"] { background: #ecfdf3; color: #18794e; }
.state[data-state="connected"] i, .state[data-state="agent"] i { background: #22a06b; }
.state[data-state="connecting"] i { background: #f59e0b; }
.state[data-state="disconnected"] i, .state[data-state="closed"] i { background: #ef4444; }
.lead { margin: 10px 0 15px; color: #64748b; font-size: 13px; line-height: 1.65; }
.loading { display: flex; align-items: center; gap: 9px; color: #64748b; font-size: 12px; }
.spinner {
  width: 12px; height: 12px; border: 2px solid #cbd5e1; border-top-color: #2e9df7; border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.session {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0 0 14px;
  overflow: hidden;
  border: 1px solid #e5edf5;
  border-radius: 10px;
  background: #e5edf5;
}
.session > div { min-width: 0; padding: 9px 10px; background: #f8fbfe; }
.session dt { color: #8b99aa; font-size: 10px; }
.session dd { min-width: 0; margin: 3px 0 0; overflow-wrap: anywhere; color: #334155; font-size: 11px; }
.session code, .token, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.access, .ready {
  padding: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fbfdff;
}
.ready > .hint { margin: 0 0 10px; }
.token-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.token-row > div { min-width: 0; }
.token { display: block; max-width: 100%; margin-top: 5px; padding: 7px 9px; overflow-wrap: anywhere; border-radius: 7px; background: #0f172a; color: #dbeafe; font-size: 10px; line-height: 1.45; }
.hint { margin: 7px 0 0; color: #718096; font-size: 11px; line-height: 1.55; }
.client-head { margin-top: 14px; }
.client-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
  padding: 4px;
  border-radius: 10px;
  background: #eef5fb;
}
.client-tabs button {
  flex: 1 1 auto;
  padding: 7px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #63758a;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}
.client-tabs button.is-active { background: #fff; color: #0b6db7; box-shadow: 0 2px 8px rgb(15 23 42 / 8%); }
.client-panel {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid #dbe8f5;
  border-radius: 10px;
  background: #fff;
}
.client-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.steps { margin: 10px 0 9px; padding-left: 19px; color: #536579; font-size: 11px; line-height: 1.55; }
.steps li + li { margin-top: 4px; }
pre {
  max-height: 300px;
  margin: 9px 0 0;
  padding: 11px;
  overflow: auto;
  border-radius: 8px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 10px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.token-row > button, .client-panel__head > button, .primary, .danger, .loading button {
  flex: none;
  padding: 7px 10px;
  border: 0;
  border-radius: 7px;
  background: #1273cf;
  color: #fff;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}
.client-panel__head > button { border: 1px solid #d5e5f3; background: #f5faff; color: #0b6db7; }
.agent-state { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-top: 13px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.agent-state strong { display: block; color: #1e293b; font-size: 12px; }
.agent-state .hint { margin-top: 3px; }
.danger { background: #b42318; }
button:disabled { opacity: 0.55; cursor: wait; }
.scope-details { margin-top: 12px; color: #475569; font-size: 11px; }
.scope-details summary { color: #0b6db7; font-weight: 650; cursor: pointer; }
.scope { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0; padding: 0; list-style: none; }
.scope li { padding: 3px 6px; border-radius: 5px; background: #e0f2fe; color: #0b6db7; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
.rules { margin-top: 14px; padding: 13px; border: 1px solid #e8eef5; border-radius: 11px; background: #f8fafc; }
.rules h3 { font-size: 12px; }
.rules ul { margin: 8px 0 0; padding-left: 17px; color: #607186; font-size: 11px; line-height: 1.55; }
.rules li + li { margin-top: 5px; }
.error { margin: 0 0 10px; padding: 7px 9px; border-radius: 7px; background: #fef3f2; color: #b42318; font-size: 11px; }
.boundary { margin: 14px 0 0; padding-top: 11px; border-top: 1px solid #e2e8f0; color: #8d9aaa; font-size: 10px; line-height: 1.55; }
@media (max-width: 520px) {
  .guide-head, .token-row, .client-panel__head, .agent-state { flex-direction: column; }
  .state { align-self: flex-start; }
  .session { grid-template-columns: 1fr; }
  .token-row > button, .client-panel__head > button, .agent-state > button { align-self: stretch; }
}
</style>
