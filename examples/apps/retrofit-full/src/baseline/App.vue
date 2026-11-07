<script setup lang="ts">
import { computed, ref } from "vue";
import { copyFor, type DemoLocale } from "../shared/copy";
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

const counts = computed(() => countOrders(orders.value));
const shown = computed(() => visibleOrders(orders.value, filter.value, search.value));
const selected = computed(() => orders.value.find((order) => order.id === selectedId.value) ?? null);

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
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/baseline/">
        <span class="brand__mark" aria-hidden="true">N</span>
        <span class="brand__name">{{ copy.product }}</span>
        <span class="brand__note">{{ copy.productNote }}</span>
      </a>
      <span class="mode">{{ copy.baselineBadge }}</span>
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
        <div class="metric">
          <span>{{ copy.pending }}</span>
          <strong>{{ counts.pending }}</strong>
        </div>
        <div class="metric">
          <span>{{ copy.approved }}</span>
          <strong>{{ counts.approved }}</strong>
        </div>
        <div class="metric is-risk">
          <span>{{ copy.highRisk }}</span>
          <strong>{{ counts.highRisk }}</strong>
        </div>
        <div class="metric">
          <span>{{ copy.queueValue }}</span>
          <strong>{{ formatMoney(counts.value, props.locale) }}</strong>
        </div>
      </section>

      <section class="panel" aria-label="Order queue">
        <div class="panel__toolbar">
          <label class="search">
            <span>{{ copy.searchLabel }}</span>
            <input v-model="search" type="search" :placeholder="copy.searchPlaceholder" />
          </label>
          <div class="filters" role="group" :aria-label="copy.filterLabel">
            <button type="button" :class="{ 'is-active': filter === 'all' }" @click="setFilter('all')">{{ copy.filterAll }}</button>
            <button type="button" :class="{ 'is-active': filter === 'pending' }" @click="setFilter('pending')">{{ copy.filterPending }}</button>
            <button type="button" :class="{ 'is-active': filter === 'approved' }" @click="setFilter('approved')">{{ copy.filterApproved }}</button>
            <button type="button" :class="{ 'is-active': filter === 'high' }" @click="setFilter('high')">{{ copy.filterHigh }}</button>
            <button type="button" class="reset" @click="resetFilters">{{ copy.reset }}</button>
          </div>
        </div>

        <div class="list-meta">
          <span>{{ copy.count(shown.length, counts.total) }}</span>
          <span>{{ copy.tableLabels }}</span>
        </div>

        <p class="toast" role="status">{{ toast }}</p>

        <div class="order-list">
          <article v-for="order in shown" :key="order.id" class="order-row">
            <div class="order-id">
              <strong>{{ order.id }}</strong>
              <span>{{ order.customer }}</span>
            </div>
            <div class="owner-note">
              <strong>{{ order.owner }}</strong>
              <span>{{ order.note || copy.noNote }}</span>
            </div>
            <div class="risk" :class="`is-${order.risk}`">
              <b>{{ formatMoney(order.amount, props.locale) }}</b>
              <span>{{ copy.risk(order.risk) }}</span>
            </div>
            <span class="status" :class="{ 'is-approved': order.status === 'approved' }">{{ copy.status(order.status) }}</span>
            <div class="actions">
              <button type="button" @click="openOrder(order)">{{ copy.open }}</button>
              <button v-if="order.status === 'pending'" type="button" @click="approve(order)">{{ copy.approve }}</button>
              <button v-else type="button" @click="reopen(order)">{{ copy.reopen }}</button>
              <button type="button" class="danger" @click="remove(order)">{{ copy.remove }}</button>
            </div>
          </article>
        </div>

        <p v-if="shown.length === 0" class="empty">{{ copy.empty }}</p>
      </section>
    </main>

    <div v-if="selected" class="dialog-backdrop" @click.self="closeOrder">
      <section class="dialog" role="dialog" aria-modal="true" :aria-labelledby="`order-title-${selected.id}`">
        <header class="dialog__head">
          <div>
            <p>{{ copy.detailEyebrow }}</p>
            <h2 :id="`order-title-${selected.id}`">{{ selected.customer }}</h2>
          </div>
          <button type="button" class="dialog__close" @click="closeOrder">{{ copy.close }}</button>
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
  </div>
</template>
