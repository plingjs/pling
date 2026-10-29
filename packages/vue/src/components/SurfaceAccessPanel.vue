<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { usePling } from "../directive";
import type { SurfaceGatewayController } from "../surface-gateway";

const props = defineProps<{
  gateway: SurfaceGatewayController;
  title?: string;
}>();

const ui = usePling().ui;
const zh = computed(() => ui.locale.toLowerCase().startsWith("zh"));
const now = ref(Date.now());
const timer = setInterval(() => (now.value = Date.now()), 1_000);
const copied = ref("");

onUnmounted(() => clearInterval(timer));

const copy = computed(() =>
  zh.value
    ? {
        title: "外部 Agent",
        idle: "未连接",
        connecting: "正在连接",
        connected: "页面已连接",
        disconnected: "正在重连",
        closed: "连接已关闭",
        connect: "连接 Surface",
        reconnect: "重新连接",
        cancel: "断开",
        pairing: "生成配对码",
        pairingHint: "把一次性配对码交给外部 Agent。页面必须保持打开。",
        pairingCode: "配对码",
        pairExpired: "配对码已过期，请重新生成。",
        claim: "生成 Agent token",
        claiming: "正在生成…",
        claimHint: "公开演示模式。Agent token 只属于当前页面会话；不要发到对话、仓库或公开日志。",
        access: "Agent token",
        command: "Codex 接入命令",
        copy: "复制",
        copied: "已复制",
        agent: "已绑定的 Agent",
        scope: "允许的能力",
        revoke: "撤销 Agent",
        revoking: "正在撤销…",
        expires: "剩余",
        expired: "已过期",
        pageSession: "页面会话",
        mcp: "MCP 端点",
        empty: "还没有外部 Agent 会话。",
      }
    : {
        title: "External Agent",
        idle: "Not connected",
        connecting: "Connecting",
        connected: "Page connected",
        disconnected: "Reconnecting",
        closed: "Connection closed",
        connect: "Connect Surface",
        reconnect: "Reconnect",
        cancel: "Disconnect",
        pairing: "Create pairing code",
        pairingHint: "Give the one-time code to an external Agent. Keep this page open.",
        pairingCode: "Pairing code",
        pairExpired: "This code expired. Create a new one.",
        claim: "Create Agent token",
        claiming: "Creating…",
        claimHint: "Public-demo mode. The token belongs to this page session; never post it in chat, a repository, or public logs.",
        access: "Agent token",
        command: "Codex command",
        copy: "Copy",
        copied: "Copied",
        agent: "Bound Agent",
        scope: "Exposed capabilities",
        revoke: "Revoke Agent",
        revoking: "Revoking…",
        expires: "left",
        expired: "expired",
        pageSession: "Page session",
        mcp: "MCP endpoint",
        empty: "No external Agent session yet.",
      },
);

const gateway = computed(() => props.gateway);
const titleText = computed(() => props.title?.trim() || copy.value.title);
const statusText = computed(() => copy.value[gateway.value.state.value]);
const page = computed(() => gateway.value.page.value);
const pairing = computed(() => gateway.value.pairing.value);
const access = computed(() => gateway.value.access.value);
const agent = computed(() => gateway.value.agent.value);
const live = computed(() => Boolean(pairing.value || access.value || agent.value));

const remaining = computed(() => {
  const expiresAt = agent.value?.expiresAt ?? pairing.value?.expiresAt ?? page.value?.expiresAt;
  if (!expiresAt) return "";
  const seconds = Math.max(0, Math.ceil((expiresAt - now.value) / 1_000));
  if (seconds === 0) return copy.value.expired;
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
});

const pairingExpired = computed(() => Boolean(pairing.value && pairing.value.expiresAt <= now.value));

const command = computed(() => {
  const value = access.value;
  if (!value) return "";
  return [
    `export PLING_AGENT_TOKEN='${value.token}'`,
    `codex mcp remove pling-surface >/dev/null 2>&1 || true`,
    `codex mcp add pling-surface --url ${value.mcpUrl} --bearer-token-env-var PLING_AGENT_TOKEN`,
  ].join("\n");
});

async function copyText(kind: string, value: string): Promise<void> {
  if (!value || !navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
  copied.value = kind;
  window.setTimeout(() => {
    if (copied.value === kind) copied.value = "";
  }, 1_500);
}
</script>

<template>
  <section class="pling-surface" data-pling-ui :class="ui.classNames.panel" :style="ui.cssVars" aria-labelledby="pling-surface-title">
    <header class="pling-surface__head">
      <div>
        <p class="pling-surface__eyebrow">{{ copy.title }}</p>
        <h2 id="pling-surface-title">{{ titleText }}</h2>
      </div>
      <span class="pling-surface__status" :class="`is-${gateway.state.value}`">{{ statusText }}</span>
    </header>

    <p v-if="gateway.error.value" class="pling-surface__error" role="alert">{{ gateway.error.value }}</p>

    <div v-if="page" class="pling-surface__session">
      <div><span>{{ copy.pageSession }}</span><code>{{ page.pageSessionId }}</code></div>
      <div v-if="remaining"><span>{{ copy.expires }}</span><b>{{ remaining }}</b></div>
      <div><span>{{ copy.mcp }}</span><code>{{ page.mcpUrl }}</code></div>
    </div>

    <section v-if="agent" class="pling-surface__block">
      <p class="pling-surface__label">{{ copy.agent }}</p>
      <div class="pling-surface__agent">
        <strong>{{ agent.agentId }}</strong>
        <span>{{ agent.sessionId }}</span>
      </div>
      <p class="pling-surface__label">{{ copy.scope }}</p>
      <ul class="pling-surface__scope">
        <li v-for="item in agent.scope" :key="item"><code>{{ item }}</code></li>
      </ul>
      <button type="button" class="pling-surface__danger" :disabled="Boolean(gateway.busy.value)" @click="gateway.revoke()">
        {{ gateway.busy.value === "revoke" ? copy.revoking : copy.revoke }}
      </button>
    </section>

    <section v-else-if="gateway.mode === 'public-demo'" class="pling-surface__block">
      <template v-if="access">
        <p class="pling-surface__label">{{ copy.access }}</p>
        <div class="pling-surface__copy-row">
          <code>{{ access.token }}</code>
          <button type="button" @click="copyText('token', access.token)">{{ copied === "token" ? copy.copied : copy.copy }}</button>
        </div>
        <p class="pling-surface__hint">{{ copy.claimHint }}</p>
        <details class="pling-surface__details">
          <summary>{{ copy.command }}</summary>
          <div class="pling-surface__code">
            <pre>{{ command }}</pre>
            <button type="button" @click="copyText('command', command)">{{ copied === "command" ? copy.copied : copy.copy }}</button>
          </div>
        </details>
      </template>
      <template v-else>
        <p class="pling-surface__hint">{{ copy.claimHint }}</p>
        <button
          type="button"
          class="pling-surface__primary"
          :disabled="gateway.state.value !== 'connected' || Boolean(gateway.busy.value)"
          @click="gateway.claim()"
        >
          {{ gateway.busy.value === "claim" ? copy.claiming : copy.claim }}
        </button>
      </template>
    </section>

    <section v-else class="pling-surface__block">
      <template v-if="pairing && !pairingExpired">
        <p class="pling-surface__label">{{ copy.pairingCode }}</p>
        <div class="pling-surface__code-row">
          <code class="pling-surface__pair">{{ pairing.code }}</code>
          <button type="button" @click="copyText('pairing', pairing.code)">{{ copied === "pairing" ? copy.copied : copy.copy }}</button>
        </div>
        <p class="pling-surface__hint">{{ copy.pairingHint }}</p>
      </template>
      <template v-else>
        <p v-if="pairingExpired" class="pling-surface__hint">{{ copy.pairExpired }}</p>
        <p v-else class="pling-surface__hint">{{ copy.pairingHint }}</p>
        <button
          type="button"
          class="pling-surface__primary"
          :disabled="gateway.state.value !== 'connected' || Boolean(gateway.busy.value)"
          @click="gateway.pair()"
        >
          {{ gateway.busy.value === "pair" ? copy.claiming : copy.pairing }}
        </button>
      </template>
    </section>

    <div class="pling-surface__actions">
      <button
        v-if="gateway.state.value === 'idle' || gateway.state.value === 'closed' || gateway.state.value === 'disconnected'"
        type="button"
        class="pling-surface__primary"
        :disabled="Boolean(gateway.busy.value)"
        @click="gateway.connect()"
      >
        {{ gateway.state.value === 'idle' || gateway.state.value === 'closed' ? copy.connect : copy.reconnect }}
      </button>
      <button v-else type="button" :disabled="Boolean(gateway.busy.value)" @click="gateway.disconnect()">
        {{ copy.cancel }}
      </button>
      <slot name="actions" :gateway="gateway" />
    </div>

    <slot name="extra" :gateway="gateway" />
  </section>
</template>

<style scoped>
.pling-surface {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 16px;
  background: var(--pling-surface-bg, #fff);
  color: var(--pling-surface-fg, #172033);
  font-size: 13px;
}
.pling-surface__head,
.pling-surface__actions,
.pling-surface__code-row,
.pling-surface__copy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.pling-surface__head { align-items: flex-start; }
.pling-surface__eyebrow,
.pling-surface__label {
  margin: 0;
  color: #64748b;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h2 { margin: 2px 0 0; font-size: 18px; letter-spacing: -0.02em; }
.pling-surface__status {
  padding: 4px 8px;
  border: 1px solid #dbe4ee;
  border-radius: 999px;
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
}
.pling-surface__status.is-connected { border-color: #a7e3c4; color: #137a4b; background: #effcf5; }
.pling-surface__status.is-disconnected { border-color: #f4d38b; color: #93620b; background: #fff9e9; }
.pling-surface__status.is-closed { color: #9a3412; background: #fff4ed; }
.pling-surface__error { margin: 0; padding: 9px 10px; border-radius: 9px; color: #9f1239; background: #fff1f2; }
.pling-surface__session { display: grid; gap: 7px; padding: 10px; border-radius: 10px; background: #f7fafc; }
.pling-surface__session > div { display: flex; justify-content: space-between; gap: 12px; min-width: 0; }
.pling-surface__session span { color: #64748b; }
.pling-surface__session code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pling-surface__block { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid #edf1f5; }
.pling-surface__agent { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.pling-surface__agent span { color: #64748b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.pling-surface__scope { display: flex; flex-wrap: wrap; gap: 5px; margin: 0; padding: 0; list-style: none; }
.pling-surface__scope li { padding: 3px 6px; border-radius: 6px; background: #eef6ff; color: #0b61a4; }
.pling-surface__hint { margin: 0; color: #64748b; line-height: 1.5; }
.pling-surface__copy-row, .pling-surface__code-row { align-items: flex-start; }
.pling-surface__copy-row code { min-width: 0; overflow-wrap: anywhere; }
.pling-surface__pair { font-size: 20px !important; letter-spacing: 0.12em; }
.pling-surface__details { border: 1px solid #e4ebf2; border-radius: 9px; padding: 8px 10px; }
.pling-surface__details summary { cursor: pointer; color: #27364a; font-weight: 650; }
.pling-surface__code { display: grid; gap: 8px; margin-top: 8px; }
.pling-surface__code pre { margin: 0; overflow: auto; padding: 9px; border-radius: 8px; background: #0f172a; color: #e2e8f0; font-size: 11px; line-height: 1.55; }
button { cursor: pointer; border: 1px solid #d5dfeb; border-radius: 8px; background: #fff; color: #253449; padding: 7px 10px; font: inherit; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
.pling-surface__primary { border-color: #1b83e8; background: #1680e8; color: #fff; font-weight: 650; }
.pling-surface__danger { border-color: #f0b4b8; color: #b4232b; background: #fff7f7; justify-self: start; }
.pling-surface__actions { padding-top: 4px; flex-wrap: wrap; }
.pling-surface__actions > :deep(*) { max-width: 100%; }
@media (max-width: 520px) {
  .pling-surface__head, .pling-surface__session > div { align-items: flex-start; flex-direction: column; }
  .pling-surface__status { align-self: flex-start; }
}
</style>
