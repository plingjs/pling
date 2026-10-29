import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentConfigOverrides, SessionEvent } from "@plingjs/agent";
import {
  AgentDock,
  useAgentTool,
  usePling,
  usePlingRecord,
  usePlingScope,
  usePlingState,
  usePlingTool,
} from "@plingjs/react";
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

interface FormValue {
  customer: string;
  email: string;
  plan: Plan;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_FORM: FormValue = { customer: "", email: "", plan: "starter" };

export function App() {
  const pling = usePling();
  const [locale, setLocale] = useState<Locale>(() => initialLocale());
  const copy = useMemo<Copy>(() => copyFor(locale), [locale]);
  const [orders, setOrders] = useState<Order[]>(() => ORDERS.map((order) => ({ ...order })));
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const [form, setForm] = useState<FormValue>(EMPTY_FORM);
  const formRef = useRef(form);
  formRef.current = form;
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  submittingRef.current = submitting;
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [connection, setConnection] = useState<AgentConfigOverrides>(() => readSessionConfig() ?? {});
  const [connectionDraft, setConnectionDraft] = useState({
    baseUrl: connection.baseUrl ?? "",
    model: connection.model ?? "",
    apiKey: connection.apiKey ?? "",
    persist: hasSessionConfig() ? "session" : "memory",
  });
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [started, setStarted] = useState(false);
  const sequence = useRef(1018);
  const lastCreated = useRef<string | null>(null);

  const detailId = new URLSearchParams(location.search).get("order");
  const detailOrder = orders.find((order) => order.id === detailId) ?? null;
  const invalidFields = useMemo(() => {
    const fields: string[] = [];
    if (form.customer.trim().length < 2) fields.push("customer");
    if (!EMAIL.test(form.email.trim())) fields.push("email");
    return fields;
  }, [form]);
  const dirty = Boolean(form.customer || form.email || form.plan !== "starter");
  const visibleOrders = useMemo(() => {
    const needle = appliedSearch.toLocaleLowerCase();
    return orders.filter((order) => {
      if (filter !== "all" && order.status !== filter) return false;
      return needle === "" || `${order.customer} ${order.id}`.toLocaleLowerCase().includes(needle);
    });
  }, [appliedSearch, filter, orders]);
  const openCount = orders.filter((order) => order.status === "open").length;
  const paidCount = orders.length - openCount;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = `${copy.title} · Pling recipes`;
    pling.ui.setLocale(locale === "zh" ? "zh-CN" : "en-US");
    pling.registry.setPage({
      path: location.pathname,
      title: document.title,
      ...(detailId ? { params: { order: detailId } } : {}),
    });
  }, [copy.title, detailId, locale, pling]);

  usePlingState(
    "order_view",
    () => ({
      filter,
      search: appliedSearch,
      matched: visibleOrders.length,
      total: orders.length,
      open: openCount,
      paid: paidCount,
    }),
    { description: "Read-only order view: applied filter/search, matching rows, and open/paid totals" },
  );

  usePlingState(
    "order_form",
    () => ({
      dirty,
      submitting,
      invalidFields,
      lastSaveFailed: error !== null,
    }),
    { description: "Order form status; customer values are not repeated in page state" },
  );

  function addOrder(input: FormValue): Order {
    const order: Order = {
      id: `SO-${++sequence.current}`,
      customer: input.customer.trim(),
      email: input.email.trim(),
      amount: input.plan === "pro" ? 240 : 120,
      plan: input.plan,
      status: "open",
    };
    setOrders((current) => [order, ...current]);
    setCreatedName(order.customer);
    lastCreated.current = order.id;
    return order;
  }

  async function create(value: FormValue, updateForm: boolean): Promise<void> {
    if (submittingRef.current) return;
    if (updateForm) setForm({ customer: value.customer, email: value.email, plan: value.plan });
    setSubmitting(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      addOrder(value);
      if (updateForm) setForm(EMPTY_FORM);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSubmitting(false);
    }
  }

  useAgentTool({
    id: "create_order",
    desc: copy.createOrderDesc,
    kind: "write",
    params: [
      { name: "customer", label: copy.customerParam, minLength: 2, maxLength: 80 },
      { name: "email", label: copy.emailParam, pattern: EMAIL },
      { name: "plan", label: copy.planParam, values: ["starter", "pro"] },
    ],
    available: () => (!submittingRef.current ? true : "An order is already being created"),
    run: async (args) => {
      await create(
        {
          customer: String(args.customer),
          email: String(args.email),
          plan: args.plan === "pro" ? "pro" : "starter",
        },
        true,
      );
    },
    expect: {
      desc: copy.createOrderExpect,
      check: () => ordersRef.current.some((order) => order.id === lastCreated.current),
    },
  });

  function switchLocale(): void {
    const next = locale === "en" ? "zh" : "en";
    setLocale(next);
  }

  function saveConnection(): void {
    if (started) return;
    const config: AgentConfigOverrides = {
      baseUrl: connectionDraft.baseUrl.trim(),
      model: connectionDraft.model.trim(),
      apiKey: connectionDraft.apiKey.trim(),
    };
    if (connectionDraft.persist === "session") writeSessionConfig(config);
    else clearSessionConfig();
    setConnection(config);
    setConnectionRevision((value) => value + 1);
  }

  function onSessionEvent(event: SessionEvent): void {
    if (event.type === "user") setStarted(true);
  }

  if (detailOrder) {
    return (
      <main className="page">
        <header className="masthead">
          <div>
            <p className="eyebrow">Pling recipes · React</p>
            <h1>{copy.title}</h1>
          </div>
          <button className="chip" type="button" onClick={switchLocale}>{copy.switchLanguage}</button>
        </header>
        <section className="panel">
          <header className="panel__head">
            <div>
              <h2>{copy.detailTitle}</h2>
              <p>{copy.order} {detailOrder.id}</p>
            </div>
            <a className="chip" href="./">{copy.back}</a>
          </header>
          <div className="body details">
            <dl>
              <dt>{copy.customerLabel}</dt><dd>{detailOrder.customer}</dd>
              <dt>{copy.emailLabel}</dt><dd>{detailOrder.email}</dd>
              <dt>{copy.planLabel}</dt><dd>{detailOrder.plan}</dd>
              <dt>{copy.amount}</dt><dd>{detailOrder.amount}</dd>
              <dt>{copy.status}</dt><dd>{detailOrder.status}</dd>
            </dl>
          </div>
        </section>
        <AgentDock
          key={connectionRevision}
          config={connection}
          title={copy.listTitle}
          quick={copy.quick}
          onSessionEvent={onSessionEvent}
        />
      </main>
    );
  }

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Pling recipes · React</p>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.subtitle}</p>
        </div>
        <div className="toolbar">
          <button className="chip" type="button" onClick={switchLocale}>{copy.switchLanguage}</button>
        </div>
      </header>

      <div className="grid">
        <OrderForm
          copy={copy}
          form={form}
          invalidFields={invalidFields}
          submitting={submitting}
          error={error}
          createdName={createdName}
          onChange={setForm}
          onSubmit={() => void create(formRef.current, false)}
          connection={connectionDraft}
          connectionLocked={started}
          onConnectionChange={setConnectionDraft}
          onConnectionSave={saveConnection}
        />

        <section
          ref={usePlingScope<HTMLElement>({
            id: "orders",
            label: copy.listTitle,
            description: copy.listHint,
            role: "list",
          })}
          className="panel"
        >
          <header className="panel__head">
            <div>
              <h2>{copy.listTitle}</h2>
              <p>{copy.counts(visibleOrders.length, orders.length, openCount, paidCount)}</p>
            </div>
          </header>
          <div className="controls">
            <SearchBox
              copy={copy}
              value={searchDraft}
              onChange={setSearchDraft}
              onApply={() => setAppliedSearch(searchDraft.trim())}
            />
            <FilterSelect copy={copy} value={filter} onChange={setFilter} />
          </div>
          <ul className="orders">
            {visibleOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                copy={copy}
                onToggle={() => setOrders((current) => current.map((item) => item.id === order.id
                  ? { ...item, status: item.status === "open" ? "paid" : "open" }
                  : item))}
                onRemove={() => setOrders((current) => current.filter((item) => item.id !== order.id))}
              />
            ))}
          </ul>
          {visibleOrders.length === 0 && <p className="empty">{copy.empty}</p>}
          <footer className="list__footer">
            <span className="status">{copy.counts(visibleOrders.length, orders.length, openCount, paidCount)}</span>
          </footer>
        </section>
      </div>

      <AgentDock
        key={connectionRevision}
        config={connection}
        title={copy.listTitle}
        quick={copy.quick}
        onSessionEvent={onSessionEvent}
      />
    </main>
  );
}

function OrderForm(props: {
  copy: Copy;
  form: FormValue;
  invalidFields: string[];
  submitting: boolean;
  error: string | null;
  createdName: string | null;
  onChange(value: FormValue): void;
  onSubmit(): void;
  connection: { baseUrl: string; model: string; apiKey: string; persist: string };
  connectionLocked: boolean;
  onConnectionChange(value: { baseUrl: string; model: string; apiKey: string; persist: string }): void;
  onConnectionSave(): void;
}) {
  const { copy, form, invalidFields, submitting, error, createdName, onChange } = props;
  const scope = usePlingScope<HTMLElement>({
    id: "order_form",
    label: copy.formTitle,
    description: copy.formHint,
    role: "form",
  });
  return (
    <section ref={scope} className="panel">
      <header className="panel__head">
        <div>
          <h2>{copy.formTitle}</h2>
          <p>{copy.formHint}</p>
        </div>
      </header>
      <div className="body">
        <form className="form" onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }}>
          <label className="field">
            <span>{copy.customer}</span>
            <input
              value={form.customer}
              onChange={(event) => onChange({ ...form, customer: event.target.value })}
              aria-invalid={invalidFields.includes("customer")}
              autoComplete="organization"
            />
          </label>
          <label className="field">
            <span>{copy.email}</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
              aria-invalid={invalidFields.includes("email")}
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>{copy.plan}</span>
            <select value={form.plan} onChange={(event) => onChange({ ...form, plan: event.target.value as Plan })}>
              <option value="starter">{copy.starter}</option>
              <option value="pro">{copy.pro}</option>
            </select>
          </label>
          <div className="form__footer">
            <span className={error ? "status error" : "status"}>{error ?? ""}</span>
            <button className="button primary" type="submit" disabled={submitting || invalidFields.length > 0}>
              {submitting ? copy.creating : copy.create}
            </button>
          </div>
        </form>
        {createdName && <p className="status ok">{copy.created(createdName)}</p>}
        <ConnectionForm {...props} />
      </div>
    </section>
  );
}

function SearchBox(props: {
  copy: Copy;
  value: string;
  onChange(value: string): void;
  onApply(): void;
}) {
  const fill = usePlingTool<HTMLInputElement>({
    id: "search_text",
    desc: props.copy.searchDesc,
    action: "fill",
    params: [{ name: "text", label: props.copy.searchPlaceholder }],
  });
  const apply = usePlingTool<HTMLButtonElement>({
    id: "search_apply",
    desc: props.copy.applySearchDesc,
  });
  return (
    <>
      <input
        ref={fill}
        className="search"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        aria-label={props.copy.searchLabel}
        placeholder={props.copy.searchPlaceholder}
      />
      <button ref={apply} className="button" type="button" onClick={props.onApply}>{props.copy.apply}</button>
    </>
  );
}

function FilterSelect(props: {
  copy: Copy;
  value: Filter;
  onChange(value: Filter): void;
}) {
  const filter = usePlingTool<HTMLSelectElement>({
    id: "filter_orders",
    desc: props.copy.filterDesc,
    action: "select",
    params: [{ name: "value", label: props.copy.filterDesc, values: ["all", "open", "paid"] }],
  });
  return (
    <select
      ref={filter}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value as Filter)}
    >
      <option value="all">{props.copy.all}</option>
      <option value="open">{props.copy.open}</option>
      <option value="paid">{props.copy.paid}</option>
    </select>
  );
}

function OrderRow(props: {
  order: Order;
  copy: Copy;
  onToggle(): void;
  onRemove(): void;
}) {
  const { order, copy } = props;
  const record = usePlingRecord({
    data: order,
    fields: { customer: order.customer, amount: order.amount, plan: order.plan, status: order.status },
  });
  const open = usePlingTool<HTMLAnchorElement>({
    id: `open_order@${order.id}`,
    desc: `${copy.detailTitle}: ${order.id}`,
  });
  const toggle = usePlingTool<HTMLButtonElement>({
    id: `toggle_order@${order.id}`,
    desc: order.status === "open" ? copy.markPaidDesc(order.id) : copy.markOpenDesc(order.id),
    kind: "write",
  });
  const remove = usePlingTool<HTMLButtonElement>({
    id: `delete_order@${order.id}`,
    desc: copy.removeDesc(order.id),
    kind: "danger",
    confirm: "always",
  });
  return (
    <li ref={record} className={order.status === "paid" ? "order is-paid" : "order"}>
      <div className="order__main">
        <p className="order__title">{order.customer} <span className="order__id">{order.id}</span></p>
        <p className="order__meta">{order.plan} · {order.amount} · {order.status}</p>
      </div>
      <div className="order__actions">
        <a ref={open} className="chip" href={`?order=${order.id}`}>{copy.detailTitle}</a>
        <button ref={toggle} type="button" onClick={props.onToggle}>
          {order.status === "open" ? copy.markPaid : copy.markOpen}
        </button>
        <button ref={remove} className="remove" type="button" onClick={props.onRemove}>{copy.remove}</button>
      </div>
    </li>
  );
}

function ConnectionForm(props: {
  copy: Copy;
  connection: { baseUrl: string; model: string; apiKey: string; persist: string };
  connectionLocked: boolean;
  onConnectionChange(value: { baseUrl: string; model: string; apiKey: string; persist: string }): void;
  onConnectionSave(): void;
}) {
  const { copy, connection, connectionLocked, onConnectionChange, onConnectionSave } = props;
  return (
    <details className="connection">
      <summary>{copy.connectionTitle}</summary>
      <p className="hint">{copy.connectionHint}</p>
      <div className="form">
        <label className="field">
          <span>Base URL</span>
          <input value={connection.baseUrl} onChange={(event) => onConnectionChange({ ...connection, baseUrl: event.target.value })} placeholder="https://provider.example.com/v1" />
        </label>
        <label className="field">
          <span>Model</span>
          <input value={connection.model} onChange={(event) => onConnectionChange({ ...connection, model: event.target.value })} placeholder="model-name" />
        </label>
        <label className="field">
          <span>API key</span>
          <input type="password" value={connection.apiKey} onChange={(event) => onConnectionChange({ ...connection, apiKey: event.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>Storage</span>
          <select value={connection.persist} onChange={(event) => onConnectionChange({ ...connection, persist: event.target.value })}>
            <option value="memory">memory</option>
            <option value="session">session</option>
          </select>
        </label>
        <div className="form__footer">
          <span className="hint">{connectionLocked ? "Start a new page load to change the connection." : "The key is never printed in page state."}</span>
          <button className="button" type="button" disabled={connectionLocked} onClick={onConnectionSave}>Save connection</button>
        </div>
      </div>
    </details>
  );
}

const SESSION_KEY = "pling:recipe:model";

function initialLocale(): Locale {
  return new URLSearchParams(location.search).get("lang")?.startsWith("zh") ? "zh" : "en";
}

function readSessionConfig(): AgentConfigOverrides | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as AgentConfigOverrides;
    return value;
  } catch {
    return null;
  }
}

function hasSessionConfig(): boolean {
  return sessionStorage.getItem(SESSION_KEY) !== null;
}

function writeSessionConfig(config: AgentConfigOverrides): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(config));
}

function clearSessionConfig(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
