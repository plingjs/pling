<script setup lang="ts">
import { ref } from "vue";
import { AgentDock, useAgentState, useAgentTool, usePling } from "@plingjs/vue";
import { createExecutor, createPolicy } from "@plingjs/core";
import { defaultSettle } from "@plingjs/agent";
import { createSurface } from "@plingjs/surface";
import { installMcpBridge } from "../../external-agent-surface/src/mcp-bridge";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Ticket { id: string; subject: string; customer: string; state: "open" | "waiting"; reply: string }

const zh = resolveLocale() === "zh";
const pling = usePling();
const tickets = ref<Ticket[]>([
  { id: "TCK-91", subject: "Invoice mismatch", customer: "Northwind", state: "open", reply: "" },
  { id: "TCK-92", subject: "Delivery exception", customer: "Globex", state: "open", reply: "" },
  { id: "TCK-93", subject: "Contract renewal", customer: "Initech", state: "open", reply: "" },
]);
function reply(id: string, text: string): Ticket {
  const ticket = tickets.value.find((item) => item.id === id);
  if (!ticket) throw new Error("Ticket not found.");
  ticket.reply = text.slice(0, 500);
  ticket.state = "waiting";
  return { ...ticket };
}
function openList(): Ticket[] { return tickets.value.filter((ticket) => ticket.state === "open"); }

useAgentTool({ id: "ticket_list", desc: bilingual("List open support tickets", "列出待处理支持工单"), kind: "read", run: () => ({ tickets: tickets.value }) });
useAgentTool({ id: "ticket_reply", desc: bilingual("Send a reply to one support ticket", "回复一张支持工单"), kind: "write", params: [{ name: "record", label: "Ticket id" }, { name: "text", label: "Reply", maxLength: 500 }], run: async (args) => reply(String(args.record), String(args.text)) });
useAgentTool({ id: "ticket_stats", desc: bilingual("Read open ticket counts", "读取待处理工单统计"), kind: "read", run: () => ({ open: openList().length }) });

const executor = createExecutor({ registry: pling.registry, policy: createPolicy(async () => true), settle: defaultSettle });
const surface = createSurface({
  registry: pling.registry,
  execute: (id, args) => executor.execute(id, args),
  app: "recipe-mcp-ticket-desk",
  expose: ["ticket_list", "ticket_reply", "ticket_stats"],
  session: { agentId: "mcp-client", sessionId: "recipe-mcp", userId: "demo-user", expiresAt: Date.now() + 3_600_000, scope: ["ticket_list", "ticket_reply", "ticket_stats"] },
  recordLimit: 6,
});
const approval = { subscribe: (_listener: (value: null) => void) => () => {} };
const bridge = installMcpBridge({ surface, approval, app: "recipe-mcp-ticket-desk", port: 5283, token: "pling-todo-local" });

useAgentState("mcp_ticket_view", () => ({ open: openList().length, total: tickets.value.length, mcpBridge: bridge.state.value }), { description: "Ticket counts and the local MCP bridge connection state" });
</script>

<template>
  <RecipeShell eyebrow="Recipe 10 · MCP" :title="bilingual('The page stays open; the MCP client stays outside', '页面保持打开，MCP 客户端留在页面之外')" :description="bilingual('A local stdio MCP process connects to this open page over loopback. It receives describe and invoke, never the DOM, model key, or a generic script evaluator.', '本地 stdio MCP 进程通过回环地址连接这个打开中的页面。它拿到 describe 与 invoke，而不是 DOM、模型密钥或任意脚本执行器。')">
    <div class="grid">
      <section class="panel" v-scope="{ id: 'tickets', label: bilingual('Support tickets', '支持工单'), role: 'list' }"><div class="panel__head"><div><h2>{{ bilingual('Ticket desk', '工单台') }}</h2><p>{{ openList().length }} {{ bilingual('open', '待处理') }}</p></div></div><ul class="records"><li v-for="ticket in tickets" :key="ticket.id" class="record" :class="{ 'is-muted': ticket.state === 'waiting' }" v-record="{ data: ticket, label: ticket.id, fields: { customer: ticket.customer, subject: ticket.subject, state: ticket.state, reply: ticket.reply } }"><div class="record__main"><p class="record__title">{{ ticket.subject }} <span class="record__id">{{ ticket.id }}</span></p><p class="record__meta">{{ ticket.customer }} · {{ ticket.state }} · {{ ticket.reply || bilingual('No reply', '未回复') }}</p></div></li></ul></section>
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('MCP bridge', 'MCP 桥') }}</h2><p>{{ bilingual('Loopback only; the page must remain open.', '仅回环地址；页面必须保持打开。') }}</p></div><span class="tag" :class="bridge.state.value === 'connected' ? 'ok' : 'warn'">{{ bridge.state.value }}</span></div><div class="body"><p class="hint">{{ bilingual('Start the stdio server in a terminal:', '在终端启动 stdio server：') }}</p><pre class="code-box">PLING_SURFACE_APP_URL="http://localhost:5191/demos/recipe-mcp/?mcp=1" \
pnpm --filter @plingjs/examples surface:mcp</pre><p class="hint" style="margin-top: 10px">{{ bilingual('Register that command with Codex, Claude Code, Hermes, or another stdio MCP client. Ask it to list tickets, reply to TCK-91, and read statistics.', '把该命令注册到 Codex、Claude Code、Hermes 或其他 stdio MCP 客户端。让它列出工单、回复 TCK-91，并读取统计。') }}</p><pre class="code-box" style="margin-top: 10px">{{ JSON.stringify({ tools: ["pling_surface_describe", "pling_surface_invoke", "pling_surface_approval_status"], exposed: ["ticket_list", "ticket_reply", "ticket_stats"] }, null, 2) }}</pre></div></section>
    </div>
    <AgentDock :title="bilingual('Ticket assistant', '工单助手')" :quick="zh ? ['现在有多少张待处理工单？', '回复 TCK-91：已收到，今天处理'] : ['How many tickets are open?', 'Reply to TCK-91: received, we will handle it today']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
