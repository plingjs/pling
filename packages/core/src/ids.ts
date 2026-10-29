/**
 * 动作「形状」：把元素级 id 收敛成它所属的那一类动作。
 *
 *   approve@order:SO-1001  →  approve@order:
 *   remove@order:SO-1001   →  remove@order:
 *   remove@t4              →  remove@
 *   toggle_sort            →  toggle_sort
 *
 * 为什么需要它：pi 的 id 是**元素级**的（每行一个），一个 42 行列表就有 84 个 id。
 * 如果「本次会话内始终允许」按 id 记，用户点一次只授权了一行，等于没授权；
 * 按形状记才符合人的直觉：「允许审批订单」= 允许审批所有订单行。
 *
 * 风险边界：形状带着「动词 + 作用域」前缀，所以不会把「审批」和「删除」混成一类；
 * 而 danger 动作本来就不提供「始终允许」，所以最危险的那一类永远只批本次。
 */
export function actionShapeOf(id: string): string {
  return rowRefOf(id)?.template ?? id;
}

/**
 * 页面的 action id → 模型能用的 function name。
 *
 * 为什么需要：好用的 id 带结构（`approve@order:SO-1001`），而 OpenAI function name
 * 只接受 `[a-zA-Z0-9_-]` 且 ≤64 字符。这里只做「合法化」，**去重是协议层的事**
 * （同一份快照里可能撞名，见 `@plingjs/agent` 的 `buildProtocol`）。
 *
 * 放在 core 而不是协议层：文本清单（给模型看的那份）和工具 schema 必须用同一个名字，
 * 否则模型照着清单调用会调不到 —— 两边都要用，就不能只住在一层里。
 */
export const MAX_TOOL_NAME_LENGTH = 64;

export function toolNameOf(id: string): string {
  let name = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!/^[a-zA-Z]/.test(name)) name = `t_${name}`;
  return name.slice(0, MAX_TOOL_NAME_LENGTH);
}

/**
 * 行内动作 → 「模板 + 记录 id」。**这一层只拆形状，不判断记录是否真的存在**
 * （那是注册表 / 记录表的事：id 里出现 `@` 不代表它就是一行）。
 *
 *   remove@t4              → { template: "remove@",        record: "t4" }
 *   approve@order:SO-1001  → { template: "approve@order:", record: "SO-1001" }
 *   toggle_sort            → null（不是行内动作）
 *   remove@                → null（后面没有东西，拼不回去）
 *
 * 分隔符取**最后一个** `:` 或 `@` —— `approve@order:SO-1001` 里那个 `@` 是「动词 @ 作用域」，
 * 真正指向记录的是最后那一截。
 *
 * 用途：动作清单折叠（`remove@t1`…`remove@t9` → 一个 `remove { record }`）。
 * 折叠只在**记录表里确实有那一行**时发生 —— 有「读」的行，才有「写」的模板。
 */
export function rowRefOf(id: string): { template: string; record: string } | null {
  const cut = Math.max(id.lastIndexOf(":"), id.lastIndexOf("@"));
  if (cut <= 0 || cut >= id.length - 1) return null;
  return { template: id.slice(0, cut + 1), record: id.slice(cut + 1) };
}
