---
id: RCP-05
title: "危险操作与确认"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 危险操作与确认

“删除前问一下”不是单一功能。它同时包含风险声明、界面确认、服务端授权与审计记录。Pling 可以协调前两项，不能替代后两项。

这篇配方定义一个每次都要确认的删除操作，把决定交给宿主应用处理，并在用户拒绝时按失败处理。

## 可运行页面

下面的报告页把归档声明为危险动作，并为每次调用重新请求确认。拒绝不会触发业务函数，允许也只执行一次。

<DemoPlayground id="recipe-danger-confirm" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-danger-confirm/?lang=zh`。源码在 `examples/demos/recipe-danger-confirm/`；页面使用本地状态验证确认边界，不依赖后端。

## 标记风险

`kind` 描述动作的性质；`confirm` 覆盖该动作的默认确认策略。

| 声明 | 含义 |
| --- | --- |
| `kind: "danger"` | 删除、不可逆或影响范围异常大的动作 |
| `confirm: true` | 执行前通过应用的确认通道询问 |
| `confirm: "always"` | 每次调用都询问，不提供会话级“总是允许” |
| `handoff` | 由用户亲自完成，框架不执行该步骤 |

默认策略是 `defaultApproval: "danger"`：只读与写入直接执行，危险动作询问。结果异常敏感的只读动作，例如导出全部客户数据，也可以用 `confirm: true`。

## 删除动作

### Vue 3

```vue
<button
  v-tool="{
    id: `delete_order@${order.id}`,
    desc: `Delete order ${order.id} for ${order.customer}`,
    kind: 'danger',
    confirm: 'always'
  }"
  @click="deleteOrder(order)"
>
  Delete
</button>
```

### React

```tsx
function DeleteButton({ order }: { order: Order }) {
  const remove = usePlingTool<HTMLButtonElement>({
    id: `delete_order@${order.id}`,
    desc: `Delete order ${order.id} for ${order.customer}`,
    kind: "danger",
    confirm: "always",
  });

  return <button ref={remove} onClick={() => deleteOrder(order)}>Delete</button>;
}
```

### 原生 JS / jQuery

```ts
pling.tool(deleteButton, {
  id: `delete_order@${order.id}`,
  desc: `Delete order ${order.id} for ${order.customer}`,
  kind: "danger",
  confirm: "always",
});

$(deleteButton).on("click", () => deleteOrder(order));
```

### Vue 2.7

```vue
<button
  v-tool="{
    id: `delete_order@${order.id}`,
    desc: `Delete order ${order.id} for ${order.customer}`,
    kind: 'danger',
    confirm: 'always'
  }"
  @click="deleteOrder(order)"
>
  Delete
</button>
```

可见按钮与 agent 必须调用同一个业务函数。该函数仍要认证用户，并检查这笔订单是否允许删除。聊天里的确认不能替代这项检查。

## 确认通道

内置界面会显示待确认动作的说明与风险等级，不显示原始 `request.args`。审批者需要核对业务值时，应提供自定义审批界面，只渲染经过裁剪与脱敏的字段。用户可以批准一次、拒绝，或在允许时选择当前会话的“总是允许”。`confirm: "always"` 会移除该动作的最后一个选项。

运行时的 `gate` 决定是否提供确认通道：

```ts
const pling = createPling({
  agent: {
    gate: () => approvalUiAvailable.value,
    approvalTimeoutMs: 60_000,
  },
});
```

`gate` 返回 `false` 时，所有动作都不等待，包括危险动作。它只适合确认由另一层可靠提供的受控自动化环境。不要为了让演示更顺而关闭它。

确认超时按拒绝处理。确认期间关闭弹窗、丢失会话或发生导航，也必须 fail closed。

## 确认与人工接力

agent 能执行、用户只需要同意时，用确认。agent 不能安全模拟、必须由用户亲自完成时，用人工接力。

```vue [Vue 3]
<button
  v-tool="{
    id: 'submit_export',
    desc: 'Submit the export after the owner enters the one-time code',
    kind: 'danger',
    handoff: {
      reason: 'Enter the one-time code and submit the export yourself',
      expect: {
        desc: 'The export job exists',
        check: () => exportJobId !== null
      },
      timeout: 300000
    }
  }"
  @click="submitExport()"
>
  Submit export
</button>
```

```tsx [React]
function SubmitExportButton() {
  const submit = usePlingTool<HTMLButtonElement>({
    id: "submit_export",
    desc: "Submit the export after the owner enters the one-time code",
    kind: "danger",
    handoff: {
      reason: "Enter the one-time code and submit the export yourself",
      expect: { desc: "The export job exists", check: () => exportJobId !== null },
      timeout: 5 * 60_000,
    },
  });

  return <button ref={submit} onClick={() => submitExport()}>Submit export</button>;
}
```

```ts [原生 JS / jQuery]
pling.tool(submitButton, {
  id: "submit_export",
  desc: "Submit the export after the owner enters the one-time code",
  kind: "danger",
  handoff: {
    reason: "Enter the one-time code and submit the export yourself",
    expect: { desc: "The export job exists", check: () => exportJobId !== null },
    timeout: 5 * 60_000,
  },
});

submitButton.addEventListener("click", () => submitExport());
```

```vue [Vue 2.7]
<button
  v-tool="{
    id: 'submit_export',
    desc: 'Submit the export after the owner enters the one-time code',
    kind: 'danger',
    handoff: {
      reason: 'Enter the one-time code and submit the export yourself',
      expect: { desc: 'The export job exists', check: () => exportJobId !== null },
      timeout: 300000
    }
  }"
  @click="submitExport()"
>
  Submit export
</button>
```

四个适配器都会把这次操作作为一个工具交给模型；执行暂停，直到用户标记人工步骤完成或请求超时。`handoff` 是元素动作选项，不是函数级动作选项；需要时使用真实控件或应用自己的包装层，不要把动作写成能自行执行。

按钮的点击处理仍然是用户真正要完成的业务步骤。`handoff` 只暂停 agent，不替代按钮自己的提交逻辑，也不证明提交成功；结果由 `expect` 检查。

## 记录什么

宿主侧的审计记录至少应包含：

- 动作 id 与可读说明；
- 脱敏后的参数；
- 请求用户与会话 id；
- 确认决定、时间与决定者；
- 执行结果或拒绝原因；
- 请求发生时的页面或路由。

审批策略会收到请求并返回决定，但 Pling 不持久化审计记录。界面事件流便于调试，不是不可篡改的审计日志。操作涉及法律、资金或安全后果时，应把审批决定与执行结果保存到浏览器之外。

## 常见失败

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 删除没有任何提示就执行 | 动作被标成 `read` / `write`，`confirm` 被关闭，或 gate 被关闭 | 标为 `danger` 并设置 `confirm: "always"` |
| 用户拒绝后模型仍说“已删除” | 结果处理把 rejected promise 当成功 | 原样返回拒绝结果，并要求成功判据 |
| 同一个危险动作反复询问 | `confirm: "always"` 本来就是该行为 | 只在策略允许时使用会话级批准 |
| 确认一次却执行了两次删除 | 重试或重复提交不是幂等的 | 使用幂等键，并在运行期间禁用动作 |
| 用户批准了错误的行 | 说明缺少业务身份 | `desc` 同时写明记录 id 与可识别名称 |
| 弹窗遮住页面，底层动作仍可调用 | 没有声明区域可见性 | 把控件放进弹窗区域，并停用底层区域 |

## 安全边界

确认回答“当前会话的操作者是否同意这次调用”，不回答“这个人是否有权删除这条记录”。服务端必须检查身份、租户、角色、对象归属与当前状态。

确认文案必须来自应用，不能由模型自由生成。否则提示词注入可以描述一件无害的事，而实际参数执行破坏性操作。

## 证据

- 确认队列与超时：`packages/agent/src/approval-queue.ts`。
- 确认策略：`packages/core/src/policy.ts`。
- 本方案的可运行源码：`examples/demos/recipe-danger-confirm/`。

## 本地验证

让助手归档 `RPT-31`，先在确认框中选择拒绝，确认记录仍在；再重复请求并允许。结果日志应只在允许后出现一条，且两次决定都对应各自的请求，不能靠模型文字推断业务已执行。

