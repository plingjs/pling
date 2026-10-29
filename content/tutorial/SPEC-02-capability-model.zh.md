---
id: SPEC-02
title: "能力模型"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 能力模型

能力是页面愿意让外部调用方执行的一项业务操作。它不是按钮、DOM 节点或任意函数。能力描述说明“能做什么”，执行器决定“此刻是否允许、是否成功”。

## 必需字段

每项能力必须包含：

| 字段 | 要求 |
| --- | --- |
| `id` | 非空、在当前应用内稳定，并在会话范围内唯一 |
| `description` | 面向调用方的业务说明，不得包含用户生成内容作为指令 |
| `effect` | `read`、`write` 或 `destructive` |

`inputSchema` 可以省略，表示能力不接受参数。若存在，它必须是 JSON Schema 对象，只描述该动作的参数，不暴露内部选择器或凭证。

## 可选字段

| 字段 | 含义 |
| --- | --- |
| `approval` | `none`、`ask` 或 `always`；省略等价于 `none` |
| `fidelity` | 目标解析可信度；省略表示 `high` |
| `source` | `declared` 或 `derived`；省略表示开发者直接声明 |
| `scopePath` | 能力所属区域的层级路径 |
| `handoff` | 该步骤必须由人完成，并给出原因 |
| `flowSteps` | 复合动作包含的步数 |
| `offscreen` | 目标当前不在视口，但可按记录 id 引用 |
| `record` | 行内动作折叠为模板时的记录参数与覆盖数量 |

这些字段描述调用风险与执行条件，不是授权本身。`approval: none` 不表示后端无需鉴权；`effect: read` 也不表示数据可以无条件公开。

## 标识与稳定性

能力 id 必须由应用定义，例如 `task.add`、`order.update_note@order`。调用方不得从按钮文案临时推导 id，也不得假定某个 id 在导航后仍然存在。

同一业务操作在不同适配器中应保持相同含义。适配器可以改变安装方式，不得为同一操作发明相互矛盾的 schema 或风险级别。

标记为 `destructive` 的能力应在执行前满足应用的确认策略。能力被隐藏或被拒绝时，调用方必须停止，而不是寻找另一个相似 id 绕过限制。

## 行内动作模板

当列表中的每一行都有同类操作时，能力面可以用模板 id 表示，例如：

```json
{
  "id": "order.update_note@order",
  "description": "更新指定订单的备注",
  "effect": "write",
  "inputSchema": {
    "type": "object",
    "properties": { "note": { "type": "string" } },
    "required": ["note"]
  },
  "record": { "param": "record", "total": 48, "offscreen": 12 }
}
```

调用时必须把目标记录放在 `input.record`。模板 id、记录 id 与其余参数一起交给现有执行器；协议层不得拼接选择器。记录不存在、被筛选掉或不属于当前会话时，调用失败。

模板说明应描述这一类行的动作，不能写入某一条记录的名称，否则筛选变化后会产生误导。

## 暴露范围

站点级暴露范围与已验会话作用域取交集：

```text
可见能力 = 站点 expose ∩ 会话 scope ∩ 当前注册表
```

`describe` 与 `invoke` 必须使用同一交集。只在一个方法中过滤是权限漏洞。作用域变化后，旧的能力清单不能继续作为授权依据。

## 默认拒绝的边界

以下内容不得成为能力：

- 任意选择器点击；
- 任意脚本执行；
- 原始 DOM 或完整 store 读取；
- 读取 Cookie、JWT、委托 token 或模型密钥；
- 绕过确认、人工接力或后端授权的“管理员操作”。

若业务任务无法由已声明能力表达，应提供新的业务能力或转人工流程，而不是增加通用逃逸口。
