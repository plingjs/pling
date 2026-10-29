---
id: R-15
title: "确认与人工接力"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 确认与人工接力

工作区设置页面里有三种操作。保存名称可以执行，但第一次需要用户明确同意；归档与重置每次都不可跳过；发布必须由本人输入验证码，Agent 不能代填。

这三种情况看起来都像“执行前停一下”，责任却不同。Pling 把它们分成两条独立边界：

- **确认（confirmation）**回答“是否允许 Agent 执行这个动作？”
- **人工接力（handoff）**回答“这一步是否已经由人完成？”

二者都由执行器处理，不依赖提示词。模型可以请求动作，但不能绕过用户决定，也不能把等待中的人工步骤说成已经完成。

## 用风险声明决定默认审批

动作的 `kind` 给出默认风险级别：

| `kind` | 默认行为 |
| --- | --- |
| `read` | 直接执行 |
| `write` | 直接执行 |
| `danger` | 每次都请求确认，不提供“始终允许” |

业务需要更严格的限制时，用 `confirm` 覆盖：

```tsx{6}
const saveToolRef = usePlingTool<HTMLButtonElement>({
  id: "save_workspace_name",
  desc: "保存共享的工作区设置。",
  kind: "write",
  confirm: true,
  run: saveName,
});
```

解析后的策略只有三种：

| 声明 | 审批策略 | 本次会话能否始终允许 |
| --- | --- | --- |
| `read` / `write`，未写 `confirm` | `none` | 不适用 |
| `write` + `confirm: true` | `ask` | 可以 |
| `danger`，或任意 `kind` + `confirm: "always"` | `ask-always` | 不可以 |

`confirm: false` 会移除审批闸门，只应在动作本身已有独立授权机制时使用。它不会降低业务风险。

示例中的归档与重置都声明为 `danger`。即使归档额外写了 `confirm: true`，结果仍是 `ask-always`；危险动作不会因为一次同意而获得永久许可。

## 审批发生在业务操作之前

模型提出动作后，执行器依次检查参数、作用域、可用性与审批策略。需要确认时，`<AgentDock>` 显示待审批项；用户拒绝后返回 `PERMISSION_DENIED`，动作的 `run` 不会执行。

这个顺序不能反转。先提交数据再询问用户，只是事后通知，不是授权。只在界面上隐藏危险按钮也不够：如果能力仍然出现在页面投影中，模型仍可能调用它。

审批通过后，应继续检查动作的业务结果。审批只表示“允许尝试”，不表示“已经成功”。

## 人工接力把最后一步留给用户

发布动作声明了 `handoff`，没有 `run`：

```tsx{5-12}
const publishToolRef = usePlingTool<HTMLButtonElement>({
  id: "publish_changes",
  desc: copy.publishDesc,
  kind: "danger",
  handoff: {
    reason: copy.publishReason,
    steps: [
      { text: copy.publishStepOne, highlight: "verification_code" },
      { text: copy.publishStepTwo, highlight: "publish_changes" },
    ],
    expect: { desc: copy.publishExpect, check: () => publishedRef.current },
  },
});
```

模型调用该动作时，执行器不会点击按钮，也不会猜验证码。它展示原因与步骤，高亮当前目标，再等待用户：

| 用户结果 | 执行结果 |
| --- | --- |
| 完成，且 `expect` 通过 | 返回成功回执 |
| 取消 | `HANDOFF_CANCELLED` |
| 超时 | `HANDOFF_TIMEOUT` |
| 声称完成，但页面状态没有变化 | `HANDOFF_FAILED` |

默认超时为五分钟，单个动作可以用 `handoff.timeout` 覆盖。超时或取消后，模型应询问用户下一步，而不是自动重试。

`expect` 读取真实的业务状态。示例在发布成功后更新 `publishedRef`，由它确认页面确实到达“已发布”状态。只检查用户是否点过“我已完成”，无法证明操作成功。

## 两种机制不要叠加

带有 `handoff` 的动作不会再弹出确认审批。人工完成这一步本身就是决定；再要求“先批准、再完成”只会让人分不清哪次操作真正授权了变更。

| 情况 | 使用 |
| --- | --- |
| Agent 可以做，但应先征得同意 | `confirm: true` |
| 危险操作必须每次询问 | `kind: "danger"` 或 `confirm: "always"` |
| 必须由人输入信息、使用设备或承担法律责任 | `handoff` |
| 需要指出给人操作的字段 | 指引目标配合 `handoff.steps` |

如果 Agent 能完成全部业务操作，只缺一次授权，用确认。如果最后一步只能由人完成，用人工接力。

## 验证

启动示例：

```bash
pnpm tutorial:dev r-15 --locale zh
```

打开 `http://127.0.0.1:5255/?lang=zh`，依次检查：

示例源码位于 `examples/tutorials/r-15-confirmation-and-human-handoff`，直接使用工作区中的 Pling 包，没有复制框架实现。

1. 让助手保存工作区名称。首次请求会出现审批；允许后，动作才执行。
2. 让助手归档工作区。每次都会询问，且没有“始终允许”。
3. 拒绝一次归档。助手应报告操作未获许可，不应声称已归档。
4. 让助手发布变更。页面进入人工接力，高亮验证码与发布按钮，不会代替用户填写。
5. 取消接力。助手应报告这一步没有完成。
6. 输入 `246810` 并发布。只有页面状态变为“已发布”后，助手才收到成功结果。

确定性检查覆盖三种审批策略、拒绝后不执行、接力取消、成功回执与双语文案：

```bash
pnpm tutorial:check r-15
```

## 常见错误

**把 `danger` 当成完整的风险判断。** 风险级别不知道操作是否可逆、是否受监管，也不知道当前用户是否有权执行。声明必须反映真实业务。

**先执行业务写入，再请求确认。** 这种确认没有阻止任何事情。闸门必须在副作用之前。

**由 Agent 模拟人工步骤。** 不要暗中填写验证码或点击“本人确认”。声明为人完成，就必须等待或安全失败。

**省略成功判据。** 用户打开弹窗、点了完成，都不等于业务状态已经变化。应检查最终数据、路由或页面状态。

**把拒绝当作临时故障。** `PERMISSION_DENIED`、`HANDOFF_CANCELLED` 与 `HANDOFF_TIMEOUT` 是用户决定或边界。不要静默循环重试。
