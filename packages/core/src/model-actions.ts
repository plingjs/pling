import { rowRefOf, toolNameOf } from "./ids";
import type { ActionView, Snapshot } from "./registry";
import type {
  Approval,
  DeclarationSource,
  Fidelity,
  JsonSchema,
  Kind,
  Primitive,
} from "./types";

/**
 * 折叠出来的一条「模板动作」。
 *
 * 42 行列表 = 126 个行内动作 id，而它们在语义上是**同一件事**：
 * 「删除」这一个动作，只是每次作用在不同的行上。所以给 Agent 的清单里它是**一条**能力，
 * 行通过参数 `record` 指定 —— 动作数量从 `O(行 × 动作)` 变成 `O(动词)`。
 *
 * 折叠的前提是**那一行有记录**（`v-record`）：有「读」的行，才有「写」的模板。
 * 这保证了 `record` 的值一定是 Agent 在行数据里见过的 id，而不是框架猜出来的。
 *
 * 这份逻辑放在 core，而不是页面 Agent 的展示层：页面内 Agent、外部 Agent Surface、
 * 未来的其他客户端必须看到同一套能力形状；否则同一页面会出现两种折叠规则。
 */
export interface FoldedAction {
  /** 原样拼回 id 用的前缀：`remove@` / `approve@order:` */
  template: string;
  /** 给模型的 function name（`remove_order`）；协议层在撞名时才加后缀 */
  name: string;
  description: string;
  primitive: Primitive;
  kind: Kind;
  approval: Approval;
  fidelity: Fidelity;
  scope?: string;
  /** 从外到内的区域路径（动作标签用；折叠模板沿用第一条成员的路径） */
  scopePath?: string[];
  /** 折叠进来的这批动作是谁给的（L1 派生的一批会整体标 `derived`） */
  source?: DeclarationSource;
  /** 复合动作（S6a）的步数 —— 折叠模板也要把这件事带给模型 */
  flowSteps?: number;
  /** 这一步需要人工完成（S5） */
  handoff?: { reason: string };
  /** 成员动作自己的参数声明（`set_priority@t4 { level }` 折叠后是 `record + level`） */
  params: JsonSchema;
  /** 这一轮折叠进来的记录 id（按页面顺序） */
  records: string[];
  /** 其中有多少条当前不在视口内（调用时会先自动滚动到目标） */
  offscreen: number;
}

export type ModelAction = { type: "action"; action: ActionView } | { type: "fold"; folded: FoldedAction };

/**
 * 「给 Agent 看的那份动作清单」：同类行内动作折叠成一条模板。
 *
 * 只折叠**同类 ≥ 2 条**的：只有一行时 `remove@t1` 比 `remove { record: "t1" }` 更短，
 * 也没有「同一件事有两种写法」的歧义。
 *
 * 注意这是**展示层**的收敛：注册表里的 id 一个都没少（执行时仍按 id 精确匹配），
 * 所以适配器、权限、审计看到的还是元素级的真相。
 */
export function modelActions(snapshot: Snapshot): ModelAction[] {
  const recordIds = snapshot.recordIds.length > 0
    ? snapshot.recordIds
    : snapshot.records.map((record) => record.id);
  const known = new Set(recordIds);
  const recordOrder = new Map(recordIds.map((id, index) => [id, index]));
  const ordered = (members: ActionView[]): ActionView[] =>
    [...members].sort((left, right) => {
      const a = recordOrder.get(rowRefOf(left.id)!.record) ?? Number.MAX_SAFE_INTEGER;
      const b = recordOrder.get(rowRefOf(right.id)!.record) ?? Number.MAX_SAFE_INTEGER;
      return a - b;
    });

  // 先分组：模板 → 成员。**只认指向已声明记录的那些**（有「读」的行，才有「写」的模板）。
  //
  // 成员不仅来自 `actions`（可见动作），也来自 `offscreenRecordActions`（活跃区域内
  // 但滚在视口外的行内动作）。后者是长列表的关键：列表顶部 / 底部的行当前不可见，
  // 但它们仍然存在、可引用，只是执行前要先滚过去。
  const candidates = new Map<string, ActionView>();
  for (const action of snapshot.actions) candidates.set(action.id, action);
  for (const action of snapshot.offscreenRecordActions) candidates.set(action.id, action);
  const groups = new Map<string, ActionView[]>();
  for (const action of candidates.values()) {
    const ref = rowRefOf(action.id);
    if (!ref || !known.has(ref.record)) continue;
    const bucket = groups.get(ref.template);
    if (bucket) bucket.push(action);
    else groups.set(ref.template, [action]);
  }
  const templates = new Set(
    [...groups].filter(([, members]) => members.length >= 2).map(([template]) => template),
  );

  const out: ModelAction[] = [];
  const emitted = new Set<string>();
  for (const action of snapshot.actions) {
    const ref = rowRefOf(action.id);
    if (!ref || !templates.has(ref.template)) {
      out.push({ type: "action", action });
      continue;
    }
    // 同一个模板只出一条；但它**收走这一类里的全部动作** —— 包括行数据被条数上限裁掉的那些行。
    // 它们本来就是「Agent 看不见的行」（要操作得先搜索把它带进可见区），单独留一行只占 token。
    if (emitted.has(ref.template)) continue;
    emitted.add(ref.template);
    out.push({ type: "fold", folded: foldOf(ref.template, ordered(groups.get(ref.template)!)) });
  }

  // 某类行内动作**当前全部在视口外**时，`snapshot.actions` 里没有它的代表，
  // 上面的循环就发不出模板。这里补上：否则 Agent 会以为「这一页没有删除功能」。
  for (const [template, members] of groups) {
    if (members.length < 2 || !templates.has(template) || emitted.has(template)) continue;
    emitted.add(template);
    out.push({ type: "fold", folded: foldOf(template, ordered(members)) });
  }

  // 只有一条的视口外动作不折叠，但也要让 Agent 能引用（直接给它的真实 id）。
  for (const action of snapshot.offscreenRecordActions) {
    const ref = rowRefOf(action.id);
    if (!ref || !known.has(ref.record) || templates.has(ref.template) || emitted.has(action.id)) continue;
    emitted.add(action.id);
    out.push({ type: "action", action });
  }
  return out;
}

function foldOf(template: string, members: ActionView[]): FoldedAction {
  const head = members[0]!;
  return {
    template,
    name: toolNameOf(template.replace(/[:@]$/, "")),
    description: withRecordSlot(head, members),
    primitive: head.primitive,
    kind: head.kind,
    approval: head.approval,
    fidelity: head.fidelity,
    ...(head.scope ? { scope: head.scope } : {}),
    ...(head.scopePath ? { scopePath: head.scopePath } : {}),
    ...(head.source ? { source: head.source } : {}),
    ...(head.flowSteps ? { flowSteps: head.flowSteps } : {}),
    ...(head.handoff ? { handoff: head.handoff } : {}),
    params: head.params,
    records: members.map((action) => rowRefOf(action.id)!.record),
    offscreen: members.filter((member) => member.offscreen).length,
  };
}

/**
 * 说明里的「这一行是谁」换成 `{record}` 占位符：
 *   `删除待办「给猫买猫粮」（不可逆）` → `删除待办「{record}」（不可逆）`
 *   `把「给猫买猫粮」标记为已完成`     → `把「{record}」标记为已完成`
 *
 * 为什么是占位符而不是删掉：折叠后的动作对**所有行**都适用，留着某一行的小名会误导
 * （模型以为这个动作只能删那一条）；而直接删掉又会破坏句子（`把「X」标记为已完成` → `把标记为已完成`）。
 * `{record}` 刚好和参数同名，模型一眼就知道「这个位置由参数填」。
 *
 * **只换各行不一致的那一段**（020 撞出来的）：引号里的东西不一定是行身份。
 * L1 自动派生的说明是 `点击「删除」` —— 每个成员一字不差，把「删除」换成 `{record}`
 * 就成了「点击 t4」（点那行等于什么都没干）。真正的写法是：**各行不同的引号片段**才是行身份。
 * 没人声明过描述、全靠文案派生时，压根没有可替换的「谁」—— 参数名 `record` 已经把这件事说了。
 */
function withRecordSlot(head: ActionView, members: ActionView[]): string {
  let text = head.description;
  for (const quoted of head.description.match(/[「“"'][^」”"']{1,40}[」”"']/g) ?? []) {
    if (members.every((member) => member.description.includes(quoted))) continue;
    const open = quoted[0] ?? "";
    const close = quoted.at(-1) ?? "";
    text = text.split(quoted).join(`${open}{record}${close}`);
  }
  const headRecord = rowRefOf(head.id)?.record;
  if (headRecord && headRecord.length > 1) {
    const escaped = headRecord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "g"), "{record}");
  }
  return text;
}

/**
 * 折叠模板的输入 schema：在原动作参数前加一个必填 `record`。
 *
 * 为什么是「加」而不是「换」：行内动作自己也可能带参数
 * （`set_priority@t4 { level }` 折叠后就是 `record + level`），两个维度都要留着。
 */
export function foldedParams(folded: FoldedAction): JsonSchema {
  const example = folded.records[0] ?? "";
  return {
    type: "object",
    properties: {
      record: {
        type: "string",
        description: `Which row: a record id from the page data or citation records (for example, ${example}). Offscreen targets are scrolled into view before execution.`,
      },
      ...folded.params.properties,
    },
    required: ["record", ...(folded.params.required ?? []).filter((key) => key !== "record")],
  };
}
