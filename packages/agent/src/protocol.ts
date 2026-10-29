import {
  foldedParams,
  MAX_TOOL_NAME_LENGTH,
  toolNameOf,
  type ActionView,
  type LlmToolSchema,
  type Snapshot,
} from "@plingjs/core";
import { modelActions, type FoldedAction } from "./prompt";

/**
 * 模型协议层：把页面的 **action id** 翻译成模型能用的 **function name**。
 *
 * 为什么需要这一层：页面上好用的 id 往往带结构，例如 `approve@order:SO-1001`、
 * `remove@row:t3`。而 OpenAI function name 只接受 `[a-zA-Z0-9_-]` 且 ≤64 字符，
 * 直接拿 id 当 name 会被服务端 400 拒绝。
 *
 * 约定：
 *   - 给模型的 name 是「合法化 + 去重」的派生名，**只用于协议**；
 *   - 审计、确认文案、错误信息里一律用原始 id（人看得懂的那个）；
 *   - 派生只在注册期做一次，同一份快照内稳定；冲突时加 `_2` `_3` 后缀。
 *
 * S2b 起，行内动作先**折叠**再进协议：同类 ≥2 条的 `remove@t1`…`remove@t9` 只出一个
 * 带 `record` 参数的 `remove`（`modelActions`）。折叠只改「给模型的那份清单」——
 * 每个成员 id 仍然照常登记成 name（`remove_t4`），所以模型万一照旧点名，也还是同一个动作。
 */

/** 名字的派生规则在 `@plingjs/core`（文本清单和工具 schema 必须用同一个名字）；这里转出去给老调用方 */
export { toolNameOf };

export interface ToolProtocol {
  tools: LlmToolSchema[];
  /** 模型给的 name → 页面原始 id（含折叠成员的原名，见文件头） */
  nameToId: Map<string, string>;
  /** 页面原始 id → 给模型的 name（折叠成员指向模板名） */
  idToName: Map<string, string>;
  /** 折叠出来的模板：模型给 `{ record }`，执行时拼回真实 id（`remove@` + `t4`） */
  templates: Map<string, FoldedAction>;
}

export function buildProtocol(snapshot: Snapshot): ToolProtocol {
  const nameToId = new Map<string, string>();
  const idToName = new Map<string, string>();
  const templates = new Map<string, FoldedAction>();
  const tools: LlmToolSchema[] = [];

  const unique = (base: string): string => {
    let name = base;
    let suffix = 2;
    while (nameToId.has(name) || templates.has(name)) {
      const tag = `_${suffix++}`;
      name = `${base.slice(0, MAX_TOOL_NAME_LENGTH - tag.length)}${tag}`;
    }
    return name;
  };

  for (const item of modelActions(snapshot)) {
    if (item.type === "fold") {
      const folded = item.folded;
      const name = unique(toolNameOf(folded.name));
      templates.set(name, folded);
      tools.push({
        type: "function",
        function: { name, description: describeFolded(folded), parameters: foldedParams(folded) },
      });
      // 这一类里的每个 id 照旧登记（含当前不在视口、由 offscreenRecordActions 带进来的那些）：
      // 模型照着老习惯点名时不会落空，脚本模型 / 既有测试也不用跟着改。
      for (const record of folded.records) {
        const id = `${folded.template}${record}`;
        nameToId.set(toolNameOf(id), id);
        idToName.set(id, name);
      }
      continue;
    }

    const action = item.action;
    if (idToName.has(action.id)) continue;
    const name = unique(toolNameOf(action.id));
    nameToId.set(name, action.id);
    idToName.set(action.id, name);
    tools.push({
      type: "function",
      function: { name, description: describe(action), parameters: action.params },
    });
  }

  return { tools, nameToId, idToName, templates };
}

/**
 * 描述里带上原语 / 风险 / 保真度：
 * 模型据此判断「这个动作是读还是写」「点了会不会真生效」（low = 只是 DOM 模拟，效果未验证）。
 */
export function describe(action: ActionView): string {
  return `${action.description} (${describeTags(action).join(" / ")})`;
}

function describeFolded(folded: FoldedAction): string {
  const rowWord = folded.offscreen === 1 ? "row" : "rows";
  const offscreen =
    folded.offscreen > 0
      ? `; ${folded.offscreen} ${rowWord} outside the viewport (auto-scroll before execution)`
      : "";
  return (
    `${folded.description} (${describeTags(folded).join(" / ")})` +
    ` | Row actions of the same type are folded into one: pass record to choose a row (${folded.records.length} rows${offscreen}).`
  );
}

/** 工具描述里的标签：比文本清单那份多一个前缀（`原语: click`），工具列表里没有表头 */
function describeTags(action: {
  primitive: string;
  kind: string;
  approval: string;
  fidelity: string;
  scope?: string;
  scopePath?: string[];
  flowSteps?: number;
  handoff?: { reason: string };
}): string[] {
  const tags = [
    // 复合动作（S6a）：说「流程: N 步」而不是「原语: flow」——
    // 工具描述里那一栏要回答的是「这一条会自己走几段」，不是「它属于哪个原语」。
    action.flowSteps && action.flowSteps > 0 ? `flow: ${action.flowSteps} steps` : `primitive: ${action.primitive}`,
    `kind: ${action.kind}`,
  ];
  if (action.approval === "ask") tags.push("needs confirmation");
  if (action.approval === "ask-always") tags.push("always confirms");
  if (action.fidelity !== "high") tags.push(`fidelity: ${action.fidelity}`);
  if (action.handoff) tags.push("requires human");
  if (action.scopePath?.length) tags.push(`region: ${action.scopePath.join(" / ")}`);
  else if (action.scope) tags.push(`region: ${action.scope}`);
  return tags;
}
