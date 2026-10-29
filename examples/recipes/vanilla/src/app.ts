import type { AgentConfigOverrides, SessionEvent } from "@plingjs/agent";
import type { VanillaDock, VanillaPling } from "@plingjs/vanilla";
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

interface ConnectionDraft {
  baseUrl: string;
  model: string;
  apiKey: string;
  persist: "memory" | "session";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_KEY = "pling:recipe:model";

export function createRecipeApp(pling: VanillaPling, root: HTMLElement): () => void {
  let locale: Locale = initialLocale();
  let copy: Copy = copyFor(locale);
  pling.ui.setLocale(locale === "zh" ? "zh-CN" : "en-US");
  let orders: Order[] = ORDERS.map((order) => ({ ...order }));
  let form = { customer: "", email: "", plan: "starter" as Plan };
  let submitting = false;
  let error: string | null = null;
  let createdName: string | null = null;
  let filter: Filter = "all";
  let searchDraft = "";
  let appliedSearch = "";
  let sequence = 1018;
  let lastCreatedId: string | null = null;
  let started = false;
  let connection: AgentConfigOverrides = readSessionConfig() ?? {};
  let connectionDraft: ConnectionDraft = {
    baseUrl: connection.baseUrl ?? "",
    model: connection.model ?? "",
    apiKey: connection.apiKey ?? "",
    persist: hasSessionConfig() ? "session" : "memory",
  };
  let dock: VanillaDock | null = null;
  let offCreate: (() => void) | null = null;
  let offState: Array<() => void> = [];
  let bindings: Array<() => void> = [];
  let rowBindings: Array<() => void> = [];
  const detailId = new URLSearchParams(location.search).get("order");
  const detailOrder = detailId ? orders.find((order) => order.id === detailId) ?? null : null;

  function visibleOrders(): Order[] {
    const needle = appliedSearch.toLocaleLowerCase();
    return orders.filter((order) => {
      if (filter !== "all" && order.status !== filter) return false;
      return needle === "" || `${order.customer} ${order.id}`.toLocaleLowerCase().includes(needle);
    });
  }

  function openCount(): number {
    return orders.filter((order) => order.status === "open").length;
  }

  function addOrder(input: { customer: string; email: string; plan: Plan }): Order {
    const order: Order = {
      id: `SO-${++sequence}`,
      customer: input.customer.trim(),
      email: input.email.trim(),
      amount: input.plan === "pro" ? 240 : 120,
      plan: input.plan,
      status: "open",
    };
    orders = [order, ...orders];
    lastCreatedId = order.id;
    createdName = order.customer;
    return order;
  }

  async function createOrder(input: { customer: string; email: string; plan: Plan }, fillForm: boolean): Promise<void> {
    if (submitting) return;
    submitting = true;
    error = null;
    if (fillForm) {
      form = { customer: input.customer, email: input.email, plan: input.plan };
      paintForm();
    }
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      addOrder(input);
      if (fillForm) form = { customer: "", email: "", plan: "starter" };
      paintForm();
      renderOrders();
      paintCreated();
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
      paintForm();
    } finally {
      submitting = false;
      paintForm();
    }
  }

  function invalidFields(): string[] {
    const fields: string[] = [];
    if (form.customer.trim().length < 2) fields.push("customer");
    if (!EMAIL.test(form.email.trim())) fields.push("email");
    return fields;
  }

  function setStatus(id: string, status: OrderStatus): void {
    const order = orders.find((item) => item.id === id);
    if (order) order.status = status;
  }

  function shell(): string {
    if (detailOrder) return detailShell(detailOrder);
    const visible = visibleOrders();
    return `
      <main class="page">
        <header class="masthead">
          <div>
            <p class="eyebrow">Pling recipes · Vanilla JS</p>
            <h1>${escapeHtml(copy.title)}</h1>
            <p class="lede">${escapeHtml(copy.subtitle)}</p>
          </div>
          <div class="toolbar"><button class="chip" type="button" data-locale>${escapeHtml(copy.switchLanguage)}</button></div>
        </header>
        <div class="grid">
          <section class="panel" data-scope-form>
            <header class="panel__head"><div><h2>${escapeHtml(copy.formTitle)}</h2><p>${escapeHtml(copy.formHint)}</p></div></header>
            <div class="body">
              <form class="form" data-form>
                <label class="field"><span>${escapeHtml(copy.customer)}</span><input name="customer" autocomplete="organization" /></label>
                <label class="field"><span>${escapeHtml(copy.email)}</span><input name="email" type="email" autocomplete="email" /></label>
                <label class="field"><span>${escapeHtml(copy.plan)}</span><select name="plan"><option value="starter">${escapeHtml(copy.starter)}</option><option value="pro">${escapeHtml(copy.pro)}</option></select></label>
                <div class="form__footer"><span class="status" data-form-status></span><button class="button primary" type="submit" data-submit>${escapeHtml(copy.create)}</button></div>
              </form>
              <p class="status ok" data-created>${createdName ? escapeHtml(copy.created(createdName)) : ""}</p>
              <details class="connection">
                <summary>${escapeHtml(copy.connectionTitle)}</summary>
                <p class="hint">${escapeHtml(copy.connectionHint)}</p>
                <div class="form" data-connection-form>
                  <label class="field"><span>Base URL</span><input name="baseUrl" placeholder="https://provider.example.com/v1" /></label>
                  <label class="field"><span>Model</span><input name="model" placeholder="model-name" /></label>
                  <label class="field"><span>API key</span><input name="apiKey" type="password" autocomplete="off" /></label>
                  <label class="field"><span>Storage</span><select name="persist"><option value="memory">memory</option><option value="session">session</option></select></label>
                  <div class="form__footer"><span class="hint" data-connection-status></span><button class="button" type="button" data-connection-save>${started ? "Locked after first message" : "Save connection"}</button></div>
                </div>
              </details>
            </div>
          </section>
          <section class="panel" data-scope-list>
            <header class="panel__head"><div><h2>${escapeHtml(copy.listTitle)}</h2><p data-counts>${escapeHtml(countsText(visible))}</p></div></header>
            <div class="controls">
              <input class="search" data-search aria-label="${escapeHtml(copy.searchLabel)}" placeholder="${escapeHtml(copy.searchPlaceholder)}" />
              <button class="button" type="button" data-apply>${escapeHtml(copy.apply)}</button>
              <select data-filter aria-label="${escapeHtml(copy.filterDesc)}">
                <option value="all">${escapeHtml(copy.all)}</option><option value="open">${escapeHtml(copy.open)}</option><option value="paid">${escapeHtml(copy.paid)}</option>
              </select>
            </div>
            <ul class="orders" data-orders></ul>
            <footer class="list__footer"><span class="status" data-counts-footer>${escapeHtml(countsText(visible))}</span></footer>
          </section>
        </div>
      </main>`;
  }

  function detailShell(order: Order): string {
    return `
      <main class="page">
        <header class="masthead"><div><p class="eyebrow">Pling recipes · Vanilla JS</p><h1>${escapeHtml(copy.title)}</h1></div><button class="chip" type="button" data-locale>${escapeHtml(copy.switchLanguage)}</button></header>
        <section class="panel">
          <header class="panel__head"><div><h2>${escapeHtml(copy.detailTitle)}</h2><p>${escapeHtml(copy.order)} ${escapeHtml(order.id)}</p></div><a class="chip" href="./">${escapeHtml(copy.back)}</a></header>
          <div class="body details"><dl>
            <dt>${escapeHtml(copy.customerLabel)}</dt><dd>${escapeHtml(order.customer)}</dd>
            <dt>${escapeHtml(copy.emailLabel)}</dt><dd>${escapeHtml(order.email)}</dd>
            <dt>${escapeHtml(copy.planLabel)}</dt><dd>${escapeHtml(order.plan)}</dd>
            <dt>${escapeHtml(copy.amount)}</dt><dd>${order.amount}</dd>
            <dt>${escapeHtml(copy.status)}</dt><dd>${escapeHtml(order.status)}</dd>
          </dl></div>
        </section>
      </main>`;
  }

  function countsText(visible: Order[]): string {
    return copy.counts(visible.length, orders.length, openCount(), orders.length - openCount());
  }

  function paintShell(): void {
    root.innerHTML = shell();
    bindStatic();
    renderOrders();
    paintForm();
    paintConnection();
  }

  function bindStatic(): void {
    for (const off of bindings.splice(0)) off();
    const formElement = root.querySelector<HTMLFormElement>("[data-form]");
    const formScope = root.querySelector<HTMLElement>("[data-scope-form]");
    const listScope = root.querySelector<HTMLElement>("[data-scope-list]");
    if (formScope) {
      bindings.push(pling.scope(formScope, {
        id: "order_form",
        label: copy.formTitle,
        description: copy.formHint,
        role: "form",
      }));
    }
    if (listScope) {
      bindings.push(pling.scope(listScope, {
        id: "orders",
        label: copy.listTitle,
        description: copy.listHint,
        role: "list",
      }));
    }
    root.querySelector("[data-locale]")?.addEventListener("click", switchLocale, { once: true });
    formElement?.addEventListener("submit", (event) => {
      event.preventDefault();
      void createOrder(form, false);
    });
    for (const name of ["customer", "email", "plan"] as const) {
      const field = formElement?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (!field) continue;
      field.addEventListener(field instanceof HTMLSelectElement ? "change" : "input", () => {
        form = { ...form, [name]: field.value };
        paintForm();
      });
    }
    const search = root.querySelector<HTMLInputElement>("[data-search]");
    if (search) {
      search.value = searchDraft;
      search.addEventListener("input", () => { searchDraft = search.value; });
      bindings.push(pling.tool(search, {
        id: "search_text",
        desc: copy.searchDesc,
        action: "fill",
        params: [{ name: "text", label: copy.searchPlaceholder }],
      }));
    }
    const apply = root.querySelector<HTMLButtonElement>("[data-apply]");
    if (apply) {
      apply.addEventListener("click", () => {
        appliedSearch = searchDraft.trim();
        renderOrders();
      });
      bindings.push(pling.tool(apply, { id: "search_apply", desc: copy.applySearchDesc }));
    }
    const filterElement = root.querySelector<HTMLSelectElement>("[data-filter]");
    if (filterElement) {
      filterElement.value = filter;
      filterElement.addEventListener("change", () => {
        filter = filterElement.value as Filter;
        renderOrders();
      });
      bindings.push(pling.tool(filterElement, {
        id: "filter_orders",
        desc: copy.filterDesc,
        action: "select",
        params: [{ name: "value", label: copy.filterDesc, values: ["all", "open", "paid"] }],
      }));
    }
    const connectionForm = root.querySelector<HTMLElement>("[data-connection-form]");
    if (connectionForm) {
      bindConnectionInputs(connectionForm);
      root.querySelector("[data-connection-save]")?.addEventListener("click", saveConnection, { once: true });
    }
  }

  function bindConnectionInputs(formElement: HTMLElement): void {
    for (const [name, value] of Object.entries(connectionDraft)) {
      const field = formElement.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      if (!field) continue;
      field.value = value;
      field.addEventListener(field instanceof HTMLSelectElement ? "change" : "input", () => {
        connectionDraft = { ...connectionDraft, [name]: field.value };
      });
    }
    paintConnection();
  }

  function paintConnection(): void {
    const save = root.querySelector<HTMLButtonElement>("[data-connection-save]");
    if (save) save.disabled = started;
    const status = root.querySelector<HTMLElement>("[data-connection-status]");
    if (status) status.textContent = started ? "Start a new page load to change the connection." : "The key is never printed in page state.";
  }

  function paintForm(): void {
    const formElement = root.querySelector<HTMLFormElement>("[data-form]");
    if (formElement) {
      for (const name of ["customer", "email", "plan"] as const) {
        const field = formElement.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
        if (field) field.value = form[name];
      }
    }
    const button = root.querySelector<HTMLButtonElement>("[data-submit]");
    if (button) {
      button.disabled = submitting || invalidFields().length > 0;
      button.textContent = submitting ? copy.creating : copy.create;
    }
    const status = root.querySelector<HTMLElement>("[data-form-status]");
    if (status) {
      status.className = error ? "status error" : "status";
      status.textContent = error ?? "";
    }
    paintCreated();
  }

  function paintCreated(): void {
    const node = root.querySelector<HTMLElement>("[data-created]");
    if (node) node.textContent = createdName ? copy.created(createdName) : "";
  }

  function renderOrders(): void {
    for (const off of rowBindings.splice(0)) off();
    const list = root.querySelector<HTMLUListElement>("[data-orders]");
    if (!list) return;
    const visible = visibleOrders();
    list.replaceChildren();
    if (visible.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = copy.empty;
      list.append(empty);
    }
    for (const order of visible) {
      list.append(renderRow(order));
    }
    const text = countsText(visible);
    for (const node of root.querySelectorAll<HTMLElement>("[data-counts], [data-counts-footer]")) {
      node.textContent = text;
    }
  }

  function renderRow(order: Order): HTMLLIElement {
    const row = document.createElement("li");
    row.className = order.status === "paid" ? "order is-paid" : "order";
    row.innerHTML = `
      <div class="order__main"><p class="order__title"></p><p class="order__meta"></p></div>
      <div class="order__actions">
        <a class="chip"></a>
        <button type="button" data-toggle></button>
        <button class="remove" type="button" data-remove></button>
      </div>`;
    const title = row.querySelector<HTMLElement>(".order__title")!;
    title.append(order.customer, " ");
    const id = document.createElement("span");
    id.className = "order__id";
    id.textContent = order.id;
    title.append(id);
    row.querySelector<HTMLElement>(".order__meta")!.textContent = `${order.plan} · ${order.amount} · ${order.status}`;
    const detail = row.querySelector<HTMLAnchorElement>("a")!;
    detail.href = `?order=${order.id}`;
    detail.textContent = copy.detailTitle;
    const toggle = row.querySelector<HTMLButtonElement>("[data-toggle]")!;
    toggle.textContent = order.status === "open" ? copy.markPaid : copy.markOpen;
    toggle.addEventListener("click", () => {
      setStatus(order.id, order.status === "open" ? "paid" : "open");
      renderOrders();
    });
    const remove = row.querySelector<HTMLButtonElement>("[data-remove]")!;
    remove.textContent = copy.remove;
    remove.addEventListener("click", () => {
      orders = orders.filter((item) => item.id !== order.id);
      renderOrders();
    });
    rowBindings.push(pling.record(row, {
      data: order,
      fields: { customer: order.customer, amount: order.amount, plan: order.plan, status: order.status },
    }));
    rowBindings.push(pling.tool(detail, { id: `open_order@${order.id}`, desc: `${copy.detailTitle}: ${order.id}` }));
    rowBindings.push(pling.tool(toggle, {
      id: `toggle_order@${order.id}`,
      desc: order.status === "open" ? copy.markPaidDesc(order.id) : copy.markOpenDesc(order.id),
      kind: "write",
    }));
    rowBindings.push(pling.tool(remove, {
      id: `delete_order@${order.id}`,
      desc: copy.removeDesc(order.id),
      kind: "danger",
      confirm: "always",
    }));
    return row;
  }

  function switchLocale(): void {
    locale = locale === "en" ? "zh" : "en";
    copy = copyFor(locale);
    pling.ui.setLocale(locale === "zh" ? "zh-CN" : "en-US");
    onDocumentTitle();
    rebuildAgentCopy();
    paintShell();
  }

  function saveConnection(): void {
    if (started) return;
    const next: AgentConfigOverrides = {
      baseUrl: connectionDraft.baseUrl.trim(),
      model: connectionDraft.model.trim(),
      apiKey: connectionDraft.apiKey.trim(),
    };
    if (connectionDraft.persist === "session") writeSessionConfig(next);
    else clearSessionConfig();
    connection = next;
    rebuildDock();
    paintConnection();
  }

  function rebuildDock(): void {
    dock?.destroy();
    dock = pling.dock({
      config: connection,
      title: copy.listTitle,
      quick: copy.quick,
      onSessionEvent: (event: SessionEvent) => {
        if (event.type === "user") {
          started = true;
          paintConnection();
        }
      },
    });
  }

  function rebuildAgentCopy(): void {
    offCreate?.();
    offCreate = null;
    if (detailOrder) return;
    offCreate = pling.action({
      id: "create_order",
      desc: copy.createOrderDesc,
      kind: "write",
      params: [
        { name: "customer", label: copy.customerParam, minLength: 2, maxLength: 80 },
        { name: "email", label: copy.emailParam, pattern: EMAIL },
        { name: "plan", label: copy.planParam, values: ["starter", "pro"] },
      ],
      available: () => (!submitting ? true : "An order is already being created"),
      run: async (args) => {
        await createOrder(
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
        check: () => orders.some((order) => order.id === lastCreatedId),
      },
    });
    if (!started) rebuildDock();
  }

  function onDocumentTitle(): void {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = `${copy.title} · Pling recipes`;
    pling.registry.setPage({
      path: location.pathname,
      title: document.title,
      ...(detailId ? { params: { order: detailId } } : {}),
    });
  }

  offState = [
    pling.state("order_view", () => ({
      filter,
      search: appliedSearch,
      matched: visibleOrders().length,
      total: orders.length,
      open: openCount(),
      paid: orders.length - openCount(),
    }), { description: "Read-only order view: applied filter/search, matching rows, and open/paid totals" }),
    pling.state("order_form", () => ({
      dirty: Boolean(form.customer || form.email || form.plan !== "starter"),
      submitting,
      invalidFields: invalidFields(),
      lastSaveFailed: error !== null,
    }), { description: "Order form status; customer values are not repeated in page state" }),
  ];

  onDocumentTitle();
  paintShell();
  rebuildAgentCopy();

  return () => {
    for (const off of rowBindings.splice(0)) off();
    for (const off of bindings.splice(0)) off();
    for (const off of offState) off();
    offState = [];
    offCreate?.();
    offCreate = null;
    dock?.destroy();
    dock = null;
    pling.destroy();
    root.replaceChildren();
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]!));
}

function initialLocale(): Locale {
  return new URLSearchParams(location.search).get("lang")?.startsWith("zh") ? "zh" : "en";
}

function readSessionConfig(): AgentConfigOverrides | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentConfigOverrides;
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
