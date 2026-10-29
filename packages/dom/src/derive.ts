/**
 * pi · L1 自动派生 —— 开发者什么都不写，框架从 DOM 里认出「这里有个能点的东西」。
 *
 * 这是 `PERCEPTION-01` §5 三层接入 API 里最浅的一层（L0 纯聊天 / **L1 傻瓜式** /
 * L2 一行动词 / L3 细粒度）：
 *
 *     L2  <button v-tool="{ id: 'remove@t4', desc: '删除…' }">删除</button>
 *     L1  <button>删除</button>          ← 框架自己推：id 取文案，说明取文案
 *
 * 为什么值得做：元素级 id 的声明量是 `O(行 × 每个行的动作)`，42 行列表就是 126 个 id，
 * 没人愿意手写。011 量过「13 个文件只动 2 个」，那已经是**只暴露少量动作**的乐观数字。
 *
 * ## 刻意只碰原生元素
 *
 * 候选只有 `<button>` / `<a href>` / `<input type=submit|button|reset>` —— **没有** `[role=button]`。
 * 理由来自 002 的实测结论：DOM 模拟只对「原生元素 + 直接绑定」可靠，
 * 而且失效是**静默的**（`el.click()` 在 `<div role="button">` 上不报错、也不做事）。
 * 一个静默无效的动作混进清单，比清单短更糟：模型会以为它做过了。
 *
 * ## 派生出来的东西必须能被认出来
 *
 * 每条派生动作带 `source: "derived"`，模型侧的清单里带一个「派生」标签，元素上也留
 * `data-pling-derived` 供人检查。猜的依据是文案与元素类型，会变 —— 一份带标记的清单才能被有折扣地信任。
 *
 * ## 四条内置规则（都要记在心里）
 *
 * 1. **显式声明永远赢**：元素自己有 `v-tool` 就不派生它（但**不牵连子树** ——
 *    容器上的动作不代表容器里的东西不是东西，见 `isExplicit`）。
 *    要「整块别派生」用 `data-pling-ignore`，那是另一件事。
 * 2. **id 一旦分配就不再变**：文案从「全部完成」变成「全部取消」时只刷新说明，
 *    换 id 会让模型手上的 id 在半路失效（它刚看到、下一步就调不到了）。
 * 3. **行内动作用 `@<记录id>` 定位**（`remove@t4`）：文案相同的按钮在 42 行里到处都是，
 *    不带行身份就只能靠 `_2` / `_3` 编号，那种 id 既不稳也没有语义。
 * 4. **危险的文案标 danger**：文案命中删除 / 清空 / 重置一类词表时按 danger 处理 ——
 *    派生不该让「删除」悄悄绕过确认闸门（漏标一个破坏性动作的代价，比多问一句大得多）。
 */
import type { ActionDescriptor, Registry } from "@plingjs/core";
import { checkActionable, describeElement, performPrimitive } from "./dom";
import { scrollElementIntoView } from "./scroll";
import { UI_ATTR, nearestScope, type ScopeController } from "./scope";
import { getRegistryNamespace } from "./namespace";
import { closestComposed, composedElementParent, queryAllComposed } from "./projection";

/** 开发者用来「这一块别派生」的标记：写在某个祖先元素上，整棵子树生效 */
export const IGNORE_ATTR = "data-pling-ignore";
/** 派生出来的动作在元素上留个记号（人看 devtools / 测试断言用） */
export const DERIVED_ATTR = "data-pling-derived";

/**
 * 「这个元素已经被显式声明过了」——进程内记，**不写进 DOM**。
 *
 * 为什么不写个 `data-pling-tool` 属性：`v-tool` 是**运行时**事实，写进 DOM 就会改变
 * 真实渲染结果 —— SSR 两端不一致、快照测试炸掉、用户的 CSS 选择器多一个变量。
 * 元素身份用 `WeakSet` 记最合适：元素没了，记号自己就没了。
 */
const explicitElements = new WeakSet<Element>();
const explicitIds = new WeakMap<Element, readonly string[]>();
/** 行元素的记录 id（`v-record` 登记时写进来） */
const recordIds = new WeakMap<Element, string>();

/** `v-tool` 登记时调用：从此刻起，这个元素（及它的子树）不再被派生 */
export function markExplicit(el: Element, actionIds: readonly string[] = []): void {
  explicitElements.add(el);
  explicitIds.set(el, actionIds);
}

/** `v-tool` 注销时调用 */
export function unmarkExplicit(el: Element): void {
  explicitElements.delete(el);
  explicitIds.delete(el);
}

/**
 * 这个元素自己被显式声明过吗？**只看元素自己，不看祖先**。
 *
 * 一开始的规则是「祖先声明过就整棵子树不派生」，在真实代码上立刻翻车：
 * 020 的 `<ul class="list" v-tool="reorder">` 是一条**容器级**的语义动作（把某条挪到第几位），
 * 结果整张列表 12 个按钮全被 suppress 掉 —— agent 连「删除这一条」都看不到了。
 *
 * 一个容器上有动作，不代表容器里的东西不是东西。所以分成两件事，各管各的：
 *   · `v-tool`           —— 「**这个元素**是一个动作」（只盖住它自己）
 *   · `data-pling-ignore`   —— 「这一块**整个**别派生」（盖住整棵子树，这是它存在的理由）
 */
export function isExplicit(el: Element): boolean {
  return explicitElements.has(el);
}

/** Action ids attached to an explicitly declared element (developer diagnostics only). */
export function explicitActionIds(el: Element): string[] {
  return [...(explicitIds.get(el) ?? [])];
}

/** `v-record` 登记时调用：把行 id 绑在这个元素上（派生动作靠它拼 `remove@t4`） */
export function markRecordElement(el: Element, id: string): void {
  recordIds.set(el, id);
}

/** `v-record` 注销时调用 */
export function unmarkRecordElement(el: Element): void {
  recordIds.delete(el);
}

/** 这个按钮属于哪一行？（没有行上下文时返回 undefined） */
export function nearestRecordId(el: Element): string | undefined {
  for (let node: Element | null = el; node; node = composedElementParent(node)) {
    const id = recordIds.get(node);
    if (id) return id;
  }
  return undefined;
}

/**
 * 候选选择器：只挑**原生可靠**的可点元素。
 * `[role=button]` 不在这里 —— 见文件头「刻意只碰原生元素」。
 */
export const DERIVE_SELECTOR = [
  "button",
  "a[href]",
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="reset"]',
].join(", ");

/**
 * 文案 → 动词。命中的**第一个**规则生效，所以顺序就是优先级
 * （「清空搜索」要得到 `clear` 而不是 `search`）。
 *
 * 这张表存在的唯一理由：id 要像人写的。中文文案直接 slug 出来是一串下划线
 * （`toolNameOf("删除@t4")` → `___t4`），模型看着它等于没名字；
 * 而 `remove@t4` 既短又有语义。猜错不可怕 —— 说明里永远带着**原文案**，
 * 模型对不上时开发者写一行 `v-tool` 覆盖即可。
 */
const VERB_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/删除|移除|删掉|delete|remove/i, "remove"],
  [/清空|清除|clear|empty/i, "clear"],
  [/重置|恢复默认|reset/i, "reset"],
  [/保存|暂存|save/i, "save"],
  [/提交|submit/i, "submit"],
  [/添加|新增|新建|add|create/i, "add"],
  [/取消|cancel/i, "cancel"],
  [/关闭|close/i, "close"],
  [/编辑|修改|edit|modify/i, "edit"],
  [/搜索|查询|search|query|find/i, "search"],
  [/筛选|过滤|filter/i, "filter"],
  [/刷新|reload|refresh/i, "refresh"],
  [/展开|expand/i, "expand"],
  [/收起|折叠|collapse/i, "collapse"],
  [/排序|sort/i, "sort"],
  [/下载|导出|download|export/i, "export"],
  [/上传|导入|upload|import/i, "import"],
  [/复制|copy/i, "copy"],
  [/登录|登出|退出|logout|login|sign in|sign out/i, "auth"],
  [/确认|确定|confirm|ok\b/i, "confirm"],
  [/切换|开关|toggle/i, "toggle"],
  [/完成|done|complete/i, "complete"],
];

/** 文案命中这些词 → danger（确认闸门会停下来问；`kind` 永远是 fail-closed） */
export const DEFAULT_DANGER_WORDS =
  /删除|移除|清除|清空|重置|作废|注销|退订|退掉|delete|remove|clear|reset|drop|destroy/i;

export interface DeriveOptions {
  /**
   * 扫描范围（默认 `document.body`）。一般是应用的挂载点。
   *
   * 也可以给一个**取值函数**：`createPling` 就是这么用的 —— 挂载点要在 `app.mount()`
   * 之后才拿得到，在那之前取到 `null` 就什么都不扫（而不是先扫一遍 `body` 再改主意）。
   */
  root?: DeriveRoot;
  /** 候选选择器，默认 {@link DERIVE_SELECTOR} */
  selector?: string;
  /** 危险文案词表；传 `false` 关掉这个启发 */
  danger?: RegExp | false;
  /** 开发期告警出口，默认 `console.warn` */
  onWarn?: (message: string) => void;
  /** 监听 DOM 变化（默认开）。关掉之后只在 `sync()` 被调用时重扫。 */
  observe?: boolean;
  /** 追加的跳过规则（在内置规则之后判断：返回 true 就不派生这个元素） */
  skip?: (el: Element) => boolean;
}

/** 扫描范围：元素 / 文档，或「等会儿才知道」的取值函数 */
export type DeriveRoot = Element | Document | null | (() => Element | Document | null);

export interface DeriveController {
  /** 全量重扫（幂等）。测试 / 没有 MutationObserver 的环境用它手动驱动。 */
  sync(): void;
  /** 当前派生出来的动作 id（按 DOM 顺序） */
  ids(): string[];
  /** 停掉监听并注销全部派生动作 */
  stop(): void;
}

interface DerivedBinding {
  id: string;
  descriptor: ActionDescriptor;
  unbind: () => void;
  untrack: (() => void) | null;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 元素的「名字」：优先给人看的无障碍名，其次可见文案，最后表单值 */
export function labelOf(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return collapse(aria);
  const title = el.getAttribute("title");
  if (title?.trim()) return collapse(title);
  const text = collapse(el.textContent ?? "");
  if (text) return text;
  const value = el.getAttribute("value");
  if (value?.trim()) return collapse(value);
  const name = el.getAttribute("name") ?? el.id;
  return name?.trim() ? collapse(name) : "";
}

/** 文案 → 动词（命中不了就按元素类型给个中性的） */
export function verbOf(label: string, el: Element): string {
  for (const [pattern, verb] of VERB_RULES) {
    if (pattern.test(label)) return verb;
  }
  return el.tagName.toLowerCase() === "a" ? "link" : "click";
}

function descriptionOf(el: Element, label: string): string {
  const shown = label || "(no label)";
  return el.tagName.toLowerCase() === "a"
    ? `Click link "${shown}" (navigates to the link target)`
    : `Click "${shown}"`;
}

/** 这个元素不该被派生吗：已移除 / 自己被显式声明 / 落在 `data-pling-ignore`·`data-pling-ui` 子树里 */
function isSuppressed(el: Element, skip?: (el: Element) => boolean): boolean {
  if (!el.isConnected) return true;
  if (isExplicit(el)) return true;
  if (closestComposed(el, `[${IGNORE_ATTR}], [${UI_ATTR}]`)) return true;
  return skip ? skip(el) : false;
}

function resolveRoot(option: DeriveRoot | undefined): Element | null {
  const root = typeof option === "function" ? option() : option;
  if (root) {
    // Document 传进来时取 body：`querySelectorAll` 在 Document 上也能跑，但 body 更符合直觉
    return (root as Document).body ?? (root as Element);
  }
  if (option !== undefined) return null; // 显式给了（可能是「还没到时候」）→ 不猜 body
  const doc = (globalThis as { document?: Document }).document;
  return doc?.body ?? null;
}

/**
 * 建一个派生器。约定同 `createScopeController`：
 * 没有 `MutationObserver` 的环境（老浏览器 / 特殊测试）退化成「手动 `sync()`」。
 */
export function createDeriver(
  registry: Registry,
  scopes: ScopeController,
  options: DeriveOptions = {},
): DeriveController {
  const selector = options.selector ?? DERIVE_SELECTOR;
  const danger = options.danger === undefined ? DEFAULT_DANGER_WORDS : options.danger;
  const warn = options.onWarn ?? ((message: string) => console.warn(message));
  const ids = getRegistryNamespace(registry);
  const bound = new Map<Element, DerivedBinding>();
  const MutationObserverCtor = (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver;
  let observer: MutationObserver | null = null;
  const observedRoots = new WeakSet<Node>();
  let scheduled = false;
  let stopped = false;

  function rowContextOf(el: Element): string | undefined {
    return nearestRecordId(el);
  }

  function bind(el: Element, label: string): DerivedBinding {
    const verb = verbOf(label, el);
    const row = rowContextOf(el);
    // 行身份进 id（`remove@t4`）：42 行里文案相同的按钮只有带上行才分得清。
    // 没有行上下文时靠注册表查重兜底（`_2` / `_3`）—— 那种 id 不稳，是无奈之举。
    let localId = row ? `${verb}@${row}` : verb;
    for (let n = 2; registry.get(localId) !== undefined; n += 1) {
      localId = row ? `${verb}${n}@${row}` : `${verb}_${n}`;
    }
    const id = ids.action(localId);

    const descriptor: ActionDescriptor = {
      id,
      primitive: "click",
      description: descriptionOf(el, label),
      // 触发可靠（原生元素 + 直接绑定，002 的结论）≠ 语义可信（没人背书）：
      // 前者是 fidelity，后者是 source。
      fidelity: "high",
      source: "derived",
      ...(danger && danger.test(label) ? { kind: "danger" as const } : {}),
    };

    const scope = nearestScope(el);
    const untrack = scope && scopes.isDeclared(scope) ? scopes.track(el, scope) : null;

    const unbind = registry.bind({
      descriptor,
      isAvailable: () => {
        const own = checkActionable(el);
        if (!own.available) return own;
        const cover = scopes.coverOf(el);
        if (cover) {
          const element = describeElement(cover);
          return {
            available: false,
            reason: `Covered by ${element} (possibly an open dialog or overlay)`,
            reasonKey: "availability.covered",
            reasonParams: { element },
          };
        }
        return true;
      },
      isVisible: untrack ? () => scopes.isVisible(el) : undefined,
      reveal: async () => scrollElementIntoView(el),
      resolveScope: () => nearestScope(el),
      run: async () => {
        if (!el.isConnected) throw new Error(`Element was removed from the page: ${id}`);
        performPrimitive(el, "click", {});
      },
    });

    el.setAttribute(DERIVED_ATTR, id);
    return { id, descriptor, unbind, untrack };
  }

  function release(el: Element, state: DerivedBinding): void {
    state.untrack?.();
    state.unbind();
    el.removeAttribute(DERIVED_ATTR);
  }

  /**
   * 观察器**惰性挂**：扫描范围可能是「挂载之后才知道」（见 `DeriveRoot`），
   * 所以第一次真正拿到 root 时才 attach —— 在那之前挂到哪儿都可能是错的。
   */
  function ensureObserver(root: Element): void {
    if (options.observe === false || observer || !MutationObserverCtor) return;
    observer = new MutationObserverCtor(schedule);
    observeDeep(root);
  }

  /** MutationObserver 不穿过 shadow root；扫描到的边界显式挂上同一个观察器。 */
  function observeDeep(root: ParentNode): void {
    if (!observer || observedRoots.has(root as Node)) return;
    observer.observe(root as Node, { childList: true, subtree: true, characterData: true });
    observedRoots.add(root as Node);
    for (const host of root.querySelectorAll("*")) {
      if (host.shadowRoot) observeDeep(host.shadowRoot);
    }
  }

  function sync(): void {
    if (stopped) return;
    const root = resolveRoot(options.root);
    if (!root || typeof root.querySelectorAll !== "function") return;
    ensureObserver(root);
    observeDeep(root);

    // 文档顺序：id 的查重后缀（`_2` / `_3`）跟着它走，同一份 DOM 每次扫描得到同一批 id
    const candidates = queryAllComposed(root, selector);
    const alive = new Set(candidates);

    for (const [el, state] of [...bound]) {
      if (!alive.has(el) || isSuppressed(el, options.skip)) {
        release(el, state);
        bound.delete(el);
      }
    }

    for (const el of candidates) {
      if (isSuppressed(el, options.skip)) continue;
      const label = labelOf(el);
      const existing = bound.get(el);
      if (existing) {
        // id 不变（见文件头规则 2）：只有说明跟着文案走
        existing.descriptor.description = descriptionOf(el, label);
        continue;
      }
      if (!label) {
        // 没有文案的元素派不出有意义的名字 —— 派生一个 `click_2` 只会污染清单。
        // 这是「宁可没有，不能编」在 L1 上的落地。
        warn(`Pling 派生：${describeElement(el)} 没有可读文案（aria-label / 文本 / value 都没有），跳过不派生`);
        continue;
      }
      bound.set(el, bind(el, label));
    }
  }

  /**
   * 一次 DOM 变更批次只重扫一次。
   *
 * 用**微任务**而不是 `requestAnimationFrame`：后者要等一帧，于是「点『编辑』→ 保存按钮出现」
   * 这种事上，派生动作会比 `v-tool` 声明出来的动作**慢一拍**（Vue 的指令 `mounted` 是同步的）——
   * 020 的实测里，`await nextTick()` 之后 `save@t5` 还没进清单。
   * MutationObserver 的回调本来就在微任务里批量派发，跟着它走最贴近「DOM 变了就有动作」。
   */
  function schedule(): void {
    if (stopped || scheduled) return;
    scheduled = true;
    const run = (): void => {
      scheduled = false;
      sync();
    };
    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else void Promise.resolve().then(run);
  }

  if (options.observe !== false && !MutationObserverCtor) {
    warn("Pling 派生：当前环境没有 MutationObserver，自动派生只会在初始化时扫描一次（后续变化请手动 sync()）");
  }

  sync();

  return {
    sync,
    ids(): string[] {
      const list = [...bound.keys()].sort((a, b) =>
        a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1,
      );
      return list.map((el) => bound.get(el)!.id);
    },
    stop(): void {
      stopped = true;
      observer?.disconnect();
      observer = null;
      for (const [el, state] of [...bound]) release(el, state);
      bound.clear();
    },
  };
}
