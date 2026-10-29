<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type { ToolOptions } from "@plingjs/vue";
import type { FlowStep } from "@plingjs/core";
import type { DemoLocale } from "../locale";

const props = defineProps<{ locale: DemoLocale }>();

interface Order {
  id: string;
  customer: string;
  status: "open" | "done";
  note: string;
}

const copy = computed(() =>
  props.locale === "zh"
    ? {
        eyebrow: "订单工作台",
        heading: "订单备注",
        lead: "一次“改备注”包含多个固定步骤。把它声明成流程，模型只需调用一次。",
        filterAll: "全部",
        filterOpen: "待处理",
        lock: "锁定保存",
        unlock: "解锁保存",
        lockedHint: "演示恢复：保存暂时不可用。解锁后可以继续原流程。",
        columns: { order: "订单", customer: "客户", status: "状态", note: "备注", action: "操作" },
        status: { open: "待处理", done: "已完成" },
        edit: "编辑备注",
        empty: "当前筛选下没有订单。",
        editorTitle: "修改订单备注",
        editorLead: "保存会等待 250ms，模拟真实接口。",
        noteLabel: "备注内容",
        noteDesc: "输入新的订单备注。",
        save: "保存备注",
        cancel: "取消",
        saveDesc: "保存备注。保存完成后弹窗关闭，列表显示新备注。",
        saveExpect: "订单备注已更新，弹窗已关闭",
        filterAllDesc: "显示全部订单。",
        filterOpenDesc: "只显示待处理订单。",
        openDesc: (id: string) => `打开订单 ${id} 的备注编辑框。`,
        updateDesc: "把指定订单的备注改为新内容（回到全部 → 打开订单 → 填写 → 保存）。",
        orderParam: "订单号，例如 SO-1002",
        noteParam: "新的备注内容",
        stepFilter: "把筛选恢复到全部订单",
        stepOpen: "打开目标订单",
        stepFill: "填写新的备注",
        stepSave: "保存备注并等待列表更新",
      }
    : {
        eyebrow: "Order desk",
        heading: "Order notes",
        lead: "Changing a note is one business operation made of several fixed steps. A flow lets the model invoke it once.",
        filterAll: "All",
        filterOpen: "Open",
        lock: "Lock saving",
        unlock: "Unlock saving",
        lockedHint: "Recovery demo: saving is unavailable. Unlock it, then continue the same flow.",
        columns: { order: "Order", customer: "Customer", status: "Status", note: "Note", action: "Action" },
        status: { open: "Open", done: "Done" },
        edit: "Edit note",
        empty: "No orders match this filter.",
        editorTitle: "Edit the order note",
        editorLead: "Saving waits 250 ms to stand in for a real request.",
        noteLabel: "Note",
        noteDesc: "Enter the new order note.",
        save: "Save note",
        cancel: "Cancel",
        saveDesc: "Save the note. When the request settles, the editor closes and the list shows the new value.",
        saveExpect: "The order note is updated and the editor is closed",
        filterAllDesc: "Show every order.",
        filterOpenDesc: "Show only open orders.",
        openDesc: (id: string) => `Open the note editor for order ${id}.`,
        updateDesc: "Change one order's note (show all → open the order → fill → save).",
        orderParam: "Order id, for example SO-1002",
        noteParam: "The new note text",
        stepFilter: "Restore the All filter",
        stepOpen: "Open the target order",
        stepFill: "Fill in the new note",
        stepSave: "Save the note and wait for the list to update",
      },
);

const orders = ref<Order[]>([
  { id: "SO-1001", customer: "Northwind", status: "open", note: "Confirm delivery window" },
  { id: "SO-1002", customer: "Lakeside Studio", status: "open", note: "Send revised quote" },
  { id: "SO-1003", customer: "Mori Bakehouse", status: "done", note: "Invoice sent" },
  { id: "SO-1004", customer: "Aster Lab", status: "open", note: "Waiting for PO number" },
]);
const filter = ref<"all" | "open">("all");
const editingId = ref<string | null>(null);
const draftNote = ref("");
const saving = ref(false);
const locked = ref(false);
const statusText = ref("");
const lastSaved = ref<{ id: string; note: string } | null>(null);

const visibleOrders = computed(() => orders.value.filter((order) => filter.value === "all" || order.status === "open"));
const editingOrder = computed(() => orders.value.find((order) => order.id === editingId.value));

function setFilter(value: "all" | "open"): void {
  filter.value = value;
}

function openOrder(id: string): void {
  const order = orders.value.find((candidate) => candidate.id === id);
  if (!order) return;
  editingId.value = id;
  draftNote.value = order.note;
}

function closeEditor(): void {
  editingId.value = null;
  draftNote.value = "";
}

async function saveNote(): Promise<void> {
  const order = editingOrder.value;
  if (!order) return;
  saving.value = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, 250));
    order.note = draftNote.value.trim();
    lastSaved.value = { id: order.id, note: order.note };
    statusText.value = props.locale === "zh" ? `已保存 ${order.id} 的备注。` : `Saved the note on ${order.id}.`;
    closeEditor();
  } finally {
    saving.value = false;
  }
}

function toggleLock(): void {
  locked.value = !locked.value;
}

const allFilter = computed<ToolOptions>(() => ({
  id: "filter_all",
  desc: copy.value.filterAllDesc,
  action: "click",
  kind: "read",
  run: () => setFilter("all"),
}));

const openFilter = computed<ToolOptions>(() => ({
  id: "filter_open",
  desc: copy.value.filterOpenDesc,
  action: "click",
  kind: "read",
  run: () => setFilter("open"),
}));

const saveAction = computed<ToolOptions>(() => ({
  id: "save_note",
  desc: copy.value.saveDesc,
  action: "click",
  kind: "write",
  available: () => (locked.value ? (props.locale === "zh" ? "保存已被锁定；先解锁再继续。" : "Saving is locked. Unlock it before continuing.") : true),
  run: saveNote,
  expect: {
    desc: copy.value.saveExpect,
    check: () => {
      const saved = lastSaved.value;
      const order = saved ? orders.value.find((candidate) => candidate.id === saved.id) : undefined;
      return Boolean(order && order.note === saved?.note && editingId.value === null);
    },
    timeout: 2_000,
  },
}));

const updateNoteFlow = computed<ToolOptions>(() => {
  const steps: FlowStep[] = [
    { action: "filter_all", desc: copy.value.stepFilter },
    { action: "open_order@{{orderId}}", desc: copy.value.stepOpen },
    { action: "note_input", args: { text: "{{note}}" }, desc: copy.value.stepFill },
    { action: "save_note", desc: copy.value.stepSave, idempotent: true },
  ];
  return {
    id: "update_order_note",
    desc: copy.value.updateDesc,
    kind: "write",
    params: [
      { name: "orderId", label: copy.value.orderParam, options: () => orders.value.map((order) => order.id) },
      { name: "note", label: copy.value.noteParam, minLength: 1 },
    ],
    steps,
  };
});
</script>

<template>
  <section
    class="orders"
    v-scope="{
      id: 'orders',
      label: locale === 'zh' ? '订单工作台' : 'Order desk',
      description: locale === 'zh' ? '包含订单记录、筛选与备注编辑。' : 'Order records, filters, and a note editor.',
      role: 'main',
    }"
    v-tool="updateNoteFlow"
  >
    <header class="orders__head">
      <div>
        <p class="orders__eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.heading }}</h1>
        <p>{{ copy.lead }}</p>
      </div>
      <div class="orders__tools">
        <button type="button" :aria-pressed="filter === 'all'" v-tool="allFilter" @click="setFilter('all')">
          {{ copy.filterAll }}
        </button>
        <button type="button" :aria-pressed="filter === 'open'" v-tool="openFilter" @click="setFilter('open')">
          {{ copy.filterOpen }}
        </button>
        <button
          type="button"
          class="warning"
          :aria-pressed="locked"
          :title="copy.lockedHint"
          @click="toggleLock"
        >
          {{ locked ? copy.unlock : copy.lock }}
        </button>
      </div>
    </header>

    <table class="orders__table">
      <thead>
        <tr>
          <th>{{ copy.columns.order }}</th>
          <th>{{ copy.columns.customer }}</th>
          <th>{{ copy.columns.status }}</th>
          <th>{{ copy.columns.note }}</th>
          <th>{{ copy.columns.action }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="order in visibleOrders"
          :key="order.id"
          :data-order="order.id"
          v-record="{
            data: order,
            id: order.id,
            label: `Order ${order.id}`,
            fields: { customer: order.customer, status: order.status, note: order.note },
          }"
        >
          <td><strong>{{ order.id }}</strong></td>
          <td>{{ order.customer }}</td>
          <td>{{ copy.status[order.status] }}</td>
          <td class="orders__note">{{ order.note }}</td>
          <td>
            <button
              type="button"
              class="orders__button"
              v-tool="{
                id: `open_order@${order.id}`,
                desc: copy.openDesc(order.id),
                action: 'click',
                kind: 'read',
                run: () => openOrder(order.id),
              }"
              @click="openOrder(order.id)"
            >
              {{ copy.edit }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="visibleOrders.length === 0" class="orders__empty">{{ copy.empty }}</p>

    <div v-if="editingOrder" class="overlay" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <section class="editor" v-scope="{ id: 'note_editor', label: copy.editorTitle, role: 'dialog' }">
        <h2 id="editor-title">{{ copy.editorTitle }}</h2>
        <p>{{ editingOrder.id }} · {{ editingOrder.customer }}. {{ copy.editorLead }}</p>
        <label>
          <span>{{ copy.noteLabel }}</span>
          <input
            v-model="draftNote"
            data-pling-field="note"
            v-tool="{ id: 'note_input', action: 'fill', desc: copy.noteDesc }"
          />
        </label>
        <div class="editor__actions">
          <button type="button" class="orders__button" v-tool="{ id: 'close_note_editor', action: 'click', desc: 'Close the editor without saving.', kind: 'read', run: closeEditor }" @click="closeEditor">
            {{ copy.cancel }}
          </button>
          <button
            type="button"
            class="orders__button editor__primary"
            data-save-note
            v-tool="saveAction"
            :disabled="saving || locked"
            @click="saveNote"
          >
            {{ saving ? '…' : copy.save }}
          </button>
        </div>
      </section>
    </div>

    <p v-if="statusText" class="orders__empty" aria-live="polite">{{ statusText }}</p>
  </section>
</template>
