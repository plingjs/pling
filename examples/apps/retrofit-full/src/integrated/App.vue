<script setup lang="ts">
import { computed, ref } from "vue";
import {
  AgentDock,
  SurfaceAccessPanel,
  useAgentState,
  useAgentTool,
  useSurfaceGateway,
} from "@plingjs/vue";
import { copyFor, type DemoLocale } from "../shared/copy";
import { EXTERNAL_SCOPE } from "../shared/external-scope";
import {
  approveOrder,
  countOrders,
  createSeedOrders,
  formatMoney,
  removeOrder,
  reopenOrder,
  setOrderNote,
  visibleOrders,
  type Order,
  type OrderFilter,
} from "../shared/orders";

const props = defineProps<{ locale: DemoLocale }>();
const copy = computed(() => copyFor(props.locale));
const orders = ref<Order[]>(createSeedOrders(props.locale));
const search = ref("");
const filter = ref<OrderFilter>("all");
const selectedId = ref<string | null>(null);
const noteDraft = ref("");
const noteSaved = ref(false);
const toast = ref("");
const assistantOpen = ref(
  typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 981px)").matches,
);
const surfaceOpen = ref(false);

const counts = computed(() => countOrders(orders.value));
const shown = computed(() => visibleOrders(orders.value, filter.value, search.value));
const selected = computed(() => orders.value.find((order) => order.id === selectedId.value) ?? null);

const gatewayUrl = (
  import.meta.env.VITE_SURFACE_GATEWAY_URL?.trim() ||
  (["127.0.0.1", "localhost"].includes(location.hostname) ? "http://127.0.0.1:5219" : "https://surface.plingjs.com")
).replace(/\/$/, "");

const surfaceGateway = useSurfaceGateway({
  app: "retrofit-orders",
  expose: EXTERNAL_SCOPE,
  mode: "public-demo",
  gatewayUrl,
  autoConnect: false,
  surface: { recordLimit: 10 },
});

// [Retrofit 05] A compact read model for counts and the current slice.
useAgentState(
  "order_queue_view",
  () => ({
    filter: filter.value,
    search: search.value,
    shown: shown.value.length,
    total: counts.value.total,
    pending: counts.value.pending,
    approved: counts.value.approved,
    highRisk: counts.value.highRisk,
    selected: selectedId.value,
  }),
  { description: copy.value.scopeDescription },
);

// [Retrofit 06] One business operation, one tool. The agent does not have to
// open the dialog, fill a field, and click Save as three separate operations.
useAgentTool({
  id: "orders.set_note",
  desc: copy.value.setNoteDesc,
  kind: "write",
  params: [
    {
      name: "record",
      label: copy.value.setNoteRecordLabel,
      options: () => orders.value.map((order) => ({ value: order.id, label: `${order.id} · ${order.customer}` })),
    },
    { name: "note", label: copy.value.setNoteTextLabel, maxLength: 240, optional: true },
  ],
  run: ({ record, note }) => {
    const id = String(record);
    const order = orders.value.find((item) => item.id === id);
    if (!order) return { changed: false, reason: `Unknown order ${id}` };
    const nextNote = note === undefined || note === null ? "" : String(note);
    orders.value = setOrderNote(orders.value, id, nextNote);
    if (selectedId.value === id) {
      noteDraft.value = nextNote.trim().slice(0, 240);
      noteSaved.value = true;
    }
    toast.value = copy.value.noteSaved;
    return { changed: true, order: id, note: nextNote };
  },
});

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

function saveNote(): void {
  if (!selected.value) return;
  orders.value = setOrderNote(orders.value, selected.value.id, noteDraft.value);
  noteSaved.value = true;
  toast.value = copy.value.noteSaved;
}

function approve(order: Order): void {
  if (order.status === "approved") return;
  orders.value = approveOrder(orders.value, order.id);
  toast.value = copy.value.queueSaved;
}

function reopen(order: Order): void {
  orders.value = reopenOrder(orders.value, order.id);
  toast.value = copy.value.queueSaved;
}

function remove(order: Order): void {
  orders.value = removeOrder(orders.value, order.id);
  if (selectedId.value === order.id) closeOrder();
  toast.value = copy.value.queueSaved;
}

function orderIsApproved(id: string): boolean {
  return orders.value.find((order) => order.id === id)?.status === "approved";
}

function orderIsPending(id: string): boolean {
  return orders.value.find((order) => order.id === id)?.status === "pending";
}

function orderRemoved(id: string): boolean {
  return !orders.value.some((order) => order.id === id);
}
</script>

<template>
  <div class="app-shell" :class="{ 'has-assistant': assistantOpen }">
    <header class="topbar">
      <a class="brand" href="/">
        <span class="brand__mark" aria-hidden="true">N</span>
        <span class="brand__name">{{ copy.product }}</span>
        <span class="brand__note">{{ copy.productNote }}</span>
      </a>
      <div class="topbar__right">
        <button type="button" class="surface-trigger" @click="surfaceOpen = true">{{ copy.external }}</button>
        <span class="mode is-live">{{ copy.integratedBadge }}</span>
      </div>
    </header>

    <main>
      <section class="hero" aria-labelledby="page-title">
        <div>
          <p class="eyebrow">{{ copy.eyebrow }}</p>
          <h1 id="page-title">{{ copy.title }}</h1>
          <p>{{ copy.subtitle }}</p>
        </div>
        <div class="queue-mark" aria-live="polite">
          <strong>{{ counts.pending }}</strong>
          <span>{{ copy.pending }}</span>
        </div>
      </section>

      <section class="metrics" aria-label="Order metrics">
        <div class="metric"><span>{{ copy.pending }}</span><strong>{{ counts.pending }}</strong></div>
        <div class="metric"><span>{{ copy.approved }}</span><strong>{{ counts.approved }}</strong></div>
        <div class="metric is-risk"><span>{{ copy.highRisk }}</span><strong>{{ counts.highRisk }}</strong></div>
        <div class="metric"><span>{{ copy.queueValue }}</span><strong>{{ formatMoney(counts.value, props.locale) }}</strong></div>
      </section>

      <!-- [Retrofit 02] Regions describe the queue; they do not grant access. -->
      <section
        class="panel"
        aria-label="Order queue"
        v-scope="{ id: 'order_queue', label: copy.scopeLabel, description: copy.scopeDescription, role: 'main' }"
      >
        <div class="panel__toolbar">
          <label class="search">
            <span>{{ copy.searchLabel }}</span>
            <input
              v-model="search"
              type="search"
              :placeholder="copy.searchPlaceholder"
              v-tool="{ id: 'order_search', action: 'fill', kind: 'write', desc: copy.searchLabel }"
            />
          </label>
          <div class="filters" role="group" :aria-label="copy.filterLabel">
            <button
              type="button"
              :class="{ 'is-active': filter === 'all' }"
              v-tool="{ id: 'filter_all', kind: 'write', desc: copy.filterAll }"
              @click="setFilter('all')"
            >
              {{ copy.filterAll }}
            </button>
            <button
              type="button"
              :class="{ 'is-active': filter === 'pending' }"
              v-tool="{ id: 'filter_pending', kind: 'write', desc: copy.filterPending }"
              @click="setFilter('pending')"
            >
              {{ copy.filterPending }}
            </button>
            <button
              type="button"
              :class="{ 'is-active': filter === 'approved' }"
              v-tool="{ id: 'filter_approved', kind: 'write', desc: copy.filterApproved }"
              @click="setFilter('approved')"
            >
              {{ copy.filterApproved }}
            </button>
            <button
              type="button"
              :class="{ 'is-active': filter === 'high' }"
              v-tool="{ id: 'filter_high', kind: 'write', desc: copy.filterHigh }"
              @click="setFilter('high')"
            >
              {{ copy.filterHigh }}
            </button>
            <button
              type="button"
              class="reset"
              v-tool="{ id: 'reset_filters', kind: 'write', desc: copy.reset }"
              @click="resetFilters"
            >
              {{ copy.reset }}
            </button>
          </div>
        </div>

        <div class="list-meta">
          <span>{{ copy.count(shown.length, counts.total) }}</span>
          <span>{{ copy.tableLabels }}</span>
        </div>

        <p class="toast" role="status">{{ toast }}</p>

        <!-- [Retrofit 03] Each row is a record; actions are folded by record id. -->
        <div
          class="order-list"
          v-scope="{ id: 'order_records', label: copy.scopeLabel, description: copy.scopeDescription, role: 'list' }"
        >
          <article
            v-for="order in shown"
            :key="order.id"
            class="order-row"
            v-record="{
              data: order,
              id: order.id,
              label: `${order.id} · ${order.customer}`,
              fields: {
                customer: order.customer,
                amount: order.amount,
                status: copy.status(order.status),
                risk: copy.risk(order.risk),
                owner: order.owner,
                note: order.note,
              },
            }"
          >
            <div class="order-id"><strong>{{ order.id }}</strong><span>{{ order.customer }}</span></div>
            <div class="owner-note"><strong>{{ order.owner }}</strong><span>{{ order.note || copy.noNote }}</span></div>
            <div class="risk" :class="`is-${order.risk}`">
              <b>{{ formatMoney(order.amount, props.locale) }}</b>
              <span>{{ copy.risk(order.risk) }}</span>
            </div>
            <span class="status" :class="{ 'is-approved': order.status === 'approved' }">{{ copy.status(order.status) }}</span>
            <div class="actions">
              <button
                type="button"
                v-tool="{ id: `open_order@${order.id}`, kind: 'write', desc: copy.openDesc(order.id, order.customer) }"
                @click="openOrder(order)"
              >
                {{ copy.open }}
              </button>
              <button
                v-if="order.status === 'pending'"
                type="button"
                v-tool="{
                  id: `approve@${order.id}`,
                  kind: 'write',
                  desc: copy.approveDesc(order.id),
                  expect: { desc: copy.approveExpect, check: () => orderIsApproved(order.id) },
                }"
                @click="approve(order)"
              >
                {{ copy.approve }}
              </button>
              <button
                v-else
                type="button"
                v-tool="{
                  id: `reopen@${order.id}`,
                  kind: 'write',
                  desc: copy.reopenDesc(order.id),
                  expect: { desc: copy.reopenExpect, check: () => orderIsPending(order.id) },
                }"
                @click="reopen(order)"
              >
                {{ copy.reopen }}
              </button>
              <button
                type="button"
                class="danger"
                v-tool="{
                  id: `delete@${order.id}`,
                  kind: 'danger',
                  desc: copy.removeDesc(order.id),
                  expect: { desc: copy.removeExpect, check: () => orderRemoved(order.id) },
                }"
                @click="remove(order)"
              >
                {{ copy.remove }}
              </button>
            </div>
          </article>
        </div>

        <p v-if="shown.length === 0" class="empty">{{ copy.empty }}</p>
      </section>
    </main>

    <!-- [Retrofit 04] A dialog is its own region. Opening it should make the
         controls underneath unavailable, not invisible to the audit trail. -->
    <div v-if="selected" class="dialog-backdrop" @click.self="closeOrder">
      <section
        class="dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`order-title-${selected.id}`"
        v-scope="{ id: 'order_detail', label: copy.dialogScopeLabel, description: copy.dialogScopeDescription, role: 'dialog' }"
      >
        <header class="dialog__head">
          <div>
            <p>{{ copy.detailEyebrow }}</p>
            <h2 :id="`order-title-${selected.id}`">{{ selected.customer }}</h2>
          </div>
          <button
            type="button"
            class="dialog__close"
            v-tool="{ id: 'close_order', kind: 'write', desc: copy.closeDesc }"
            @click="closeOrder"
          >
            {{ copy.close }}
          </button>
        </header>

        <div class="dialog__facts">
          <div class="fact"><span>ID</span><strong>{{ selected.id }}</strong></div>
          <div class="fact"><span>{{ copy.amount }}</span><strong>{{ formatMoney(selected.amount, props.locale) }}</strong></div>
          <div class="fact"><span>{{ copy.owner }}</span><strong>{{ selected.owner }}</strong></div>
        </div>

        <div class="note-editor">
          <label :for="`note-${selected.id}`">{{ copy.note }}</label>
          <textarea
            :id="`note-${selected.id}`"
            v-model="noteDraft"
            class="note-field"
            :placeholder="copy.notePlaceholder"
            maxlength="240"
          ></textarea>
        </div>
        <div class="dialog__actions">
          <span class="dialog__saved">{{ noteSaved ? copy.noteSaved : '' }}</span>
          <button type="button" class="primary" @click="saveNote">{{ copy.saveNote }}</button>
        </div>
      </section>
    </div>

    <!-- [Retrofit 07] External access uses the same registry, narrowed again by
         an explicit allowlist. It is absent from this page until opened. -->
    <div v-if="surfaceOpen" class="surface-backdrop" @click.self="surfaceOpen = false">
      <aside class="surface-drawer" aria-label="External Agent access">
        <header class="surface-drawer__head">
          <h2>{{ copy.externalTitle }}</h2>
          <button type="button" @click="surfaceOpen = false">{{ copy.close }}</button>
        </header>
        <p class="surface-drawer__hint">{{ copy.externalHint }}</p>
        <SurfaceAccessPanel :gateway="surfaceGateway" />
      </aside>
    </div>

    <AgentDock
      layout="sidebar"
      sidebar-mode="overlay"
      side="right"
      :title="copy.dockTitle"
      :placeholder="copy.dockPlaceholder"
      :quick="copy.quick"
      :debug="{ maxCalls: 8 }"
      :default-open="assistantOpen"
      @open="assistantOpen = $event"
    />
  </div>
</template>
