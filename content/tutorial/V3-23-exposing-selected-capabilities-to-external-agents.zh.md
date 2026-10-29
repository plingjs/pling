---
id: V3-23
title: "向外部 Agent 开放选定能力"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 向外部 Agent 开放选定能力

页面内助手和外部 Agent 的生命周期不同。页面助手属于应用，共享当前页面会话；外部 Agent 可能是另一个进程、另一个浏览器，或用户已经信任的编程工具。它不应拿到页面的 DOM、组件状态或内部事件处理函数。

Surface 在页面已有的能力模型上再加一层更窄的契约。外部客户端可以发现一组选定的动作，再调用它们。真正的执行仍经过页面的注册表、策略和确认通道。

示例把协议客户端放在同一页面里，便于观察完整的请求与响应。它使用的是独立进程也应遵循的同一套协议，但这里没有网络信任边界。传输与身份验证放在协议之后单独说明。

完整路径可以拆成下面几层。示例重点实现中间三层，最上面的传输层在部署时接入：

```text
外部客户端
  │ describe / invoke
  ▼
传输层：来源校验、身份、限流、防重放
  ▼
Surface：站点白名单与会话 scope
  ▼
执行器：可用性、参数、确认、成功判据
  ▼
页面已有的业务动作
```

## 用现有能力注册表构造一个 Surface

白名单包含三个动作：

```ts
export const EXTERNAL_SCOPE = [
  "todo.overview",
  "todo.add",
  "todo.clear_completed",
] as const satisfies SurfaceExpose;
```

这些动作已经由页面登记。Surface 不复制它们的实现，而是接收同一个注册表，按同一套策略构造第二个执行器，并把每次调用限制在白名单内：

```ts
export function createTodoSurface(
  registry: Registry,
  confirm: Confirm,
  sessionScope: SurfaceExpose = EXTERNAL_SCOPE,
) {
  const executor = createExecutor({
    registry,
    policy: createPolicy(confirm),
    settle: defaultSettle,
  });

  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    app: "tutorial-todo-surface",
    expose: EXTERNAL_SCOPE,
    session: {
      agentId: "demo-external-agent",
      sessionId: "demo-session",
      userId: "demo-user",
      expiresAt: Date.now() + 60 * 60_000,
      scope: sessionScope,
    },
    recordLimit: 2,
  });

  return { executor, surface };
}
```

`expose` 是站点级上限。会话还带自己的 scope，最终可用集合是两者的交集。示例里的固定会话只用于演示；生产环境中的会话必须来自经过验证的传输层或后端，不能取自客户端可编辑的字段。

页面在 `setup` 里把 `usePling().registry` 和确认函数传给 `createTodoSurface`，再把返回的 `surface` 交给外部控制台：

```ts
const pling = usePling();
const approval = createApproval();
const { surface } = createTodoSurface(pling.registry, approval.confirm);
```

这里的 `createApproval` 是示例自己的页面确认队列，不是框架导出的通用 API。控制台只持有 `surface`，不接触页面组件里的待办数组。示例为了把外部调用链路显示清楚，单独准备了这条确认路径；如果产品已经有统一的页面确认组件，也可以把同一个 `Confirm` 同时交给页面助手和 Surface。关键是确认界面留在页面一侧，不能交给外部客户端。

构造第二个执行器也是必要的：Surface 不直接调用业务处理函数，它走与页面助手相同的可用性、参数校验、确认、成功判据和变更证据。它不是拿页面助手的执行器对象来复用，而是用同一个注册表和策略构造一条等价的执行路径。

## 用 `describe` 读取一份投影

外部客户端发送标准协议包络：

```ts
const response = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req_01",
  method: "describe",
  input: { limit: 2 },
});
```

示例有三条待办，`recordLimit` 为 2。结果刻意把“能引用哪些记录”和“先取多少字段”分开：

- `context.records` 返回两条带字段的记录；
- `context.recordIds` 仍列出全部三条记录 id；
- `context.recordWindow` 给出当前窗口、总数和下一页位置。

长列表尤其需要这层区分：客户端可以先知道当前工作集，再按 id 精读某一条。记录窗口限制的是字段数据，不是客户端引用记录的能力。

`describe` 还返回协议版本、应用名，以及白名单内能力的 id、说明、输入 schema、影响等级和确认策略。页面里存在行删除和勾选动作，但它们不在这次投影里。对外能力面是产品决策，不是注册表的全量导出。

描述每次从实时注册表生成。内部处理函数、DOM 选择器和无关状态不会被序列化。

## 通过策略路径调用能力

调用时指定描述中的能力 id 和输入：

```ts
const result = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req_02",
  method: "invoke",
  capability: "todo.add",
  input: { text: "Follow up with the external agent" },
});
```

Surface 先检查请求、站点白名单、会话 scope 和防重放，再把调用交给执行器。执行器随后检查动作可用性、参数、确认、成功判据和证据。Surface 本身不会查找 DOM，也不会直接修改业务状态。

客户端必须处理两种不同的失败形态。

未开放的能力是协议失败：

```ts
{
  protocol: "pling.surface/0.1",
  id: "req_03",
  ok: false,
  error: { code: "CAPABILITY_NOT_EXPOSED", message: "..." }
}
```

能力已开放，但页面拒绝执行，则协议交换成功，动作结果失败：

```ts
{
  protocol: "pling.surface/0.1",
  id: "req_04",
  ok: true,
  result: {
    error: { code: "PERMISSION_DENIED", message: "..." }
  }
}
```

这个区别是刻意的。`CAPABILITY_NOT_EXPOSED` 表示请求根本没到业务动作；`PERMISSION_DENIED` 表示动作存在，但被策略或用户拒绝。只检查 `response.ok` 的客户端会把一次被拒绝的写入误报为成功。

这一层没有 `click(selector)`、`eval(script)` 或任意 JavaScript 方法。加入它们，能力契约就会退化成浏览器自动化，白名单也不再可执行。

## 确认留在页面一侧

`todo.clear_completed` 是破坏性动作，声明为 `confirm: "always"`。外部客户端调用它时，执行器打开页面侧的确认通道并等待。

页面上的操作者能看到待确认请求。若拒绝，协议调用返回 `ok: true`，并在 `result.error.code` 中给出 `PERMISSION_DENIED`，待办保持不变；若允许，同一个业务处理函数才执行，响应再报告执行结果。

这条路径保证：

- 外部 Agent 不能批准自己的破坏性动作；
- 确认绑定当前页面会话与具体动作；
- 页面助手与外部客户端遵循同一套策略语义，各自保留页面侧的确认界面；
- 完成证据来自业务状态，而不是模型最后一句“已完成”。

密码、Cookie、模型供应商密钥和审批令牌都不应出现在 Surface 响应里。真实传输层应把这些留在自己一侧，只把已验证的会话身份交给协议内核。

## 传输与鉴权放在 Surface 外面

示例在同一页面里直接调用 `surface.handle()`，因此没有网络信任边界。部署时仍需要传输层：HTTP/SSE、postMessage 桥、MCP facade，或宿主支持的其他通道。

传输层负责：

- 来源校验与 CORS 策略；
- 用户与 Agent 的身份验证；
- 会话创建、过期与撤销；
- 限流、防重放和请求体大小限制；
- 关联 id 与审计投递。

Surface 只负责能力投影和 `describe` / `invoke` 边界。它不监听端口，也不另造一套权限系统。把职责分开，同一组页面能力才能同时服务页面助手、编程 Agent 或未来的系统级 Agent，而不必复制业务逻辑。

## 运行示例

运行英文示例：

```bash
pnpm tutorial:dev v3-23
```

打开 `http://127.0.0.1:5236/`。运行中文示例：

```bash
pnpm tutorial:dev v3-23 --locale zh
```

打开 `http://127.0.0.1:5236/?lang=zh`。

右栏是本地协议客户端；它只通过 Surface 获取数据和调用动作，不读取页面组件里的待办数组。它可以描述能力、用 `todo.add` 新增待办、尝试未开放的行删除，以及发起需要页面侧决定的清除流程。确认对话框由页面渲染，不由右栏控制。

确定性检查：

```bash
pnpm tutorial:check v3-23
```

测试验证白名单、协议版本、记录窗口、未开放能力的 fail-closed 调用、会话 scope 交集，以及拒绝和批准两条确认路径。

## 常见问题

**把全部已注册动作直接发布出去。** `expose` 应体现产品决策。外部能力面通常比页面助手更窄，也可以独立演进。

**把会话对象当成身份验证。** 客户端可以发送任意对象。传输层必须先验证身份，再交给 Surface。

**开放通用 DOM 操作。** 如果方法接受任意选择器或脚本，白名单就保护不了任何东西。应发布业务能力。

**把确认放到外部客户端。** 如果客户端能批准自己的高风险请求，页面侧的闸门就只是摆设。确认通道必须留在受信任的应用边界内。

**记录完整输入与响应。** 审计元数据应包含会话、能力、结果和请求 id，而不是把敏感页面数据复制进长期日志。
