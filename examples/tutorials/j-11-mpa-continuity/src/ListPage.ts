import { createExecutor, createPolicy, type Executor } from "@plingjs/core";
import {
  createPling,
  type AgentSetup,
  type VanillaDock,
  type VanillaPling,
} from "@plingjs/vanilla";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale, type DemoCopy } from "./copy";
import { detailHref, loadCustomers, type Customer } from "./data";
import { currentPage } from "./location";

export interface ListPageOptions {
  locale?: DemoLocale;
  /** 真实整页跳转；测试里换成记录 href 的函数，避免 jsdom 卸载。 */
  navigate?: (href: string) => void;
  /** 任务完成后的自动返回；测试里同样换成记录 href 的函数。 */
  dockNavigate?: (href: string) => void;
  agent?: AgentSetup;
  presence?: boolean;
  /** 测试可以只测注册表，不挂聊天浮窗。 */
  dock?: boolean;
  onWarn?: (message: string) => void;
}

export interface ListPage {
  pling: VanillaPling;
  executor: Executor;
  dock: VanillaDock | null;
  customers: Customer[];
  destroy(): void;
}

function shell(copy: DemoCopy): string {
  return `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">${copy.listEyebrow}</p>
        <h1>${copy.listHeading}</h1>
        <p class="lede">${copy.listLede}</p>
      </div>
      <div class="counts" aria-label="${copy.pendingLabel}">
        <strong data-pending>0</strong>
        <span>${copy.pendingLabel}</span>
      </div>
    </header>

    <section class="board" aria-label="${copy.boardHeading}">
      <header class="board-head">
        <h2>${copy.boardHeading}</h2>
        <span data-total>${copy.customerTotal(0)}</span>
      </header>
      <div class="rows" data-rows></div>
    </section>

    <footer class="flow" data-pling-ignore>
      <strong>${copy.listFooterTitle}</strong>
      <p>${copy.listFooterText}</p>
    </footer>
  </main>
`;
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`062 列表页缺少元素：${selector}`);
  return node;
}

export function createListPage(root: HTMLElement, options: ListPageOptions = {}): ListPage {
  const locale = options.locale ?? resolveDemoLocale();
  const copy = copyFor(locale);
  root.innerHTML = shell(copy);
  if (typeof document !== "undefined") {
    document.documentElement.lang = plingLocale(locale);
    document.title = copy.listDocumentTitle;
  }

  const pling = createPling({
    ui: { locale: plingLocale(locale) },
    presence: options.presence ?? true,
    onWarn: options.onWarn ?? ((message) => console.warn(message)),
    agent: options.agent ?? { config: { limits: { maxTurns: 100 } } },
  });
  pling.registry.setPage(currentPage(copy.listPageTitle));

  const executor = createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
  });
  const dock =
    options.dock === false
      ? null
      : pling.dock({
          title: copy.dockTitle,
          placeholder: copy.listPlaceholder,
          quick: copy.listQuick,
          debug: { maxCalls: 8 },
          defaultOpen: typeof window === "undefined" ? false : window.innerWidth >= 1040,
          onOpenChange(open) {
            if (typeof document !== "undefined") {
              document.body.classList.toggle("has-pling-dock", open);
            }
          },
          ...(options.dockNavigate ? { navigate: options.dockNavigate } : {}),
        });
  if (typeof document !== "undefined") {
    document.body.classList.toggle("has-pling-dock", dock?.isOpen() ?? false);
  }

  const customers = loadCustomers(locale);
  const rows = must<HTMLElement>(root, "[data-rows]");
  const pending = must<HTMLElement>(root, "[data-pending]");
  const total = must<HTMLElement>(root, "[data-total]");
  const navigate = options.navigate ?? ((href: string) => {
    window.location.href = href;
  });

  pending.textContent = String(customers.filter((customer) => customer.status === "待跟进").length);
  total.textContent = copy.customerTotal(customers.length);

  const unbinds: Array<() => void> = [];
  const remember = (unbind: () => void): void => {
    unbinds.push(unbind);
  };

  remember(
    pling.scope(rows, {
      id: "customers",
      label: copy.listRegionLabel,
      description: copy.listRegionDescription,
      role: "list",
    }),
  );

  for (const customer of customers) {
    const row = document.createElement("article");
    row.className = "customer";
    row.dataset.customer = customer.id;

    const identity = document.createElement("div");
    identity.className = "identity";
    const name = document.createElement("strong");
    name.textContent = customer.name;
    const owner = document.createElement("span");
    owner.textContent = copy.ownerLine(customer.owner, customer.phone);
    identity.append(name, owner);

    const status = document.createElement("span");
    status.className = `status is-${customer.status === "待跟进" ? "pending" : customer.status === "已回访" ? "visited" : "archived"}`;
    status.textContent = copy.status[customer.status];

    const note = document.createElement("p");
    note.className = "note";
    note.textContent = customer.note || copy.noNote;

    const open = document.createElement("button");
    open.type = "button";
    open.className = "open";
    open.textContent = copy.openLabel;
    open.addEventListener("click", () => navigate(detailHref(customer.id)));

    const side = document.createElement("div");
    side.className = "side";
    side.append(status, open);

    row.append(identity, note, side);
    rows.append(row);

    remember(pling.record(row, {
      data: { ...customer, status: copy.status[customer.status] },
      label: `${copy.listHeading}: ${customer.name}`,
    }));
    remember(
      pling.tool(open, {
        id: `open@${customer.id}`,
        desc: copy.openDesc(customer.name),
        kind: "read",
      }),
    );
  }

  remember(
    pling.state(
      "customers",
      () => ({
        total: customers.length,
        pending: customers.filter((customer) => customer.status === "待跟进").length,
        items: customers.map(({ id, name, status, note }) => ({
          id,
          name,
          status: copy.status[status],
          note,
        })),
      }),
      { description: copy.listStateDescription },
    ),
  );

  return {
    pling,
    executor,
    dock,
    customers,
    destroy() {
      for (const unbind of unbinds.reverse()) unbind();
      pling.destroy();
      if (typeof document !== "undefined") document.body.classList.remove("has-pling-dock");
    },
  };
}
