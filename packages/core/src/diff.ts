import type { PageView, Snapshot } from "./registry";

/**
 * 「变更证据」：一次动作**执行前后**两份快照的差异（S3）。
 *
 * 为什么必须有：到 S2 为止，动作成功只回报 `{ ok: true, action }` ——
 * 也就是「我调用了这个动作」。但「**页面真的变了吗**」没人回答：
 *   - 点了禁用按钮（DOM 模拟照样触发 onClick）→ 回 `ok`，其实什么都没发生；
 *   - 只改了界面上没暴露的数据 → 回 `ok`，模型与人都看不出来；
 *   - 改对了 → 回 `ok`，但模型只能**猜**它改对了。
 * 于是「执行成功但没效果」在框架里是不可判定的，而它恰恰是企业场景最需要发现的一类问题。
 *
 * 这一层只做**如实比对**：把「快照里能看见的东西」变没变说清楚，不假装知道看不见的东西。
 */
export const DIFF_LIST_LIMIT = 5;

export interface RecordChange {
  /** 新出现的行 id */
  added: string[];
  /** 消失的行 id */
  removed: string[];
  /** 还在、但字段值变了的行（只列变了的字段名） */
  updated: Array<{ id: string; fields: string[] }>;
  /** 行没增减、字段也没变，但**顺序**变了（拖拽 / 排序） */
  reordered: boolean;
  /** 每个列表被截断掉的条数（0 = 没截断） */
  omitted: { added: number; removed: number; updated: number };
  /** `recordsTotal` 的变化（被条数上限裁掉的行只在这里看得见） */
  total?: { from: number; to: number };
}

export interface SnapshotDiff {
  /** 快照层面观察到变化了吗。false 只说明**这一层**没看见（见 executor 的告警文案） */
  observed: boolean;
  /** 页面身份变化（路由 / 标题 / 参数） */
  page?: { changed: string[]; from?: PageView; to?: PageView };
  records?: RecordChange;
  /** 动作清单的变化（筛选 / 搜索 / 删除会带来成批的行内动作增减） */
  actions?: { added: string[]; removed: string[]; omitted: { added: number; removed: number } };
  /** 状态视图的变化（只报 key） */
  state?: { changed: string[]; omitted: number };
  /** 页面反馈的变化（新增 / 消失 / 同 id 文案或字段变化） */
  feedback?: { added: string[]; removed: string[]; changed: string[]; omitted: { added: number; removed: number; changed: number } };
}

const json = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

function cut<T>(items: readonly T[]): { shown: T[]; omitted: number } {
  return { shown: items.slice(0, DIFF_LIST_LIMIT), omitted: Math.max(0, items.length - DIFF_LIST_LIMIT) };
}

/**
 * 比两份快照。
 *
 * 只比「模型能看见的那部分」：`records`（行数据）/ `actions`（可用动作）/ `state`（状态视图）。
 * 刻意**不比** action 的 approval / fidelity 这类元信息 —— 它们不因一次动作而变，
 * 真变了也不是「这个动作的效果」。
 */
export function diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const observedParts: SnapshotDiff = { observed: false };

  // ── 页面身份 ──
  // 路由切换可能碰巧不改变动作 / 状态（例如两个页面共用工具栏），
  // 但它仍然是 agent 必须知道的变化，所以单独比对，不能只看动作清单。
  const pageKeys = new Set([
    ...Object.keys(before.page ?? {}),
    ...Object.keys(after.page ?? {}),
  ]);
  const pageChanged = [...pageKeys].filter((key) => {
    const left = before.page ? (before.page as Record<string, unknown>)[key] : undefined;
    const right = after.page ? (after.page as Record<string, unknown>)[key] : undefined;
    return json(left) !== json(right);
  });
  if (pageChanged.length) {
    observedParts.observed = true;
    observedParts.page = {
      changed: pageChanged,
      ...(before.page ? { from: before.page } : {}),
      ...(after.page ? { to: after.page } : {}),
    };
  }

  // ── 行数据 ──
  const beforeRecords = new Map(before.records.map((record) => [record.id, record]));
  const afterRecords = new Map(after.records.map((record) => [record.id, record]));

  const addedIds: string[] = [];
  const removedIds: string[] = [];
  const updated: Array<{ id: string; fields: string[] }> = [];

  for (const [id, record] of afterRecords) {
    const previous = beforeRecords.get(id);
    if (!previous) {
      addedIds.push(id);
      continue;
    }
    const fields = changedFields(previous.fields, record.fields);
    if (fields.length) updated.push({ id, fields });
  }
  for (const id of beforeRecords.keys()) {
    if (!afterRecords.has(id)) removedIds.push(id);
  }

  const beforeOrder = before.records.map((record) => record.id);
  const afterOrder = after.records.map((record) => record.id);
  const reordered =
    addedIds.length === 0 &&
    removedIds.length === 0 &&
    beforeOrder.join("\u0000") !== afterOrder.join("\u0000");

  const totalChanged = before.recordsTotal !== after.recordsTotal;
  if (addedIds.length || removedIds.length || updated.length || reordered || totalChanged) {
    const added = cut(addedIds);
    const removed = cut(removedIds);
    const changed = cut(updated);
    observedParts.observed = true;
    observedParts.records = {
      added: added.shown,
      removed: removed.shown,
      updated: changed.shown,
      reordered,
      omitted: { added: added.omitted, removed: removed.omitted, updated: changed.omitted },
      ...(totalChanged ? { total: { from: before.recordsTotal, to: after.recordsTotal } } : {}),
    };
  }

  // ── 动作清单 ──
  const beforeActions = new Set(before.actions.map((action) => action.id));
  const afterActions = new Set(after.actions.map((action) => action.id));
  const actionsAdded = [...afterActions].filter((id) => !beforeActions.has(id));
  const actionsRemoved = [...beforeActions].filter((id) => !afterActions.has(id));
  if (actionsAdded.length || actionsRemoved.length) {
    const added = cut(actionsAdded);
    const removed = cut(actionsRemoved);
    observedParts.observed = true;
    observedParts.actions = {
      added: added.shown,
      removed: removed.shown,
      omitted: { added: added.omitted, removed: removed.omitted },
    };
  }

  // ── 状态视图 ──
  const stateKeys = new Set([...Object.keys(before.state), ...Object.keys(after.state)]);
  const stateChanged = [...stateKeys].filter((key) => json(before.state[key]) !== json(after.state[key]));
  if (stateChanged.length) {
    const changed = cut(stateChanged);
    observedParts.observed = true;
    observedParts.state = { changed: changed.shown, omitted: changed.omitted };
  }

  // ── 页面反馈 ──
  const beforeFeedback = new Map(before.feedback.map((item) => [item.id, item]));
  const afterFeedback = new Map(after.feedback.map((item) => [item.id, item]));
  const feedbackAdded = [...afterFeedback.keys()].filter((id) => !beforeFeedback.has(id));
  const feedbackRemoved = [...beforeFeedback.keys()].filter((id) => !afterFeedback.has(id));
  const feedbackChanged = [...afterFeedback.keys()].filter((id) => {
    const previous = beforeFeedback.get(id);
    const current = afterFeedback.get(id);
    if (!previous || !current) return false;
    return (
      previous.message !== current.message ||
      previous.field !== current.field ||
      previous.severity !== current.severity
    );
  });
  if (feedbackAdded.length || feedbackRemoved.length || feedbackChanged.length) {
    const added = cut(feedbackAdded);
    const removed = cut(feedbackRemoved);
    const changed = cut(feedbackChanged);
    observedParts.observed = true;
    observedParts.feedback = {
      added: added.shown,
      removed: removed.shown,
      changed: changed.shown,
      omitted: { added: added.omitted, removed: removed.omitted, changed: changed.omitted },
    };
  }

  return observedParts;
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (json(before[key]) !== json(after[key])) changed.push(key);
  }
  return changed;
}

export interface DescribeDiffOptions {
  /** BCP 47 locale for human-facing labels. Omitted keeps the legacy Chinese copy. */
  locale?: string;
}

interface DiffCopy {
  unchanged: string;
  separator: string;
  listJoin: string;
  detailJoin: string;
  listMore(shown: string, shownCount: number, total: number): string;
  listOnly(total: number): string;
  pageTransition(from: string, to: string): string;
  pageEnter(page: string): string;
  pageLeave(page: string): string;
  pageChanged(fields: string): string;
  recordAdded(count: number, records: string): string;
  recordRemoved(count: number, records: string): string;
  recordDetail(id: string, fields: string): string;
  recordUpdated(count: number, detail: string, partial: boolean): string;
  recordReordered: string;
  rowsTotal(from: number, to: number): string;
  actionAdded(count: number, actions: string): string;
  actionRemoved(count: number, actions: string): string;
  stateChanged(state: string): string;
  feedbackAdded(count: number, feedback: string): string;
  feedbackRemoved(count: number, feedback: string): string;
  feedbackChanged(feedback: string): string;
  pageLabel(title: string | undefined, path: string | undefined): string | undefined;
}

const ZH_DIFF_COPY: DiffCopy = {
  unchanged: "无变化",
  separator: "；",
  listJoin: " / ",
  detailJoin: "，",
  listMore: (shown, _shownCount, total) => `${shown} 等 ${total} 个`,
  listOnly: (total) => `共 ${total} 个`,
  pageTransition: (from, to) => `页面${from} → ${to}`,
  pageEnter: (page) => `进入页面${page}`,
  pageLeave: (page) => `离开页面${page}`,
  pageChanged: (fields) => `页面信息变了（${fields}）`,
  recordAdded: (count, records) => `新增 ${count} 行（${records}）`,
  recordRemoved: (count, records) => `删除 ${count} 行（${records}）`,
  recordDetail: (id, fields) => `${id} 的 ${fields}`,
  recordUpdated: (count, detail, partial) => `改了 ${count} 条（${partial ? "如 " : ""}${detail}）`,
  recordReordered: "顺序变了",
  rowsTotal: (from, to) => `行数 ${from} → ${to}`,
  actionAdded: (count, actions) => `新增 ${count} 个动作（${actions}）`,
  actionRemoved: (count, actions) => `${count} 个动作不可用 / 消失（${actions}）`,
  stateChanged: (state) => `状态变了（${state}）`,
  feedbackAdded: (count, feedback) => `新增 ${count} 条页面反馈（${feedback}）`,
  feedbackRemoved: (count, feedback) => `${count} 条反馈消失（${feedback}）`,
  feedbackChanged: (feedback) => `反馈更新（${feedback}）`,
  pageLabel: (title, path) => {
    if (title && path) return `「${title}」(${path})`;
    if (title) return `「${title}」`;
    return path;
  },
};

const EN_DIFF_COPY: DiffCopy = {
  unchanged: "no visible change",
  separator: "; ",
  listJoin: " / ",
  detailJoin: ", ",
  listMore: (shown, shownCount, total) => `${shown} (+${total - shownCount} more)`,
  listOnly: (total) => `${total} more`,
  pageTransition: (from, to) => `page ${from} → ${to}`,
  pageEnter: (page) => `entered page ${page}`,
  pageLeave: (page) => `left page ${page}`,
  pageChanged: (fields) => `page info changed (${fields})`,
  recordAdded: (count, records) => `added ${count} ${count === 1 ? "row" : "rows"} (${records})`,
  recordRemoved: (count, records) => `removed ${count} ${count === 1 ? "row" : "rows"} (${records})`,
  recordDetail: (id, fields) => `${id}: ${fields}`,
  recordUpdated: (count, detail, partial) =>
    `updated ${count} ${count === 1 ? "record" : "records"} (${partial ? "e.g. " : ""}${detail})`,
  recordReordered: "order changed",
  rowsTotal: (from, to) => `rows ${from} → ${to}`,
  actionAdded: (count, actions) => `added ${count} ${count === 1 ? "action" : "actions"} (${actions})`,
  actionRemoved: (count, actions) =>
    `${count} ${count === 1 ? "action" : "actions"} unavailable / removed (${actions})`,
  stateChanged: (state) => `state changed (${state})`,
  feedbackAdded: (count, feedback) =>
    `added ${count} page ${count === 1 ? "message" : "messages"} (${feedback})`,
  feedbackRemoved: (count, feedback) =>
    `${count} ${count === 1 ? "message" : "messages"} removed (${feedback})`,
  feedbackChanged: (feedback) => `messages updated (${feedback})`,
  pageLabel: (title, path) => {
    if (title && path) return `“${title}” (${path})`;
    if (title) return `“${title}”`;
    return path;
  },
};

function diffCopy(locale?: string): DiffCopy {
  if (!locale) return ZH_DIFF_COPY;
  return /^zh(?:-|$)/i.test(locale.trim()) ? ZH_DIFF_COPY : EN_DIFF_COPY;
}

/**
 * 把 diff 说成一句人话 / 模型话（「新增 1 行（t7）；改了 t2 的 已完成」）。
 *
 * 说人话而不是丢 JSON：这句话要出现在面板的「运行」里，也可能出现在模型的告警里 ——
 * 两处都需要「一眼看懂发生了什么」。
 */
export function describeDiff(diff: SnapshotDiff, options: DescribeDiffOptions = {}): string {
  const copy = diffCopy(options.locale);
  if (!diff.observed) return copy.unchanged;
  const parts: string[] = [];

  if (diff.page) {
    const from = pageLabel(diff.page.from, copy);
    const to = pageLabel(diff.page.to, copy);
    if (from && to && from !== to) parts.push(copy.pageTransition(from, to));
    else if (to) parts.push(copy.pageEnter(to));
    else if (from) parts.push(copy.pageLeave(from));
    else parts.push(copy.pageChanged(diff.page.changed.join(copy.listJoin)));
  }

  const records = diff.records;
  if (records) {
    if (records.added.length) parts.push(copy.recordAdded(records.added.length + records.omitted.added, list(records.added, records.omitted.added, copy)));
    if (records.removed.length) parts.push(copy.recordRemoved(records.removed.length + records.omitted.removed, list(records.removed, records.omitted.removed, copy)));
    if (records.updated.length) {
      const total = records.updated.length + records.omitted.updated;
      const detail = records.updated
        .map((item) => copy.recordDetail(item.id, item.fields.join(copy.listJoin)))
        .join(copy.detailJoin);
      parts.push(copy.recordUpdated(total, detail, total > records.updated.length));
    }
    if (records.reordered) parts.push(copy.recordReordered);
    if (records.total) parts.push(copy.rowsTotal(records.total.from, records.total.to));
  }

  if (diff.actions) {
    const added = diff.actions.added.length + diff.actions.omitted.added;
    const removed = diff.actions.removed.length + diff.actions.omitted.removed;
    if (added) parts.push(copy.actionAdded(added, list(diff.actions.added, diff.actions.omitted.added, copy)));
    if (removed) parts.push(copy.actionRemoved(removed, list(diff.actions.removed, diff.actions.omitted.removed, copy)));
  }

  if (diff.state) {
    parts.push(copy.stateChanged(list(diff.state.changed, diff.state.omitted, copy)));
  }

  if (diff.feedback) {
    const added = diff.feedback.added.length + diff.feedback.omitted.added;
    const removed = diff.feedback.removed.length + diff.feedback.omitted.removed;
    const changed = diff.feedback.changed.length + diff.feedback.omitted.changed;
    if (added) parts.push(copy.feedbackAdded(added, list(diff.feedback.added, diff.feedback.omitted.added, copy)));
    if (removed) parts.push(copy.feedbackRemoved(removed, list(diff.feedback.removed, diff.feedback.omitted.removed, copy)));
    if (changed) parts.push(copy.feedbackChanged(list(diff.feedback.changed, diff.feedback.omitted.changed, copy)));
  }

  return parts.join(copy.separator) || copy.unchanged;
}

function pageLabel(page: PageView | undefined, copy: DiffCopy): string | undefined {
  if (!page) return undefined;
  const title = page.title ?? page.name;
  return copy.pageLabel(title, page.path);
}

function list(ids: readonly string[], omitted: number, copy: DiffCopy): string {
  const shown = ids.join(copy.listJoin);
  if (!omitted) return shown;
  return shown ? copy.listMore(shown, ids.length, ids.length + omitted) : copy.listOnly(omitted);
}
