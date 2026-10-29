import { useMemo, useRef, useState, type Ref } from "react";
import type { FlowStep } from "@plingjs/core";
import {
  usePlingRecord,
  usePlingScope,
  usePlingTool,
} from "@plingjs/react";
import type { DemoLocale } from "../locale";

interface Order {
  id: string;
  customer: string;
  status: "open" | "done";
  note: string;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    }
  };
}

const INITIAL_ORDERS: Order[] = [
  { id: "SO-1001", customer: "Northwind", status: "open", note: "Confirm delivery window" },
  { id: "SO-1002", customer: "Lakeside Studio", status: "open", note: "Send revised quote" },
  { id: "SO-1003", customer: "Mori Bakehouse", status: "done", note: "Invoice sent" },
  { id: "SO-1004", customer: "Aster Lab", status: "open", note: "Waiting for PO number" },
];

const COPY = {
  en: {
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
    regionLabel: "Order desk",
    regionDescription: "Order records, filters, and a note editor.",
    editorDescription: "Edit one order's note without changing the rest of the list.",
    saved: (id: string) => `Saved the note on ${id}.`,
  },
  zh: {
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
    regionLabel: "订单工作台",
    regionDescription: "包含订单记录、筛选与备注编辑。",
    editorDescription: "修改一张订单的备注，页面其他部分在弹窗打开时不参与操作。",
    saved: (id: string) => `已保存 ${id} 的备注。`,
  },
} as const;

function OrderRow({
  order,
  copy,
  onOpen,
}: {
  order: Order;
  copy: (typeof COPY)[DemoLocale];
  onOpen: (id: string) => void;
}) {
  const rowRef = usePlingRecord<HTMLTableRowElement>({
    data: order,
    id: order.id,
    label: `Order ${order.id}`,
    fields: { customer: order.customer, status: order.status, note: order.note },
  });
  const openRef = usePlingTool<HTMLButtonElement>({
    id: `open_order@${order.id}`,
    desc: copy.openDesc(order.id),
    action: "click",
    kind: "read",
    run: () => onOpen(order.id),
  });

  return (
    <tr ref={rowRef} data-order={order.id}>
      <td><strong>{order.id}</strong></td>
      <td>{order.customer}</td>
      <td>{copy.status[order.status]}</td>
      <td className="orders__note">{order.note}</td>
      <td>
        <button ref={openRef} type="button" className="orders__button" onClick={() => onOpen(order.id)}>
          {copy.edit}
        </button>
      </td>
    </tr>
  );
}

export function OrderFlowPanel({ locale }: { locale: DemoLocale }) {
  const copy = COPY[locale];
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [filter, setFilter] = useState<"all" | "open">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [statusText, setStatusText] = useState("");
  const editingIdRef = useRef(editingId);
  const lastSavedRef = useRef<{ id: string; note: string } | null>(null);
  editingIdRef.current = editingId;

  const editingOrder = orders.find((order) => order.id === editingId);
  const visibleOrders = orders.filter((order) => filter === "all" || order.status === "open");

  function openOrder(id: string): void {
    const order = orders.find((candidate) => candidate.id === id);
    if (!order) return;
    setEditingId(id);
    setDraftNote(order.note);
  }

  function closeEditor(): void {
    setEditingId(null);
    setDraftNote("");
  }

  async function saveNote(): Promise<void> {
    const order = orders.find((candidate) => candidate.id === editingIdRef.current);
    if (!order) return;
    const note = draftNote.trim();
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      setOrders((current) => current.map((candidate) => (
        candidate.id === order.id ? { ...candidate, note } : candidate
      )));
      lastSavedRef.current = { id: order.id, note };
      setStatusText(copy.saved(order.id));
      setEditingId(null);
      setDraftNote("");
    } finally {
      setSaving(false);
    }
  }

  const scopeRef = usePlingScope<HTMLElement>({
    id: "orders",
    label: copy.regionLabel,
    description: copy.regionDescription,
    role: "main",
  });
  const allFilterRef = usePlingTool<HTMLButtonElement>({
    id: "filter_all",
    desc: copy.filterAllDesc,
    action: "click",
    kind: "read",
    run: () => setFilter("all"),
  });
  const openFilterRef = usePlingTool<HTMLButtonElement>({
    id: "filter_open",
    desc: copy.filterOpenDesc,
    action: "click",
    kind: "read",
    run: () => setFilter("open"),
  });
  const steps: readonly FlowStep[] = [
    { action: "filter_all", desc: copy.stepFilter },
    { action: "open_order@{{orderId}}", desc: copy.stepOpen },
    { action: "note_input", args: { text: "{{note}}" }, desc: copy.stepFill },
    { action: "save_note", desc: copy.stepSave, idempotent: true },
  ];
  const flowRef = usePlingTool<HTMLElement>({
    id: "update_order_note",
    desc: copy.updateDesc,
    kind: "write",
    params: [
      { name: "orderId", label: copy.orderParam, options: () => orders.map((order) => order.id) },
      { name: "note", label: copy.noteParam, minLength: 1 },
    ],
    steps,
  });
  const panelRef = useMemo(() => mergeRefs(scopeRef, flowRef), [scopeRef, flowRef]);

  return (
    <section className="orders" ref={panelRef}>
      <header className="orders__head">
        <div>
          <p className="orders__eyebrow">{copy.eyebrow}</p>
          <h1>{copy.heading}</h1>
          <p>{copy.lead}</p>
        </div>
        <div className="orders__tools">
          <button ref={allFilterRef} type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            {copy.filterAll}
          </button>
          <button ref={openFilterRef} type="button" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>
            {copy.filterOpen}
          </button>
          <button
            type="button"
            className="warning"
            aria-pressed={locked}
            title={copy.lockedHint}
            onClick={() => setLocked((value) => !value)}
          >
            {locked ? copy.unlock : copy.lock}
          </button>
        </div>
      </header>

      <table className="orders__table">
        <thead>
          <tr>
            <th>{copy.columns.order}</th>
            <th>{copy.columns.customer}</th>
            <th>{copy.columns.status}</th>
            <th>{copy.columns.note}</th>
            <th>{copy.columns.action}</th>
          </tr>
        </thead>
        <tbody>
          {visibleOrders.map((order) => (
            <OrderRow key={order.id} order={order} copy={copy} onOpen={openOrder} />
          ))}
        </tbody>
      </table>
      {visibleOrders.length === 0 ? <p className="orders__empty">{copy.empty}</p> : null}
      {statusText ? <p className="orders__status" aria-live="polite">{statusText}</p> : null}

      {editingOrder ? (
        <NoteEditor
          order={editingOrder}
          copy={copy}
          draftNote={draftNote}
          saving={saving}
          locked={locked}
          lastSaved={lastSavedRef}
          onDraft={setDraftNote}
          onClose={closeEditor}
          onSave={saveNote}
        />
      ) : null}
    </section>
  );
}

function NoteEditor({
  order,
  copy,
  draftNote,
  saving,
  locked,
  lastSaved,
  onDraft,
  onClose,
  onSave,
}: {
  order: Order;
  copy: (typeof COPY)[DemoLocale];
  draftNote: string;
  saving: boolean;
  locked: boolean;
  lastSaved: { current: { id: string; note: string } | null };
  onDraft: (value: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const scopeRef = usePlingScope<HTMLElement>({
    id: "note_editor",
    label: copy.editorTitle,
    description: copy.editorDescription,
    role: "dialog",
  });
  const inputRef = usePlingTool<HTMLInputElement>({
    id: "note_input",
    action: "fill",
    desc: copy.noteDesc,
  });
  const closeRef = usePlingTool<HTMLButtonElement>({
    id: "close_note_editor",
    action: "click",
    desc: "Close the editor without saving.",
    kind: "read",
    run: onClose,
  });
  const saveRef = usePlingTool<HTMLButtonElement>({
    id: "save_note",
    action: "click",
    desc: copy.saveDesc,
    kind: "write",
    available: () => locked ? (copy === COPY.zh ? "保存已被锁定；先解锁再继续。" : "Saving is locked. Unlock it before continuing.") : true,
    run: onSave,
    expect: {
      desc: copy.saveExpect,
      timeout: 2_000,
      check: () => {
        const saved = lastSaved.current;
        const cell = document.querySelector(`[data-order="${order.id}"] .orders__note`);
        return Boolean(saved && saved.id === order.id && cell?.textContent === saved.note && !document.querySelector(".overlay"));
      },
    },
  });

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <section className="editor" ref={scopeRef}>
        <h2 id="editor-title">{copy.editorTitle}</h2>
        <p>{order.id} · {order.customer}. {copy.editorLead}</p>
        <label>
          <span>{copy.noteLabel}</span>
          <input
            ref={inputRef}
            value={draftNote}
            onChange={(event) => onDraft(event.target.value)}
            data-pling-field="note"
          />
        </label>
        <div className="editor__actions">
          <button ref={closeRef} type="button" className="orders__button" onClick={onClose}>
            {copy.cancel}
          </button>
          <button
            ref={saveRef}
            type="button"
            className="orders__button editor__primary"
            data-save-note
            disabled={saving || locked}
            onClick={() => void onSave()}
          >
            {saving ? "…" : copy.save}
          </button>
        </div>
      </section>
    </div>
  );
}
