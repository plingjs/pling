<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, usePling } from "@plingjs/vue";
import { copyFor, type DemoLocale, type OrderFilter, type OrderRisk, type OrderStatus } from "./copy";

const props = defineProps<{
  quick: readonly string[];
  locale: DemoLocale;
}>();

interface Order {
  id: string;
  customer: string;
  amount: number;
  status: OrderStatus;
  risk: OrderRisk;
  reviewed: boolean;
  owner: string;
  note: string;
}

const pling = usePling();
const copy = computed(() => copyFor(props.locale));
const search = ref("");
const filter = ref<OrderFilter>("all");
const sidebarOpen = ref(true);
const selectedId = ref<string | null>(null);
const noteDraft = ref("");
const noteSaved = ref(false);
const orders = ref<Order[]>([
  { id: "SO-2041", customer: "Acme", amount: 12800, status: "Pending", risk: "high", reviewed: false, owner: "林舟", note: "合同条款需要法务复核。" },
  { id: "SO-2042", customer: "Globex", amount: 4200, status: "Pending", risk: "medium", reviewed: false, owner: "周宁", note: "" },
  { id: "SO-2043", customer: "Hooli", amount: 930, status: "Pending", risk: "low", reviewed: true, owner: "陈澄", note: "已确认收货地址。" },
  { id: "SO-2044", customer: "Initech", amount: 7600, status: "Approved", risk: "medium", reviewed: true, owner: "周宁", note: "季度框架合同，已批准。" },
  { id: "SO-2045", customer: "Umbrella", amount: 15400, status: "Pending", risk: "high", reviewed: false, owner: "林舟", note: "等待客户补充付款主体。" },
]);

const visibleOrders = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return orders.value.filter((order) => {
    const matchesFilter =
      filter.value === "all" ||
      (filter.value === "pending" && order.status === "Pending") ||
      (filter.value === "approved" && order.status === "Approved") ||
      (filter.value === "high" && order.risk === "high");
    const matchesSearch =
      !needle ||
      [order.id, order.customer, order.status, order.risk, order.owner, order.note].some((value) =>
        value.toLowerCase().includes(needle),
      );
    return matchesFilter && matchesSearch;
  });
});
const pendingCount = computed(() => orders.value.filter((order) => order.status === "Pending").length);
const selectedOrder = computed(() => orders.value.find((order) => order.id === selectedId.value) ?? null);

const summaryPrompt = computed(() => copy.value.summaryPrompt);
const reviewPrompt = computed(() => copy.value.reviewPrompt);

function riskPrompt(order: Order): string {
  return copy.value.riskPrompt(order.id, order.customer);
}

function approve(order: Order): void {
  if (order.status === "Approved") return;
  order.status = "Approved";
  order.reviewed = true;
}

function setFilter(value: OrderFilter): void {
  filter.value = value;
}

function resetFilters(): void {
  filter.value = "all";
  search.value = "";
}

function openOrder(order: Order): void {
  selectedId.value = order.id;
  noteDraft.value = order.note;
  noteSaved.value = false;
}

function closeOrder(): void {
  selectedId.value = null;
  noteSaved.value = false;
}

function saveNote(order: Order): void {
  order.note = noteDraft.value.trim();
  noteSaved.value = true;
}

function askRisk(order: Order): void {
  void pling.ask(riskPrompt(order)).catch(() => {
    // The framework reports missing surfaces through onWarn; the demo keeps the click safe.
  });
}
</script>

<template>
  <div class="workbench" :class="{ 'is-sidebar-closed': !sidebarOpen }">
    <section class="queue" aria-labelledby="queue-title">
      <header class="queue__head">
        <div>
          <p class="queue__eyebrow">{{ copy.eyebrow }}</p>
          <h2 id="queue-title">{{ copy.title }}</h2>
          <p class="queue__meta">
            {{ copy.pendingTotal(pendingCount, orders.length) }} · {{ copy.filteredTotal(visibleOrders.length, orders.length) }}
          </p>
          <p class="queue__hint">{{ copy.hint }}</p>
        </div>
        <div class="smart-actions" :aria-label="copy.smartActions">
          <button id="summary-task" type="button" class="smart" v-task="summaryPrompt">
            <span aria-hidden="true">✦</span> {{ copy.summarize }}
          </button>
          <button id="review-task" type="button" class="smart" v-task="reviewPrompt">
            <span aria-hidden="true">✦</span> {{ copy.triage }}
          </button>
          <button
            id="approve-risk-task"
            type="button"
            class="smart"
            v-task="copy.approveHighestPrompt"
          >
            <span aria-hidden="true">✦</span> {{ copy.approveHighest }}
          </button>
        </div>
      </header>

      <label class="search">
        <span>{{ copy.searchLabel }}</span>
        <input
          id="order-search"
          v-model="search"
          type="search"
          :placeholder="copy.searchPlaceholder"
          v-tool="{ id: 'order_search', action: 'fill', desc: copy.searchDesc }"
        />
      </label>

      <div class="queue__filters" role="group" :aria-label="copy.filters">
        <button
          type="button"
          :class="{ 'is-active': filter === 'all' }"
          v-tool="{ id: 'filter_orders_all', kind: 'read', desc: copy.filterAll }"
          @click="setFilter('all')"
        >
          {{ copy.filterAll }}
        </button>
        <button
          type="button"
          :class="{ 'is-active': filter === 'pending' }"
          v-tool="{ id: 'filter_orders_pending', kind: 'read', desc: copy.filterPending }"
          @click="setFilter('pending')"
        >
          {{ copy.filterPending }}
        </button>
        <button
          type="button"
          :class="{ 'is-active': filter === 'approved' }"
          v-tool="{ id: 'filter_orders_approved', kind: 'read', desc: copy.filterApproved }"
          @click="setFilter('approved')"
        >
          {{ copy.filterApproved }}
        </button>
        <button
          type="button"
          :class="{ 'is-active': filter === 'high' }"
          v-tool="{ id: 'filter_orders_high', kind: 'read', desc: copy.filterHigh }"
          @click="setFilter('high')"
        >
          {{ copy.filterHigh }}
        </button>
        <button
          type="button"
          class="queue__reset"
          :disabled="filter === 'all' && search.trim() === ''"
          v-tool="{ id: 'reset_order_filters', kind: 'read', desc: copy.resetFilter }"
          @click="resetFilters"
        >
          {{ copy.resetFilter }}
        </button>
      </div>

      <section
        id="order-list"
        v-scope="{ id: 'order_queue', label: copy.scopeLabel, description: copy.scopeDescription, role: 'list' }"
        class="order-list"
      >
        <article
          v-for="order in visibleOrders"
          :key="order.id"
          class="order-card"
          :class="{ 'is-high': order.risk === 'high', 'is-approved': order.status === 'Approved' }"
          :data-order="order.id"
          v-record="{ data: order, label: `${order.id} · ${order.customer}`, fields: { customer: order.customer, amount: order.amount, status: order.status, risk: order.risk, reviewed: order.reviewed } }"
        >
          <div class="order-card__main">
            <div class="order-card__identity">
              <strong>{{ order.id }}</strong>
              <span>{{ order.customer }}</span>
            </div>
            <div class="order-card__facts">
              <span class="amount">¥{{ order.amount.toLocaleString("en-US") }}</span>
              <span class="pill" :class="`risk-${order.risk}`">{{ copy.riskLabel(order.risk) }}</span>
              <span class="pill" :class="{ approved: order.status === 'Approved' }">{{ copy.statusLabel(order.status) }}</span>
            </div>
          </div>

          <div class="order-card__actions">
            <button
              :id="`risk-task-${order.id}`"
              type="button"
              class="smart smart--small"
              v-task="{ prompt: riskPrompt(order) }"
            >
              ✦ {{ copy.explainRisk }}
            </button>
            <button :id="`ask-risk-${order.id}`" type="button" class="link" @click="askRisk(order)">
              {{ copy.askInChat }}
            </button>
            <button
              :id="`open-${order.id}`"
              type="button"
              class="link"
              v-tool="{ id: `open_order@${order.id}`, kind: 'read', desc: copy.openOrderDesc(order.id, order.customer) }"
              @click="openOrder(order)"
            >
              {{ copy.openOrder }}
            </button>
            <button
              :id="`approve-${order.id}`"
              type="button"
              class="approve"
              :disabled="order.status === 'Approved'"
              v-tool="{ id: `approve@${order.id}`, kind: 'danger', confirm: true, desc: copy.approveDesc(order.id, order.customer) }"
              @click="approve(order)"
            >
              {{ copy.approve }}
            </button>
          </div>
        </article>

        <p v-if="visibleOrders.length === 0" class="empty">{{ copy.empty }}</p>
      </section>
    </section>

    <aside
      v-if="selectedOrder"
      class="order-detail"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`order-detail-${selectedOrder.id}`"
      v-scope="{ id: 'order_detail', label: copy.detailEyebrow, description: copy.detailNote, role: 'dialog' }"
    >
      <header class="order-detail__head">
        <div>
          <p class="queue__eyebrow">{{ copy.detailEyebrow }}</p>
          <h2 :id="`order-detail-${selectedOrder.id}`">{{ selectedOrder.id }} · {{ selectedOrder.customer }}</h2>
        </div>
        <button
          type="button"
          class="order-detail__close"
          v-tool="{ id: 'close_order_detail', kind: 'read', desc: copy.closeDetailsDesc }"
          @click="closeOrder"
        >
          {{ copy.closeDetails }}
        </button>
      </header>
      <dl class="order-detail__facts">
        <div><dt>{{ copy.detailOwner }}</dt><dd>{{ selectedOrder.owner }}</dd></div>
        <div><dt>{{ copy.riskLabel(selectedOrder.risk) }}</dt><dd>¥{{ selectedOrder.amount.toLocaleString("en-US") }}</dd></div>
        <div><dt>{{ copy.filterPending }}</dt><dd>{{ copy.statusLabel(selectedOrder.status) }}</dd></div>
      </dl>
      <label class="order-detail__note">
        <span>{{ copy.detailNote }}</span>
        <textarea
          v-model="noteDraft"
          rows="5"
          :placeholder="copy.detailNotePlaceholder"
          v-tool="{ id: `order_note@${selectedOrder.id}`, action: 'fill', desc: copy.noteDesc(selectedOrder.id) }"
        ></textarea>
      </label>
      <div class="order-detail__actions">
        <span v-if="noteSaved" class="saved">{{ copy.saved }}</span>
        <button
          type="button"
          class="detail-save"
          v-tool="{ id: `save_order_note@${selectedOrder.id}`, kind: 'write', desc: copy.saveNoteDesc(selectedOrder.id) }"
          @click="saveNote(selectedOrder)"
        >
          {{ copy.saveNote }}
        </button>
      </div>
    </aside>

    <AgentDock
      class="order-sidebar"
      layout="sidebar"
      side="right"
      :title="copy.dockTitle"
      :placeholder="copy.dockPlaceholder"
      default-open
      :quick="props.quick"
      @open="sidebarOpen = $event"
    />
  </div>
</template>

<style scoped>
.workbench {
  --demo-sidebar-width: min(400px, 44vw);
  max-width: 1120px;
  margin: 0 auto;
  padding-right: calc(var(--demo-sidebar-width) + 16px);
  transition: padding-right 180ms ease;
}
.workbench.is-sidebar-closed {
  padding-right: 0;
}
.queue {
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 44px rgb(15 23 42 / 7%);
}
.queue {
  padding: 20px;
}
.queue__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.queue__eyebrow {
  margin: 0 0 4px;
  color: #2e9df7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.queue h2 {
  margin: 0;
  font-size: 24px;
}
.queue__meta {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}
.queue__hint {
  margin: 7px 0 0;
  color: #0b6db7;
  font-size: 12px;
}
.smart-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.smart,
.approve,
.link {
  border-radius: 9px;
  cursor: pointer;
}
.smart {
  padding: 8px 12px;
  border: 1px solid #a7d6fb;
  background: linear-gradient(180deg, #f7fbff, #eaf6ff);
  color: #0b6db7;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 14px rgb(46 157 247 / 10%);
}
.smart:hover {
  border-color: #2e9df7;
  background: #e2f2ff;
}
.smart--small {
  padding: 5px 9px;
  font-size: 12px;
}
.search {
  display: grid;
  gap: 6px;
  margin: 20px 0 14px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
.search input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 400;
}
.search input:focus {
  border-color: #2e9df7;
  outline: 3px solid rgb(46 157 247 / 16%);
}
.queue__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 14px;
}
.queue__filters button {
  padding: 5px 9px;
  border: 1px solid #dbe6f2;
  border-radius: 999px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}
.queue__filters button.is-active {
  border-color: #a7d6fb;
  background: #eaf6ff;
  color: #0b6db7;
  font-weight: 650;
}
.queue__filters .queue__reset {
  margin-left: auto;
  border-color: transparent;
  background: transparent;
  color: #0b6db7;
}
.queue__filters button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}
.order-list {
  display: grid;
  gap: 10px;
}
.order-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #cbd5e1;
  border-radius: 12px;
  background: #fff;
}
.order-card.is-high {
  border-left-color: #f97316;
}
.order-card.is-approved {
  background: #f8fafc;
}
.order-card__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.order-card__identity {
  display: grid;
  gap: 3px;
}
.order-card__identity strong {
  font-size: 15px;
}
.order-card__identity span {
  color: #64748b;
  font-size: 13px;
}
.order-card__facts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  align-items: center;
}
.amount {
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}
.pill {
  padding: 3px 7px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  text-transform: capitalize;
  white-space: nowrap;
}
.pill.risk-high {
  background: #fff1e8;
  color: #c2410c;
}
.pill.risk-medium {
  background: #fffbeb;
  color: #a16207;
}
.pill.risk-low {
  background: #f0fdf4;
  color: #15803d;
}
.pill.approved {
  background: #eaf6ff;
  color: #0b6db7;
}
.order-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}
.approve {
  margin-left: auto;
  padding: 6px 10px;
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
  font-size: 12px;
}
.approve:disabled {
  border-color: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
}
.link {
  padding: 4px 2px;
  border: 0;
  background: none;
  color: #0b6db7;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.empty {
  margin: 18px 0;
  color: #94a3b8;
  text-align: center;
}
.order-sidebar {
  --pling-sidebar-width: var(--demo-sidebar-width);
}
.order-detail {
  position: fixed;
  top: 24px;
  right: calc(min(400px, 44vw) + 32px);
  z-index: 30;
  width: min(380px, calc(100vw - 48px));
  padding: 20px;
  border: 1px solid #dbe6f2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px rgb(15 23 42 / 20%);
}
.order-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.order-detail h2 {
  margin: 0;
  font-size: 20px;
}
.order-detail__close {
  padding: 4px 2px;
  border: 0;
  background: none;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}
.order-detail__facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 18px 0;
}
.order-detail__facts div {
  padding: 10px;
  border-radius: 10px;
  background: #f8fbfe;
}
.order-detail__facts dt {
  color: #64748b;
  font-size: 11px;
}
.order-detail__facts dd {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 650;
}
.order-detail__note {
  display: grid;
  gap: 6px;
  color: #475569;
  font-size: 12px;
  font-weight: 650;
}
.order-detail__note textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  color: #0f172a;
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  resize: vertical;
}
.order-detail__note textarea:focus {
  border-color: #2e9df7;
  outline: 3px solid rgb(46 157 247 / 16%);
}
.order-detail__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}
.detail-save {
  padding: 7px 12px;
  border: 0;
  border-radius: 9px;
  background: #1273cf;
  color: #fff;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.saved {
  color: #15803d;
  font-size: 12px;
}
@media (max-width: 640px) {
  .queue__head,
  .order-card__main {
    flex-direction: column;
  }
  .smart-actions,
  .order-card__facts {
    justify-content: flex-start;
  }
  .approve {
    margin-left: 0;
  }
}
@media (max-width: 720px) {
  .workbench {
    padding-right: 0;
  }
  .order-detail {
    right: 14px;
  }
}
</style>
