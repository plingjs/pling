import {
  createPolicy,
  createRegistry,
  type Availability,
  type FlowStep,
  type HandoffSpec,
  type Kind,
  type Policy,
  type Primitive,
  type Registry,
  type Snapshot,
} from "@plingjs/core";
import type { SessionEvent } from "../src/types";

export interface FakeAction {
  id: string;
  primitive?: Primitive;
  kind?: Kind;
  description?: string;
  scope?: string;
  fidelity?: "high" | "auto" | "low";
  /** L1 派生出来的动作（清单里会带「派生」标签） */
  source?: "declared" | "derived";
  available?: Availability | (() => Availability);
  visible?: boolean;
  onRun?: (args: Record<string, unknown>) => unknown;
  /** 复合动作（S6a）：给了它就是 `primitive: flow`（对模型 1 个 tool，内部按顺序走） */
  steps?: readonly FlowStep[];
  /** 人工接力（S5）：给了它，执行器会请用户亲自完成 */
  handoff?: HandoffSpec;
}

export function makeRegistry(actions: readonly FakeAction[]): Registry {
  const registry = createRegistry();
  for (const action of actions) {
    registry.bind({
      descriptor: {
        id: action.id,
        primitive: action.steps ? "flow" : (action.primitive ?? "click"),
        description: action.description ?? action.id,
        ...(action.kind ? { kind: action.kind } : {}),
        ...(action.scope ? { scope: action.scope } : {}),
        ...(action.fidelity ? { fidelity: action.fidelity } : {}),
        ...(action.source ? { source: action.source } : {}),
        ...(action.handoff ? { handoff: { reason: action.handoff.reason } } : {}),
      },
      isAvailable: () => (typeof action.available === "function" ? action.available() : action.available ?? true),
      ...(action.handoff ? { handoff: action.handoff } : {}),
      ...(action.visible === false ? { isVisible: () => false } : {}),
      ...(action.steps ? { steps: action.steps } : {}),
      run: async (args) => {
        action.onRun?.(args);
      },
    });
  }
  return registry;
}

/**
 * 造一份带指定动作 + 行数据的快照。
 *
 * 行数据不是可有可无的：S2b 的动作折叠**要求那一行有记录**（有「读」的行才有「写」的模板），
 * 没有记录的快照里行内动作就是一条条独立的 id。
 */
export function snapshotOf(
  actions: readonly FakeAction[],
  rows: ReadonlyArray<{ id: string; fields?: Record<string, unknown>; label?: string }> = [],
  /** 活跃的作用域：不在活跃作用域里的动作不会进快照（和适配器里的行为一致） */
  autoScopes: readonly string[] = [],
): Snapshot {
  const registry = makeRegistry(actions);
  if (autoScopes.length) registry.setAutoScopes([...autoScopes]);
  for (const row of rows) registry.declareRecord({ id: row.id, ...(row.label ? { label: row.label } : {}), fields: row.fields ?? {} });
  const base = registry.snapshot();
  return {
    ...base,
    recordsTotal: rows.length,
  };
}

/** 全部批准（danger 也只批本次）—— 测试里少写样板 */
export const allowAll: Policy = createPolicy(async () => "always");

/** 无确认通道：read 放行，write / danger 一律拒绝（fail-closed） */
export const denyWrites: Policy = createPolicy(null);

/** 拒绝一切需要确认的动作 */
export const rejectAll: Policy = createPolicy(async () => false);

/**
 * 测试里默认关掉「页面落定」的等待：它只为真实浏览器的渲染/观察者时序服务，
 * 在 jsdom 里只会白等一轮宏任务 + 一帧、拖慢套件。落定本身的契约有专门用例（loop.test.ts）。
 */
export const noSettle = async (): Promise<void> => {};

export function ofType<T extends SessionEvent["type"]>(
  events: readonly SessionEvent[],
  type: T,
): Array<Extract<SessionEvent, { type: T }>> {
  return events.filter((event): event is Extract<SessionEvent, { type: T }> => event.type === type);
}

export function collectEvents(): { events: SessionEvent[]; onEvent: (event: SessionEvent) => void } {
  const events: SessionEvent[] = [];
  return { events, onEvent: (event) => events.push(event) };
}
