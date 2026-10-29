<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Ticket { id: string; customer: string; subject: string; priority: "low" | "normal" | "urgent"; status: "open" | "waiting" | "closed"; updated: string }

const zh = resolveLocale() === "zh";
const customers = ["Northwind", "Globex", "Initech", "Umbrella", "Acme", "Hooli", "Soylent", "Vandelay"];
const subjects = ["Invoice mismatch", "Delivery exception", "Access request", "Contract renewal", "Payment hold", "Address change"];
const tickets = ref<Ticket[]>(Array.from({ length: 160 }, (_, index) => ({
  id: `TCK-${String(7001 + index)}`,
  customer: customers[index % customers.length] ?? "Acme",
  subject: subjects[index % subjects.length] ?? "Support request",
  priority: index % 11 === 0 ? "urgent" : index % 4 === 0 ? "low" : "normal",
  status: index % 7 === 0 ? "closed" : index % 5 === 0 ? "waiting" : "open",
  updated: new Date(Date.now() - index * 37 * 60_000).toISOString(),
})));
const draft = ref("");
const applied = ref("");
const status = ref<"all" | Ticket["status"]>("open");
const visible = computed(() => tickets.value.filter((ticket) => {
  if (status.value !== "all" && ticket.status !== status.value) return false;
  const needle = applied.value.toLowerCase();
  return !needle || `${ticket.id} ${ticket.customer} ${ticket.subject}`.toLowerCase().includes(needle);
}));
const loaded = ref(30);

function applySearch(): void { applied.value = draft.value.trim(); loaded.value = 30; }
function review(id: string): Ticket {
  const ticket = tickets.value.find((item) => item.id === id);
  if (!ticket) throw new Error("The ticket does not exist.");
  ticket.status = "waiting";
  return { ...ticket };
}

useAgentState("ticket_view", () => ({
  appliedSearch: applied.value,
  status: status.value,
  total: tickets.value.length,
  matched: visible.value.length,
  loaded: Math.min(loaded.value, visible.value.length),
  urgent: visible.value.filter((ticket) => ticket.priority === "urgent").length,
}), { description: "Applied filters, total/matched/loaded counts, and urgent count; row fields come from records" });

useAgentTool({
  id: "set_ticket_search",
  desc: bilingual("Apply a search phrase to the ticket list", "把搜索词应用到工单列表"),
  kind: "read",
  params: [{ name: "text", label: "Search phrase", maxLength: 120 }],
  run: async (args) => { draft.value = String(args.text); applySearch(); return { matched: visible.value.length }; },
});

useAgentTool({
  id: "show_more_tickets",
  desc: bilingual("Render the next page of matching ticket rows", "渲染下一批匹配的工单行"),
  kind: "read",
  available: () => loaded.value < visible.value.length || bilingual("All matching rows are already rendered", "所有匹配行都已渲染"),
  run: () => { loaded.value = Math.min(visible.value.length, loaded.value + 30); return { loaded: loaded.value }; },
});
</script>

<template>
  <RecipeShell eyebrow="Recipe 07 · Bounded views" :title="bilingual('Send the current view, not the whole database', '发送当前视图，而不是整座数据库')" :description="bilingual('The page reports total, matched, and loaded counts. It renders only a bounded set of rows while applying search and status filters to the full local dataset.', '页面报告总数、匹配数与已加载数；在完整本地数据上应用搜索与状态筛选，但只渲染有界的一组行。')">
    <section class="panel" v-scope="{ id: 'tickets', label: bilingual('Support tickets', '支持工单'), description: bilingual('A bounded view of the filtered queue', '筛选队列的有界视图'), role: 'list' }">
      <div class="panel__head"><div><h2>{{ bilingual('Support queue', '支持队列') }}</h2><p>{{ visible.length }} {{ bilingual('matched', '匹配') }} · {{ Math.min(loaded, visible.length) }} {{ bilingual('rendered', '已渲染') }} · {{ tickets.length }} {{ bilingual('total', '总数') }}</p></div><span class="tag warn">{{ visible.filter((ticket) => ticket.priority === 'urgent').length }} urgent</span></div>
      <div class="controls"><input v-model="draft" class="search" :placeholder="bilingual('Search id, customer, or subject', '搜索编号、客户或主题')" @keydown.enter="applySearch" /><button class="button" type="button" @click="applySearch">{{ bilingual('Search', '搜索') }}</button><select v-model="status"><option value="all">{{ bilingual('All', '全部') }}</option><option value="open">{{ bilingual('Open', '处理中') }}</option><option value="waiting">{{ bilingual('Waiting', '等待中') }}</option><option value="closed">{{ bilingual('Closed', '已关闭') }}</option></select></div>
      <ul class="records">
        <li v-for="ticket in visible.slice(0, loaded)" :key="ticket.id" class="record" :class="{ 'is-muted': ticket.status === 'closed' }" v-record="{ data: ticket, label: ticket.id, fields: { customer: ticket.customer, subject: ticket.subject, priority: ticket.priority, status: ticket.status } }">
          <div class="record__main"><p class="record__title">{{ ticket.subject }} <span class="record__id">{{ ticket.id }}</span></p><p class="record__meta">{{ ticket.customer }} · {{ ticket.priority }} · {{ ticket.status }} · {{ new Date(ticket.updated).toLocaleString() }}</p></div>
          <div class="record__actions"><button v-if="ticket.status !== 'closed' && ticket.status !== 'waiting'" type="button" v-tool="{ id: `waiting@${ticket.id}`, desc: bilingual(`Mark ${ticket.id} as waiting`, `把 ${ticket.id} 标记为等待中`), kind: 'write' }" @click="review(ticket.id)">{{ bilingual('Wait for customer', '等待客户') }}</button><span v-else class="tag">{{ ticket.status }}</span></div>
        </li>
      </ul>
      <div class="list__footer" style="padding: 0 20px 20px"><span class="status">{{ Math.min(loaded, visible.length) }} / {{ visible.length }}</span><button v-if="loaded < visible.length" class="button" type="button" @click="loaded += 30">{{ bilingual('Show 30 more', '再显示 30 条') }}</button></div>
    </section>
    <AgentDock :title="bilingual('Support assistant', '支持助手')" :quick="zh ? ['筛选 Globex 的紧急工单', '找出发票相关工单并显示更多'] : ['Filter to urgent Globex tickets', 'Find invoice tickets and show more rows']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
