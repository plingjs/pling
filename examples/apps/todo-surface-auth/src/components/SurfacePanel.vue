<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import type { SurfaceSession } from "@plingjs/surface";
import type { Pairing, PageSession } from "../api";
import type { GatewayConnectionState } from "../surface/transport";

const props = defineProps<{
  connection: GatewayConnectionState | "idle";
  page: PageSession | null;
  pairing: Pairing | null;
  agent: SurfaceSession | null;
  busy: string;
  error: string;
}>();

defineEmits<{
  connect: [];
  pair: [];
  revoke: [];
}>();

const now = ref(Date.now());
const timer = setInterval(() => (now.value = Date.now()), 1_000);
const copied = ref("");

onUnmounted(() => clearInterval(timer));

const connectionLabel = computed(() => {
  if (props.agent) return "Agent connected";
  if (props.connection === "connected") return "Page connected";
  if (props.connection === "connecting") return "Connecting";
  if (props.connection === "disconnected") return "Reconnecting";
  if (props.connection === "closed") return "Session closed";
  return "External access off";
});

const secondsLeft = computed(() => {
  const expiresAt = props.pairing?.expiresAt ?? props.agent?.expiresAt;
  return expiresAt ? Math.max(0, Math.ceil((expiresAt - now.value) / 1_000)) : null;
});

const pairingExpired = computed(
  () => props.pairing !== null && props.pairing.expiresAt <= now.value,
);

const expiry = computed(() => {
  if (secondsLeft.value === null) return "";
  const minutes = Math.floor(secondsLeft.value / 60);
  const seconds = secondsLeft.value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
});

const claimCommand = computed(() => {
  const code = props.pairing?.code;
  return code ? `pnpm --filter @plingjs/example-todo-surface-auth surface:claim ${code} --agent codex` : "";
});

const mcpSnippet = computed(() => {
  if (!props.pairing) return "";
  return JSON.stringify(
    {
      mcpServers: {
        "pling-todo": {
          type: "http",
          url: props.pairing.mcpUrl,
          headers: { Authorization: "Bearer <agent-token>" },
        },
      },
    },
    null,
    2,
  );
});

async function copy(label: string, value: string): Promise<void> {
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
</script>

<template>
  <aside class="surface" aria-labelledby="surface-title">
    <header class="surface__head">
      <div>
        <p class="eyebrow">Third-party access</p>
        <h2 id="surface-title">Agent Surface</h2>
      </div>
      <span class="state" :data-state="agent ? 'agent' : connection">
        <span aria-hidden="true"></span>{{ connectionLabel }}
      </span>
    </header>

    <p v-if="!page" class="surface__lead">
      External Agents cannot see this page until its owner creates a short-lived Surface session. Sign in above, then
      enable access from this panel.
    </p>

    <button
      v-if="!page"
      class="surface__primary"
      type="button"
      :disabled="Boolean(busy)"
      @click="$emit('connect')"
    >
      {{ busy === "connect" ? "Creating session…" : "Enable external access" }}
    </button>

    <template v-else>
      <dl class="session">
        <div>
          <dt>Page session</dt>
          <dd><code>{{ page.pageSessionId }}</code></dd>
        </div>
        <div>
          <dt>Gateway</dt>
          <dd>{{ connection }}</dd>
        </div>
        <div>
          <dt>MCP endpoint</dt>
          <dd><code>{{ page.mcpUrl }}</code></dd>
        </div>
      </dl>

      <section v-if="agent" class="connected" aria-labelledby="connected-title">
        <p class="eyebrow">Active delegation</p>
        <h3 id="connected-title">{{ agent.agentId }}</h3>
        <p>Only the capabilities below are exposed. The Agent has no access to login, cookies, or other users.</p>
        <dl>
          <div><dt>Session</dt><dd><code>{{ agent.sessionId }}</code></dd></div>
          <div><dt>Expires in</dt><dd>{{ expiry }}</dd></div>
        </dl>
        <ul class="scope" aria-label="Exposed scopes">
          <li v-for="scope in agent.scope" :key="scope">{{ scope }}</li>
        </ul>
        <button class="surface__danger" type="button" :disabled="Boolean(busy)" @click="$emit('revoke')">
          {{ busy === "revoke" ? "Revoking…" : "Revoke Agent" }}
        </button>
      </section>

      <section v-else-if="pairing && !pairingExpired" class="pairing" aria-labelledby="pairing-title">
        <p class="eyebrow">One-time pairing code</p>
        <div class="pairing__code-row">
          <code id="pairing-title" class="pairing__code">{{ pairing.code }}</code>
          <span>{{ expiry }}</span>
        </div>
        <p>
          Run the command below in a terminal, then give the printed token to your MCP client. The code is consumed
          once and this page must remain open.
        </p>
        <div class="copy-row">
          <code>{{ claimCommand }}</code>
          <button type="button" @click="copy('command', claimCommand)">
            {{ copied === "command" ? "Copied" : "Copy" }}
          </button>
        </div>
        <details>
          <summary>MCP client configuration</summary>
          <div class="copy-row copy-row--stack">
            <pre>{{ mcpSnippet }}</pre>
            <button type="button" @click="copy('mcp', mcpSnippet)">
              {{ copied === "mcp" ? "Copied" : "Copy" }}
            </button>
          </div>
        </details>
      </section>

      <section v-else-if="pairingExpired" class="ready" aria-labelledby="expired-title">
        <p class="eyebrow">Pairing expired</p>
        <h3 id="expired-title">Create a new code</h3>
        <p>
          The previous code expired before an Agent claimed it. A new code will bind one Agent to this page session.
        </p>
        <button
          class="surface__primary"
          type="button"
          :disabled="connection !== 'connected' || Boolean(busy)"
          @click="$emit('pair')"
        >
          {{ busy === "pair" ? "Creating code…" : "Create a new pairing code" }}
        </button>
      </section>

      <section v-else class="ready" aria-labelledby="ready-title">
        <p class="eyebrow">Ready to delegate</p>
        <h3 id="ready-title">Create a pairing code</h3>
        <p>
          A pairing code binds exactly one external Agent to this browser session. It is not a login and cannot be
          reused.
        </p>
        <button class="surface__primary" type="button" :disabled="connection !== 'connected' || Boolean(busy)" @click="$emit('pair')">
          {{ busy === "pair" ? "Creating code…" : connection === "connected" ? "Create pairing code" : "Waiting for page socket" }}
        </button>
      </section>
    </template>

    <p v-if="error" class="surface__error" role="alert">{{ error }}</p>

    <section class="scope-note" aria-labelledby="scope-note-title">
      <h3 id="scope-note-title">Exposure boundary</h3>
      <p>
        This page announces four business capabilities: add a task, toggle one task, delete one task, and clear
        completed tasks. Navigation, account settings, and the login form are not exposed.
      </p>
      <p>Deletion and clearing always stop for human approval in this page. There is no approval method in MCP.</p>
    </section>

    <button
      v-if="page && connection !== 'connected' && connection !== 'connecting'"
      class="surface__secondary"
      type="button"
      :disabled="Boolean(busy)"
      @click="$emit('connect')"
    >
      Start a new page session
    </button>
  </aside>
</template>

<style scoped>
.surface {
  align-self: start;
  padding: 20px;
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 16px 40px rgb(15 23 42 / 6%);
}
.surface__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.eyebrow {
  margin: 0 0 5px;
  color: #1677c8;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h2,
h3 {
  margin: 0;
  color: #0f172a;
  letter-spacing: -0.02em;
}
h2 {
  font-size: 20px;
}
h3 {
  font-size: 15px;
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.state > span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentcolor;
}
.state[data-state="connected"],
.state[data-state="agent"] {
  background: #ecfdf5;
  color: #047857;
}
.state[data-state="connecting"],
.state[data-state="disconnected"] {
  background: #fffbeb;
  color: #b45309;
}
.state[data-state="closed"] {
  background: #fef2f2;
  color: #b91c1c;
}
.surface__lead,
.ready p,
.pairing > p,
.connected > p,
.scope-note p {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}
.surface__lead {
  margin: 16px 0;
}
button {
  font: inherit;
  cursor: pointer;
}
.surface__primary,
.surface__secondary,
.surface__danger {
  width: 100%;
  padding: 9px 12px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 700;
}
.surface__primary {
  border: 0;
  background: #2e9df7;
  color: #fff;
}
.surface__primary:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
.surface__secondary {
  margin-top: 14px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}
.surface__danger {
  margin-top: 12px;
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
}
.session,
.connected dl {
  display: grid;
  gap: 9px;
  margin: 18px 0;
}
.session > div,
.connected dl > div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 8px;
}
dt {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
dd {
  min-width: 0;
  margin: 0;
  color: #475569;
  font-size: 11px;
  overflow-wrap: anywhere;
}
code {
  padding: 2px 5px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}
.connected,
.pairing,
.ready {
  margin-top: 18px;
  padding: 15px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
}
.connected p,
.pairing > p,
.ready p {
  margin: 7px 0 13px;
}
.scope {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.scope li {
  padding: 3px 7px;
  border-radius: 999px;
  background: #eaf6ff;
  color: #1677c8;
  font-size: 10px;
}
.pairing__code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 8px 0 12px;
}
.pairing__code {
  padding: 5px 8px;
  background: #e0f2fe;
  color: #075985;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.pairing__code-row > span {
  color: #b45309;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.copy-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
}
.copy-row > code {
  flex: 1;
  min-width: 0;
  padding: 8px;
  overflow-wrap: anywhere;
  line-height: 1.55;
}
.copy-row button {
  flex: none;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  color: #334155;
  font-size: 10px;
}
.copy-row--stack {
  align-items: stretch;
  flex-direction: column;
}
.copy-row--stack button {
  align-self: flex-end;
}
pre {
  margin: 0;
  padding: 9px;
  overflow: auto;
  border-radius: 7px;
  background: #eef2f7;
  color: #334155;
  font-size: 9px;
  line-height: 1.55;
}
details {
  margin-top: 11px;
}
summary {
  color: #1677c8;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.scope-note {
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid #e8eef5;
}
.scope-note h3 {
  font-size: 12px;
}
.scope-note p {
  margin: 7px 0 0;
}
.surface__error {
  margin: 12px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 11px;
  line-height: 1.5;
}
</style>
