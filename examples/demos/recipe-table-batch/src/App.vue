<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Order { id: string; customer: string; amount: number; region: string; status: "open" | "approved" | "rejected" }

const zh = resolveLocale() === "zh";
const orders = ref<Order[]>([
  { id: "SO-1042", customer: "Northwind", amount: 4800, region: "East", status: "open" },
  { id: "SO-1043", customer: "Globex", amount: 12600, region: "North", status: "open" },
  { id: "SO-1044", customer: "Initech", amount: 3100, region: "West", status: "open" },
  { id: "SO-1045", customer: "Umbrella", amount: 9200, region: "South", status: "open" },
  { id: "SO-1046", customer: "Acme", amount: 6500, region: "East", status: "open" },
  { id: "SO-1047", customer: "Hooli", amount: 7300, region: "West", status: "open" },
  { id: "SO-1048", customer: "Soylent", amount: 2800, region: "North", status: "open" },
  { id: "SO-1049", customer: "Vandelay", amount: 5700, region: "South", status: "approved" },
]);
const selected = ref<string[]>([]);
const lastBatch = ref("");
const filter = ref<"all" | "open" | "approved">("all");
const visible = computed(() => orders.value.filter((order) => filter.value === "all" || order.status === filter.value));
const openCount = computed(() => orders.value.filter((order) => order.status === "open").length);
const selectedOpen = computed(() => selected.value.filter((id) => orders.value.find((order) => order.id === id)?.status === "open").length);

function toggle(id: string): void {
  selected.value = selected.value.includes(id) ? selected.value.filter((value) => value !== id) : [...selected.value, id];
}

function setStatus(ids: readonly string[], status: Order["status"]): number {
  const valid = new Set(ids);
  let changed = 0;
  orders.value = orders.value.map((order) => {
    if (!valid.has(order.id) || order.status !== "open") return order;
    changed += 1;
    return { ...order, status };
  });
  selected.value = [];
  lastBatch.value = `${status}: ${changed}`;
  return changed;
}

function approveVisible(): number {
  return setStatus(visible.value.filter((order) => order.status === "open").map((order) => order.id), "approved");
}

useAgentState("order_selection", () => ({
  selected: selected.value,
  selectedOpen: selectedOpen.value,
  visible: visible.value.length,
  open: openCount.value,
  filter: filter.value,
  lastBatch: lastBatch.value || null,
}), { description: "Selected order ids, visible/open counts, current filter, and last batch result" });

useAgentTool({
  id: "approve_selected_orders",
  desc: bilingual("Approve all selected open orders; stale ids are ignored", "批量通过所有已选且仍处于待处理的订单；失效 id 会被忽略"),
  kind: "write",
  params: [{ name: "ids", label: "Comma-separated order ids", maxLength: 300 }],
  available: () => selected.value.length > 0 || bilingual("Select at least one order first", "请先选中至少一笔订单"),
  run: async (args) => {
    const fromArgs = String(args.ids).split(",").map((value) => value.trim()).filter(Boolean);
    const ids = fromArgs.length > 0 ? fromArgs : selected.value;
    return { changed: setStatus(ids, "approved"), ids };
  },
  expect: { desc: bilingual("Selected rows leave the open queue", "所选订单离开待处理队列"), check: () => selected.value.length === 0 },
});

useAgentTool({
  id: "approve_visible_orders",
  desc: bilingual("Approve every open order in the current filtered view", "通过当前筛选视图中的所有待处理订单"),
  kind: "write",
  available: () => visible.value.some((order) => order.status === "open") || bilingual("There are no open rows in this view", "当前视图没有待处理订单"),
  run: () => ({ changed: approveVisible() }),
});
</script>

<template>
  <RecipeShell eyebrow="Recipe 02 · Collections" :title="bilingual('Rows have identity; batches have a boundary', '行有身份，批量有边界')" :description="bilingual('Select a few orders, act on them as a set, and see why stale ids do not become accidental approvals after the list changes.', '选中多笔订单作为一个集合操作，并观察列表变化后旧 id 为什么不会变成误通过。')">
    <template #actions>
      <span class="tag">{{ selected.length }} {{ bilingual('selected', '已选') }}</span>
      <button class="button primary" type="button" :disabled="selectedOpen === 0" @click="setStatus(selected, 'approved')">{{ bilingual('Approve selected', '通过所选') }}</button>
    </template>
    <section class="panel">
      <div class="panel__head"><div><h2>{{ bilingual('Order review queue', '订单审核队列') }}</h2><p>{{ visible.length }} {{ bilingual('visible', '可见') }} · {{ openCount }} {{ bilingual('open', '待处理') }}</p></div>
        <div class="tabs"><button :class="{ 'is-active': filter === 'all' }" @click="filter = 'all'">{{ bilingual('All', '全部') }}</button><button :class="{ 'is-active': filter === 'open' }" @click="filter = 'open'">{{ bilingual('Open', '待处理') }}</button><button :class="{ 'is-active': filter === 'approved' }" @click="filter = 'approved'">{{ bilingual('Approved', '已通过') }}</button></div>
      </div>
      <ul class="records" v-scope="{ id: 'orders', label: bilingual('Order rows', '订单行'), description: bilingual('Each row has a stable identity and row actions', '每行有稳定身份与行内动作'), role: 'list' }">
        <li v-for="order in visible" :key="order.id" class="record" :class="{ 'is-selected': selected.includes(order.id), 'is-muted': order.status !== 'open' }" v-record="{ data: order, label: order.id, fields: { customer: order.customer, amount: order.amount, region: order.region, status: order.status } }">
          <div class="check-row">
            <input type="checkbox" :checked="selected.includes(order.id)" :aria-label="`Select ${order.id}`" @change="toggle(order.id)" />
            <div class="record__main"><p class="record__title">{{ order.customer }} <span class="record__id">{{ order.id }}</span></p><p class="record__meta">¥{{ order.amount.toLocaleString() }} · {{ order.region }} · {{ order.status }}</p></div>
          </div>
          <div class="record__actions">
            <button v-if="order.status === 'open'" type="button" v-tool="{ id: `approve@${order.id}`, desc: bilingual(`Approve ${order.id}`, `通过订单 ${order.id}`), kind: 'write' }" @click="setStatus([order.id], 'approved')">{{ bilingual('Approve', '通过') }}</button>
            <button v-if="order.status === 'open'" class="danger" type="button" v-tool="{ id: `reject@${order.id}`, desc: bilingual(`Reject ${order.id}`, `驳回订单 ${order.id}`), kind: 'write' }" @click="setStatus([order.id], 'rejected')">{{ bilingual('Reject', '驳回') }}</button>
            <span v-else class="tag">{{ order.status }}</span>
          </div>
        </li>
      </ul>
      <p v-if="lastBatch" class="notice">{{ bilingual('Last batch', '上次批量') }}: {{ lastBatch }} · {{ bilingual('the selection was cleared', '选择已清空') }}</p>
    </section>
    <AgentDock :title="bilingual('Order assistant', '订单助手')" :quick="zh ? ['选中 SO-1042 和 SO-1043 后通过', '通过当前筛选里的待处理订单'] : ['Select SO-1042 and SO-1043, then approve them', 'Approve the open rows in the current filter']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
