<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import {
  AgentDock,
  useAgentState,
  useAgentTool,
  usePling,
} from "@plingjs/vue";
import {
  ORDERS,
  copyFor,
  type Copy,
  type Locale,
  type Order,
  type OrderStatus,
  type Plan,
} from "./copy";

type Filter = "all" | OrderStatus;

const pling = usePling();
const locale = ref<Locale>(initialLocale());
const copy = computed<Copy>(() => copyFor(locale.value));
const orders = ref<Order[]>(ORDERS.map((order) => ({ ...order })));
const customer = ref("");
const email = ref("");
const plan = ref<Plan>("starter");
const submitting = ref(false);
const submitError = ref<string | null>(null);
const lastCreatedId = ref<string | null>(null);
const filter = ref<Filter>("all");
const searchDraft = ref("");
const appliedSearch = ref("");
let sequence = 1018;

const detailId = new URLSearchParams(location.search).get("order");
const detailOrder = computed(() => orders.value.find((order) => order.id === detailId) ?? null);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invalidFields = computed(() => {
  const fields: string[] = [];
  if (customer.value.trim().length < 2) fields.push("customer");
  if (!emailPattern.test(email.value.trim())) fields.push("email");
  return fields;
});
const dirty = computed(() => Boolean(customer.value || email.value || plan.value !== "starter"));

const visibleOrders = computed(() => {
  const needle = appliedSearch.value.toLocaleLowerCase();
  return orders.value.filter((order) => {
    if (filter.value !== "all" && order.status !== filter.value) return false;
    return needle === "" || `${order.customer} ${order.id}`.toLocaleLowerCase().includes(needle);
  });
});
const openCount = computed(() => orders.value.filter((order) => order.status === "open").length);
const paidCount = computed(() => orders.value.length - openCount.value);

watchEffect(() => {
  document.documentElement.lang = locale.value === "zh" ? "zh-CN" : "en";
  document.title = `${copy.value.title} · Pling recipes`;
  pling.ui.setLocale(locale.value === "zh" ? "zh-CN" : "en-US");
  pling.registry.setPage({
    path: location.pathname,
    title: document.title,
    ...(detailId ? { params: { order: detailId } } : {}),
  });
});

useAgentState(
  "order_view",
  () => ({
    filter: filter.value,
    search: appliedSearch.value,
    matched: visibleOrders.value.length,
    total: orders.value.length,
    open: openCount.value,
    paid: paidCount.value,
  }),
  { description: "Read-only order view: applied filter/search, matching rows, and open/paid totals" },
);

useAgentState(
  "order_form",
  () => ({
    dirty: dirty.value,
    submitting: submitting.value,
    invalidFields: invalidFields.value,
    lastSaveFailed: submitError.value !== null,
  }),
  { description: "Order form status; customer values are not repeated in page state" },
);

function addOrder(input: { customer: string; email: string; plan: Plan }): Order {
  const order: Order = {
    id: `SO-${++sequence}`,
    customer: input.customer.trim(),
    email: input.email.trim(),
    amount: input.plan === "pro" ? 240 : 120,
    plan: input.plan,
    status: "open",
  };
  orders.value.unshift(order);
  return order;
}

async function createFromForm(): Promise<void> {
  if (invalidFields.value.length > 0) return;
  submitting.value = true;
  submitError.value = null;
  try {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const order = addOrder({ customer: customer.value, email: email.value, plan: plan.value });
    lastCreatedId.value = order.id;
    customer.value = "";
    email.value = "";
    plan.value = "starter";
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : String(error);
  } finally {
    submitting.value = false;
  }
}

function setStatus(id: string, status: OrderStatus): void {
  const order = orders.value.find((item) => item.id === id);
  if (order) order.status = status;
}

function removeOrder(id: string): void {
  orders.value = orders.value.filter((order) => order.id !== id);
}

function applySearch(): void {
  appliedSearch.value = searchDraft.value.trim();
}

function switchLocale(): void {
  locale.value = locale.value === "en" ? "zh" : "en";
}

function initialLocale(): Locale {
  return new URLSearchParams(location.search).get("lang")?.startsWith("zh") ? "zh" : "en";
}

useAgentTool({
  id: "create_order",
  desc: copy.value.createOrderDesc,
  kind: "write",
  params: [
    { name: "customer", label: copy.value.customerParam, minLength: 2, maxLength: 80 },
    { name: "email", label: copy.value.emailParam, pattern: emailPattern },
    { name: "plan", label: copy.value.planParam, values: ["starter", "pro"] },
  ],
  available: () => (submitting.value ? "An order is already being created" : true),
  run: async (args) => {
    submitting.value = true;
    submitError.value = null;
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const order = addOrder({
        customer: String(args.customer),
        email: String(args.email),
        plan: args.plan === "pro" ? "pro" : "starter",
      });
      lastCreatedId.value = order.id;
    } finally {
      submitting.value = false;
    }
  },
  expect: {
    desc: copy.value.createOrderExpect,
    check: () => orders.value.some((order) => order.id === lastCreatedId.value),
  },
});
</script>

<template>
  <main class="page">
    <header class="masthead">
      <div>
        <p class="eyebrow">Pling recipes · Vue 3</p>
        <h1>{{ copy.title }}</h1>
        <p class="lede">{{ copy.subtitle }}</p>
      </div>
      <div class="toolbar">
        <button class="chip" type="button" @click="switchLocale">{{ copy.switchLanguage }}</button>
      </div>
    </header>

    <section v-if="detailOrder" class="panel">
      <header class="panel__head">
        <div>
          <h2>{{ copy.detailTitle }}</h2>
          <p>{{ copy.order }} {{ detailOrder.id }}</p>
        </div>
        <a class="chip" href="./">{{ copy.back }}</a>
      </header>
      <div class="body details">
        <dl>
          <dt>{{ copy.customerLabel }}</dt><dd>{{ detailOrder.customer }}</dd>
          <dt>{{ copy.emailLabel }}</dt><dd>{{ detailOrder.email }}</dd>
          <dt>{{ copy.planLabel }}</dt><dd>{{ detailOrder.plan }}</dd>
          <dt>{{ copy.amount }}</dt><dd>{{ detailOrder.amount }}</dd>
          <dt>{{ copy.status }}</dt><dd>{{ detailOrder.status }}</dd>
        </dl>
      </div>
    </section>

    <div v-else class="grid">
      <section
        class="panel"
        v-scope="{ id: 'order_form', label: copy.formTitle, description: copy.formHint, role: 'form' }"
      >
        <header class="panel__head">
          <div>
            <h2>{{ copy.formTitle }}</h2>
            <p>{{ copy.formHint }}</p>
          </div>
        </header>
        <div class="body">
          <form class="form" @submit.prevent="createFromForm">
            <label class="field">
              <span>{{ copy.customer }}</span>
              <input v-model="customer" :aria-invalid="invalidFields.includes('customer')" autocomplete="organization" />
            </label>
            <label class="field">
              <span>{{ copy.email }}</span>
              <input v-model="email" type="email" :aria-invalid="invalidFields.includes('email')" autocomplete="email" />
            </label>
            <label class="field">
              <span>{{ copy.plan }}</span>
              <select v-model="plan">
                <option value="starter">{{ copy.starter }}</option>
                <option value="pro">{{ copy.pro }}</option>
              </select>
            </label>
            <div class="form__footer">
              <span v-if="submitError" class="status error">{{ submitError }}</span>
              <span v-else class="status">{{ dirty ? copy.formHint : "" }}</span>
              <button class="button primary" type="submit" :disabled="submitting || invalidFields.length > 0">
                {{ submitting ? copy.creating : copy.create }}
              </button>
            </div>
          </form>
          <p v-if="lastCreatedId" class="status ok">{{ copy.created(orders.find((o) => o.id === lastCreatedId)?.customer || "") }}</p>
          <details class="connection">
            <summary>{{ copy.connectionTitle }}</summary>
            <p class="hint">{{ copy.connectionHint }}</p>
          </details>
        </div>
      </section>

      <section
        class="panel"
        v-scope="{ id: 'orders', label: copy.listTitle, description: copy.listHint, role: 'list' }"
      >
        <header class="panel__head">
          <div>
            <h2>{{ copy.listTitle }}</h2>
            <p>{{ copy.counts(visibleOrders.length, orders.length, openCount, paidCount) }}</p>
          </div>
        </header>
        <div class="controls">
          <input
            v-model="searchDraft"
            class="search"
            :aria-label="copy.searchLabel"
            :placeholder="copy.searchPlaceholder"
            v-tool="{ id: 'search_text', action: 'fill', desc: copy.searchDesc, params: [{ name: 'text', label: copy.searchPlaceholder }] }"
          />
          <button class="button" type="button" v-tool="{ id: 'search_apply', desc: copy.applySearchDesc }" @click="applySearch">
            {{ copy.apply }}
          </button>
          <select
            v-model="filter"
            v-tool="{ id: 'filter_orders', action: 'select', desc: copy.filterDesc, params: [{ name: 'value', label: copy.filterDesc, values: ['all', 'open', 'paid'] }] }"
          >
            <option value="all">{{ copy.all }}</option>
            <option value="open">{{ copy.open }}</option>
            <option value="paid">{{ copy.paid }}</option>
          </select>
        </div>
        <ul class="orders">
          <li
            v-for="order in visibleOrders"
            :key="order.id"
            class="order"
            :class="{ 'is-paid': order.status === 'paid' }"
            v-record="{ data: order, fields: { customer: order.customer, amount: order.amount, plan: order.plan, status: order.status } }"
          >
            <div class="order__main">
              <p class="order__title">{{ order.customer }} <span class="order__id">{{ order.id }}</span></p>
              <p class="order__meta">{{ order.plan }} · {{ order.amount }} · {{ order.status }}</p>
            </div>
            <div class="order__actions">
              <a class="chip" :href="`?order=${order.id}`" :aria-label="`${copy.detailTitle}: ${order.id}`">{{ copy.detailTitle }}</a>
              <button
                type="button"
                v-if="order.status === 'open'"
                v-tool="{ id: `mark_paid@${order.id}`, desc: copy.markPaidDesc(order.id), kind: 'write' }"
                @click="setStatus(order.id, 'paid')"
              >
                {{ copy.markPaid }}
              </button>
              <button
                v-else
                type="button"
                v-tool="{ id: `mark_open@${order.id}`, desc: copy.markOpenDesc(order.id), kind: 'write' }"
                @click="setStatus(order.id, 'open')"
              >
                {{ copy.markOpen }}
              </button>
              <button
                class="remove"
                type="button"
                v-tool="{ id: `delete_order@${order.id}`, desc: copy.removeDesc(order.id), kind: 'danger', confirm: 'always' }"
                @click="removeOrder(order.id)"
              >
                {{ copy.remove }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="visibleOrders.length === 0" class="empty">{{ copy.empty }}</p>
        <footer class="list__footer">
          <span class="status">{{ copy.counts(visibleOrders.length, orders.length, openCount, paidCount) }}</span>
        </footer>
      </section>
    </div>

    <AgentDock
      :title="copy.listTitle"
      :quick="copy.quick"
      :debug="{ maxCalls: 8 }"
      :model-settings="{ mode: 'byok', persist: 'memory' }"
    />
  </main>
</template>
