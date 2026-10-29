import { RESUME_FLOW_ACTION_ID, type Binding, type Registry } from "@plingjs/core";

/** 命名空间只允许短标识符；`/` 留给「namespace/action」分隔符。 */
const NAMESPACE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const NAMESPACE_KEY = Symbol.for("@plingjs/dom/registry-namespace");

function normalizeNamespace(namespace: string): string {
  const value = namespace.trim();
  if (!NAMESPACE_PATTERN.test(value)) {
    throw new Error(
      `pling: namespace 必须是短标识符（字母 / 数字 / _ / -，且以字母或数字开头），收到: ${JSON.stringify(namespace)}`,
    );
  }
  return value;
}

/**
 * 一个适配器的命名空间投影。
 *
 * 六类 key 都走同一套 `/` 前缀：动作、记录、区域、状态、反馈、指引目标。适配器还需要用
 * `record()` / `scope()` 写 DOM 标记（派生器与可见性控制器都从 DOM 读 id），
 * 所以这个投影不能只藏在 registry proxy 里。
 */
export interface RegistryNamespace {
  /** 未配置命名空间时为空。 */
  readonly prefix: string | undefined;
  action(id: string): string;
  record(id: string): string;
  scope(id: string): string;
  state(key: string): string;
  feedback(id: string): string;
  guide(id: string): string;
}

const IDENTITY_NAMESPACE: RegistryNamespace = {
  prefix: undefined,
  action: (id) => id,
  record: (id) => id,
  scope: (id) => id,
  state: (key) => key,
  feedback: (id) => id,
  guide: (id) => id,
};

function createNamespace(namespace?: string): RegistryNamespace {
  if (namespace === undefined) return IDENTITY_NAMESPACE;
  const prefix = `${normalizeNamespace(namespace)}/`;

  /** 记录 / 区域 / 状态：已经带 `/` 的 id 视为完整引用，跨岛不需要二次加前缀。 */
  const qualify = (id: string): string => (id.includes("/") ? id : `${prefix}${id}`);

  const action = (id: string): string => {
    // 续跑动作由执行器用固定 id 拦截，不能加前缀；否则模型能看到却执行不了。
    if (id === RESUME_FLOW_ACTION_ID) return id;

    // 行内动作的最后一段是记录引用。它可能自己就带命名空间（`remove@todo/t1`），
    // 不能因为「整串里出现了 /」就误判成完整动作 id。
    const cut = Math.max(id.lastIndexOf(":"), id.lastIndexOf("@"));
    const hasRef = cut > 0 && cut < id.length - 1;
    const head = hasRef ? id.slice(0, cut + 1) : id;
    const ref = hasRef ? id.slice(cut + 1) : undefined;

    // 动作头已经带 `/`：本岛完整 id 继续处理行引用；别的岛的完整 id 原样保留。
    if (head.includes("/") && !head.startsWith(prefix)) return id;
    const qualifiedHead = head.startsWith(prefix) ? head : `${prefix}${head}`;
    if (ref === undefined) return qualifiedHead;
    return `${qualifiedHead}${qualify(ref)}`;
  };

  return {
    prefix,
    action,
    record: qualify,
    scope: qualify,
    state: qualify,
    feedback: qualify,
    guide: qualify,
  };
}

/**
 * 给一个注册表加「适配器级命名空间」。
 *
 * 动作 / 记录 / 区域 / 状态 key / 反馈 id / 指引目标自动加前缀，元素与回调不动：
 *
 * ```
 * add_todo            → todo/add_todo
 * remove@t1           → todo/remove@todo/t1
 * SO-1（记录 id）     → todo/SO-1
 * list（区域 id）     → todo/list
 * counts（状态 key）  → todo/counts
 * required（反馈 id） → todo/required
 * focus（指引目标）   → todo/focus
 * ```
 *
 * 为什么用 `/`：`rowRefOf()` 按最后一个 `@` / `:` 找记录 id，`/` 不会被误判成行分隔符；
 * 同时 `toolNameOf()` 会把它合法化成下划线，模型侧仍是稳定的 function name。
 *
 * 命名空间是适配器级的：一个岛一个 namespace，岛内所有显式动作、派生动作、区域探索动作、
 * 记录、区域与只读状态自动获得同一个前缀。`createPlingPage()` 仍是共享的，冲突发生在
 * **完整 id** 上。
 */
export function createActionNamespace(registry: Registry, namespace?: string): Registry {
  if (namespace === undefined) return registry;
  const ids = createNamespace(namespace);

  const qualifyScope = (scope: string | undefined): string | undefined =>
    scope === undefined ? undefined : ids.scope(scope);

  return new Proxy(registry, {
    get(target, property) {
      if (property === NAMESPACE_KEY) return ids;
      if (property === "bind") {
        return (binding: Binding): (() => void) =>
          target.bind({
            ...binding,
            descriptor: {
              ...binding.descriptor,
              id: ids.action(binding.descriptor.id),
              ...(binding.descriptor.scope === undefined
                ? {}
                : { scope: ids.scope(binding.descriptor.scope) }),
            },
            // 复合动作的步骤也属于这个岛：把局部 id 一次性固化成完整 id。
            // 执行器可能来自另一个岛的 dock，不能靠它当时的 namespace 去猜。
            ...(binding.steps
              ? { steps: binding.steps.map((step) => ({ ...step, action: ids.action(step.action) })) }
              : {}),
            ...(binding.handoff
              ? {
                  handoff: {
                    ...binding.handoff,
                    ...(binding.handoff.steps
                      ? {
                          steps: binding.handoff.steps.map((step) => ({
                            ...step,
                            ...(step.highlight === undefined
                              ? {}
                              : { highlight: ids.action(step.highlight) }),
                          })),
                        }
                      : {}),
                  },
                }
              : {}),
            ...(binding.resolveScope
              ? { resolveScope: () => qualifyScope(binding.resolveScope!()) }
              : {}),
          });
      }
      if (property === "get") {
        return (id: string) => target.get(ids.action(id));
      }
      if (property === "declareRecord") {
        return (record: Parameters<Registry["declareRecord"]>[0]) =>
          target.declareRecord({
            ...record,
            id: ids.record(record.id),
            ...(record.scope === undefined ? {} : { scope: ids.scope(record.scope) }),
            ...(record.resolveScope
              ? { resolveScope: () => qualifyScope(record.resolveScope!()) }
              : {}),
          });
      }
      if (property === "declareScope") {
        return (declaration: Parameters<Registry["declareScope"]>[0]) => {
          const parent = declaration.parent;
          const qualifiedParent =
            parent === undefined
              ? {}
              : typeof parent === "function"
                ? { parent: () => qualifyScope(parent()) }
                : { parent: ids.scope(parent) };
          return target.declareScope({
            ...declaration,
            id: ids.scope(declaration.id),
            ...qualifiedParent,
            ...(declaration.explore
              ? { explore: declaration.explore.map((id) => ids.action(id)) }
              : {}),
          });
        };
      }
      if (property === "expose") {
        return (exposure: Parameters<Registry["expose"]>[0]) =>
          target.expose({ ...exposure, key: ids.state(exposure.key) });
      }
      if (property === "declareFeedback") {
        return (feedback: Parameters<Registry["declareFeedback"]>[0]) =>
          target.declareFeedback({
            ...feedback,
            id: ids.feedback(feedback.id),
            ...(feedback.scope === undefined ? {} : { scope: ids.scope(feedback.scope) }),
            ...(feedback.resolveScope
              ? { resolveScope: () => qualifyScope(feedback.resolveScope!()) }
              : {}),
          });
      }
      if (property === "declareGuideTarget") {
        return (id: string, guideTarget: Parameters<Registry["declareGuideTarget"]>[1]) =>
          target.declareGuideTarget(ids.guide(id), guideTarget);
      }
      if (property === "markGuideTarget") {
        return (id: string, state: Parameters<Registry["markGuideTarget"]>[1]) =>
          target.markGuideTarget(ids.guide(id), state);
      }
      if (property === "isScopeActive") {
        return (scope: string) => target.isScopeActive(ids.scope(scope));
      }
      if (property === "setActiveScopes") {
        return (scopes: Iterable<string>) => target.setActiveScopes([...scopes].map(ids.scope));
      }
      if (property === "setAutoScopes") {
        return (scopes: Iterable<string>) => target.setAutoScopes([...scopes].map(ids.scope));
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, property, value) {
      return Reflect.set(target, property, value, target);
    },
  });
}

/** 取一个 registry 的命名空间投影；未命名空间化时返回恒等函数。 */
export function getRegistryNamespace(registry: Registry): RegistryNamespace {
  const found = (registry as unknown as Record<PropertyKey, unknown>)[NAMESPACE_KEY];
  return found && typeof found === "object" ? (found as RegistryNamespace) : IDENTITY_NAMESPACE;
}
