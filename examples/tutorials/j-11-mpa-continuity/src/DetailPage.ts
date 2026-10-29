import { createExecutor, createPolicy, type Executor } from "@plingjs/core";
import {
  createPling,
  type AgentSetup,
  type VanillaDock,
  type VanillaPling,
} from "@plingjs/vanilla";
import { findCustomer, idFromSearch, loadCustomers, updateCustomer, type Customer } from "./data";
import { currentPage, siblingHref } from "./location";

export interface DetailPageOptions {
  /** 客户 id；省略时从 query 的 `id` 读，再退回第一位。 */
  id?: string;
  navigate?: (href: string) => void;
  /** 任务完成后的自动返回；测试里同样换成记录 href 的函数。 */
  dockNavigate?: (href: string) => void;
  agent?: AgentSetup;
  presence?: boolean;
  dock?: boolean;
  onWarn?: (message: string) => void;
}

export interface DetailPage {
  pling: VanillaPling;
  executor: Executor;
  dock: VanillaDock | null;
  customer: Customer;
  destroy(): void;
}

const SHELL = `
  <main class="shell shell--detail">
    <header class="hero">
      <div>
        <p class="eyebrow">MPA continuity · 页面 B / 详情</p>
        <h1 data-name></h1>
        <p class="lede">
          这是新 document 里的运行时。Pling 从同一标签页的检查点恢复目标与对话，
          但页面动作、记录和状态全部由本页重新声明。
        </p>
      </div>
      <a class="back" data-back href="./index.html">← 返回列表</a>
    </header>

    <section class="detail" aria-label="客户详情">
      <div class="facts">
        <div><span>负责人</span><strong data-owner></strong></div>
        <div><span>联系电话</span><strong data-phone></strong></div>
        <div><span>回访状态</span><strong data-status></strong></div>
      </div>

      <label class="editor">
        <span>回访备注</span>
        <textarea data-note rows="5" placeholder="记录这次回访的结论…"></textarea>
      </label>
      <p class="feedback" data-feedback role="status"></p>

      <div class="actions">
        <button data-save type="button">保存备注</button>
        <button data-archive type="button" class="danger">归档客户</button>
      </div>
    </section>

    <footer class="flow" data-pling-ignore>
      <strong>安全边界</strong>
      <p>
        归档需要确认；恢复时<strong>不会</strong>恢复待确认的审批。页面跳转截断的那一步会在历史里
        补成「结果未知」，模型必须先观察新页面。
      </p>
    </footer>
  </main>
`;

function must<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`062 详情页缺少元素：${selector}`);
  return node;
}

export function createDetailPage(root: HTMLElement, options: DetailPageOptions = {}): DetailPage {
  root.innerHTML = SHELL;
  if (typeof document !== "undefined") document.title = "客户详情 · Pling MPA continuity";

  const customers = loadCustomers();
  const id = options.id ?? idFromSearch(typeof location === "undefined" ? "" : location.search);
  const customer = findCustomer(customers, id) ?? customers[0]!;

  const pling = createPling({
    ui: { locale: "zh-CN" },
    presence: options.presence ?? true,
    onWarn: options.onWarn ?? ((message) => console.warn(message)),
    agent: options.agent ?? { config: { limits: { maxTurns: 100 } } },
  });
  pling.registry.setPage(currentPage(`${customer.name} · 客户详情`));

  const executor = createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
  });
  const dock =
    options.dock === false
      ? null
      : pling.dock({
          title: "客户助手",
          placeholder: "例如：把回访备注改成「周五约吃饭」并保存",
          quick: ["把回访备注改成「周五约吃饭」并保存"],
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

  const name = must<HTMLElement>(root, "[data-name]");
  const owner = must<HTMLElement>(root, "[data-owner]");
  const phone = must<HTMLElement>(root, "[data-phone]");
  const status = must<HTMLElement>(root, "[data-status]");
  const note = must<HTMLTextAreaElement>(root, "[data-note]");
  const feedback = must<HTMLElement>(root, "[data-feedback]");
  const save = must<HTMLButtonElement>(root, "[data-save]");
  const archive = must<HTMLButtonElement>(root, "[data-archive]");
  const back = must<HTMLAnchorElement>(root, "[data-back]");
  const backHref = siblingHref("./index.html");
  back.href = backHref;
  const navigate = options.navigate ?? ((href: string) => {
    window.location.href = href;
  });

  let draft = customer.note;
  name.textContent = customer.name;
  owner.textContent = customer.owner;
  phone.textContent = customer.phone;
  status.textContent = customer.status;
  note.value = customer.note;

  const unbinds: Array<() => void> = [];
  const remember = (unbind: () => void): void => {
    unbinds.push(unbind);
  };

  function say(message: string): void {
    feedback.textContent = message;
  }

  function syncActions(): void {
    save.disabled = !draft.trim();
    archive.disabled = customer.status === "已归档";
  }

  function saveNote(): void {
    const text = draft.trim();
    if (!text) {
      say("备注是空的，先写点内容。");
      return;
    }
    customer.note = text;
    if (customer.status === "待跟进") customer.status = "已回访";
    updateCustomer(customers, customer.id, { note: customer.note, status: customer.status });
    status.textContent = customer.status;
    say("备注已保存。");
    syncActions();
  }

  function archiveCustomer(): void {
    customer.status = "已归档";
    updateCustomer(customers, customer.id, { status: customer.status });
    status.textContent = customer.status;
    say("客户已归档。");
    syncActions();
  }

  remember(
    pling.scope(must<HTMLElement>(root, ".detail"), {
      id: "customer_detail",
      label: "客户详情",
      description: "当前客户的资料、回访备注与归档操作",
      role: "main",
    }),
  );
  remember(
    pling.record(must<HTMLElement>(root, ".detail"), {
      data: customer,
      label: `客户：${customer.name}`,
    }),
  );
  remember(
    pling.tool(note, {
      id: "detail_note",
      desc: "填写当前客户的回访备注",
      action: "fill",
      params: [{ name: "text", label: "回访备注" }],
    }),
  );
  remember(
    pling.tool(save, {
      id: "detail_save",
      desc: "保存当前回访备注；保存后客户状态会从「待跟进」变成「已回访」",
      available: () => (draft.trim() ? true : "备注是空的，先填写内容"),
    }),
  );
  remember(
    pling.tool(archive, {
      id: "detail_archive",
      desc: "归档当前客户（不可逆，归档后不再出现在待跟进里）",
      kind: "danger",
      confirm: true,
      available: () => (customer.status === "已归档" ? "当前客户已经归档" : true),
    }),
  );
  remember(
    pling.tool(back, {
      id: "detail_back",
      desc: "返回客户列表（整页导航）",
      kind: "read",
      run: () => navigate(backHref),
    }),
  );
  remember(
    pling.state(
      "customer",
      () => ({
        id: customer.id,
        name: customer.name,
        owner: customer.owner,
        status: customer.status,
        note: customer.note,
      }),
      { description: "当前客户详情：身份、回访状态与已保存的备注" },
    ),
  );

  note.addEventListener("input", () => {
    draft = note.value;
    syncActions();
  });
  save.addEventListener("click", saveNote);
  archive.addEventListener("click", archiveCustomer);
  back.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(backHref);
  });

  syncActions();

  return {
    pling,
    executor,
    dock,
    customer,
    destroy() {
      for (const unbind of unbinds.reverse()) unbind();
      pling.destroy();
      if (typeof document !== "undefined") document.body.classList.remove("has-pling-dock");
    },
  };
}
