import { createExecutor, createPolicy, type Executor } from "@plingjs/core";
import {
  createPling,
  type AgentSetup,
  type VanillaDock,
  type VanillaPling,
} from "@plingjs/vanilla";
import { copyFor, plingLocale, resolveDemoLocale, type DemoCopy, type DemoLocale } from "./copy";
import { findCustomer, idFromSearch, loadCustomers, updateCustomer, type Customer } from "./data";
import { currentPage, siblingHref } from "./location";

export interface DetailPageOptions {
  locale?: DemoLocale;
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

function shell(copy: DemoCopy): string {
  return `
  <main class="shell shell--detail">
    <header class="hero">
      <div>
        <p class="eyebrow">${copy.detailEyebrow}</p>
        <h1 data-name></h1>
        <p class="lede">${copy.detailLede}</p>
      </div>
      <a class="back" data-back href="./index.html">${copy.backLabel}</a>
    </header>

    <section class="detail" aria-label="${copy.detailRegionLabel}">
      <div class="facts">
        <div><span>${copy.ownerField}</span><strong data-owner></strong></div>
        <div><span>${copy.phoneField}</span><strong data-phone></strong></div>
        <div><span>${copy.statusField}</span><strong data-status></strong></div>
      </div>

      <label class="editor">
        <span>${copy.noteLabel}</span>
        <textarea data-note rows="5" placeholder="${copy.notePlaceholder}"></textarea>
      </label>
      <p class="feedback" data-feedback role="status"></p>

      <div class="actions">
        <button data-save type="button">${copy.saveLabel}</button>
        <button data-archive type="button" class="danger">${copy.archiveLabel}</button>
      </div>
    </section>

    <footer class="flow" data-pling-ignore>
      <strong>${copy.detailFooterTitle}</strong>
      <p>${copy.detailFooterText}</p>
    </footer>
  </main>
`;
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`062 详情页缺少元素：${selector}`);
  return node;
}

export function createDetailPage(root: HTMLElement, options: DetailPageOptions = {}): DetailPage {
  const locale = options.locale ?? resolveDemoLocale();
  const copy = copyFor(locale);
  root.innerHTML = shell(copy);
  if (typeof document !== "undefined") {
    document.documentElement.lang = plingLocale(locale);
  }

  const customers = loadCustomers(locale);
  const id = options.id ?? idFromSearch(typeof location === "undefined" ? "" : location.search);
  const customer = findCustomer(customers, id) ?? customers[0]!;
  if (typeof document !== "undefined") document.title = copy.detailDocumentTitle;

  const pling = createPling({
    ui: { locale: plingLocale(locale) },
    presence: options.presence ?? true,
    onWarn: options.onWarn ?? ((message) => console.warn(message)),
    agent: options.agent ?? { config: { limits: { maxTurns: 100 } } },
  });
  pling.registry.setPage(currentPage(copy.detailPageTitle(customer.name)));

  const executor = createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
  });
  const dock =
    options.dock === false
      ? null
      : pling.dock({
          title: copy.dockTitle,
          placeholder: copy.detailPlaceholder,
          quick: copy.detailQuick,
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
  status.textContent = copy.status[customer.status];
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
      say(copy.emptyNoteFeedback);
      return;
    }
    customer.note = text;
    if (customer.status === "待跟进") customer.status = "已回访";
    updateCustomer(customers, customer.id, { note: customer.note, status: customer.status }, locale);
    status.textContent = copy.status[customer.status];
    say(copy.noteSavedFeedback);
    syncActions();
  }

  function archiveCustomer(): void {
    customer.status = "已归档";
    updateCustomer(customers, customer.id, { status: customer.status }, locale);
    status.textContent = copy.status[customer.status];
    say(copy.archivedFeedback);
    syncActions();
  }

  remember(
    pling.scope(must<HTMLElement>(root, ".detail"), {
      id: "customer_detail",
      label: copy.detailRegionLabel,
      description: copy.detailRegionDescription,
      role: "main",
    }),
  );
  remember(
    pling.record(must<HTMLElement>(root, ".detail"), {
      data: { ...customer, status: copy.status[customer.status] },
      label: `${copy.detailRegionLabel}: ${customer.name}`,
    }),
  );
  remember(
    pling.tool(note, {
      id: "detail_note",
      desc: copy.noteDesc,
      action: "fill",
      params: [{ name: "text", label: copy.noteParamLabel }],
    }),
  );
  remember(
    pling.tool(save, {
      id: "detail_save",
      desc: copy.saveDesc,
      available: () => (draft.trim() ? true : copy.emptyNoteFeedback),
    }),
  );
  remember(
    pling.tool(archive, {
      id: "detail_archive",
      desc: copy.archiveDesc,
      kind: "danger",
      confirm: true,
      available: () => (customer.status === "已归档" ? copy.archivedReason : true),
    }),
  );
  remember(
    pling.tool(back, {
      id: "detail_back",
      desc: copy.backDesc,
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
        status: copy.status[customer.status],
        note: customer.note,
      }),
      { description: copy.detailStateDescription },
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
