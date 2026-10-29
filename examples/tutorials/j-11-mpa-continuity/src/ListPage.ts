import { createExecutor, createPolicy, type Executor } from "@plingjs/core";
import {
  createPling,
  type AgentSetup,
  type VanillaDock,
  type VanillaPling,
} from "@plingjs/vanilla";
import { detailHref, loadCustomers, type Customer } from "./data";
import { currentPage } from "./location";

export interface ListPageOptions {
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

const SHELL = `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">MPA continuity · 页面 A / 列表</p>
        <h1>客户回访</h1>
        <p class="lede">
          这是一张普通的服务端多页列表。点「查看详情」会真的卸载当前 document，
          浏览器新开一次运行时。Pling 只接任务，不接管业务数据。
        </p>
      </div>
      <div class="counts" aria-label="客户统计">
        <strong data-pending>0</strong>
        <span>待跟进</span>
      </div>
    </header>

    <section class="board" aria-label="客户列表">
      <header class="board-head">
        <h2>本周需要回访的客户</h2>
        <span data-total>0 位</span>
      </header>
      <div class="rows" data-rows></div>
    </section>

    <footer class="flow" data-pling-ignore>
      <strong>怎么验证连续性</strong>
      <p>
        让助手「Globex的备注为：周五约吃饭」。它点击查看详情后，
        页面会整页跳转；详情页自动继续，保存完成后自动返回这张列表。
      </p>
    </footer>
  </main>
`;

function must<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`062 列表页缺少元素：${selector}`);
  return node;
}

export function createListPage(root: HTMLElement, options: ListPageOptions = {}): ListPage {
  root.innerHTML = SHELL;
  if (typeof document !== "undefined") document.title = "客户回访 · Pling MPA continuity";

  const pling = createPling({
    ui: { locale: "zh-CN" },
    presence: options.presence ?? true,
    onWarn: options.onWarn ?? ((message) => console.warn(message)),
    agent: options.agent ?? { config: { limits: { maxTurns: 100 } } },
  });
  pling.registry.setPage(currentPage("客户回访"));

  const executor = createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
  });
  const dock =
    options.dock === false
      ? null
      : pling.dock({
          title: "客户助手",
          placeholder: "例如：Globex的备注为：周五约吃饭",
          quick: ["Globex的备注为：周五约吃饭"],
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

  const customers = loadCustomers();
  const rows = must<HTMLElement>(root, "[data-rows]");
  const pending = must<HTMLElement>(root, "[data-pending]");
  const total = must<HTMLElement>(root, "[data-total]");
  const navigate = options.navigate ?? ((href: string) => {
    window.location.href = href;
  });

  pending.textContent = String(customers.filter((customer) => customer.status === "待跟进").length);
  total.textContent = `${customers.length} 位`;

  const unbinds: Array<() => void> = [];
  const remember = (unbind: () => void): void => {
    unbinds.push(unbind);
  };

  remember(
    pling.scope(rows, {
      id: "customers",
      label: "客户列表",
      description: "每一行是一位客户，包含负责人、回访状态和上一次的备注",
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
    owner.textContent = `负责人 ${customer.owner} · ${customer.phone}`;
    identity.append(name, owner);

    const status = document.createElement("span");
    status.className = `status is-${customer.status === "待跟进" ? "pending" : customer.status === "已回访" ? "visited" : "archived"}`;
    status.textContent = customer.status;

    const note = document.createElement("p");
    note.className = "note";
    note.textContent = customer.note || "还没有回访备注。";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "open";
    open.textContent = "查看详情 →";
    open.addEventListener("click", () => navigate(detailHref(customer.id)));

    const side = document.createElement("div");
    side.className = "side";
    side.append(status, open);

    row.append(identity, note, side);
    rows.append(row);

    remember(pling.record(row, { data: customer, label: `客户：${customer.name}` }));
    remember(
      pling.tool(open, {
        id: `open@${customer.id}`,
        desc: `打开客户 ${customer.name} 的详情页（整页导航）`,
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
        items: customers.map(({ id, name, status, note }) => ({ id, name, status, note })),
      }),
      { description: "客户回访列表：总数、待跟进数与每位客户的状态 / 备注" },
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
