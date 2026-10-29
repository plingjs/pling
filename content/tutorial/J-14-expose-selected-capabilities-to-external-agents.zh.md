---
id: J-14
title: "向外部 Agent 开放选定能力"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 向外部 Agent 开放选定能力

页面里的助手和外部 Agent 不应该各自实现一遍同一项业务操作。两者可以共用页面已有的动作执行器；真正不同的是发现方式与传输通道：外部客户端需要看到站点公开了哪些能力，并有一条受约束的协议入口可以调用它们。

Agent Surface 就是这条边界。它不是第二套动作系统，也不是浏览器自动化的后门。它只发布一组经过选择、已经在页面注册的动作，并让每次调用经过与页面助手相同的可用性、确认、成功判据和结果回执。

## 从页面能力开始，而不是从协议开始

示例页面有三项适合对外开放的业务操作：

- `todo.overview` 读取队列数量；
- `todo.add` 用受限文本新增一条任务；
- `todo.clear_completed` 删除已完成任务，并且必须确认。

页面也有行级完成控件，但它们不在外部白名单里。外部能力面比页面本身更窄，这是产品与安全决定，不是遗漏。

```ts
export const EXTERNAL_SCOPE = [
  "todo.overview",
  "todo.add",
  "todo.clear_completed",
] as const;
```

能力 id 应表达稳定的业务意图。选择器、行号或本地化按钮文案都不是能力名称。

## 复用同一个执行器

Surface 内核接收注册表的投影和一个执行函数：

```ts
const executor = createExecutor({
  registry,
  policy: createPolicy(confirm),
  settle: defaultSettle,
});

const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  app: "tutorial-support-queue",
  expose: EXTERNAL_SCOPE,
  session,
  recordLimit: 2,
});
```

这样执行路径只有一条。外部调用不会直接点击 DOM，不会调用私有处理函数，也不会绕过确认策略。页面动作不可用时，外部调用看到同一条原因；业务结果失败时，也返回同一类错误。

## describe 只描述应该公开的部分

外部客户端先调用 `describe`。响应包含协议版本、应用名、允许使用的能力，以及一个有界的上下文窗口。

```ts
const response = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req_01",
  method: "describe",
  input: { limit: 2 },
});
```

示例虽然页面上有三条记录，却只返回两条；能力清单也只包含白名单里的三项。`recordLimit` 与请求里的 `limit` 让上下文成本可控。更大的列表需要分页或搜索动作，协议不应因为页面里存在一张大表就序列化全部内容。

描述从实时注册表生成，不会序列化内部处理函数、DOM 选择器、会话 Cookie 或无关业务状态。

## invoke 有两类失败

请求可能在到达业务动作前就失败，因为能力没有开放：

```ts
{
  ok: false,
  error: { code: "CAPABILITY_NOT_EXPOSED", message: "..." }
}
```

也可能协议交换成功，而业务动作失败：

```ts
{
  ok: true,
  result: {
    error: { code: "PERMISSION_DENIED", message: "..." }
  }
}
```

客户端必须区分两者。只检查 `response.ok` 会把一次被拒绝的写入误报为成功。

示例直接尝试调用未开放的行级动作。请求在执行器之前被拒绝，任务保持不变。白名单之所以有意义，正因为这条路径默认关闭。

## 确认留在页面一侧

`todo.clear_completed` 是破坏性动作，声明为 `confirm: "always"`。外部客户端调用它时，执行器打开页面侧的确认通道并等待决定。

外部客户端不能批准自己的请求。用户会在页面里看到待确认操作。拒绝时，协议交换以 `PERMISSION_DENIED` 结束；允许时，现有业务处理函数只执行一次。

```ts
const pending = surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req_02",
  method: "invoke",
  capability: "todo.clear_completed",
});

// 页面负责渲染并收集确认结果。
const result = await pending;
```

确认界面必须留在应用内，而不是外部 Agent 的控制台里。客户端可以展示进度，但可信的决定界面仍属于已登录页面。

## 身份与传输放在内核之外

传给 Surface 的 `session` 必须已经验证。它包含 Agent id、会话 id、用户 id、过期时间和本次会话的能力范围，不包含密码、Cookie、OAuth token 或模型供应商密钥。

真正部署时仍需要传输适配器来处理：

- 用户与外部 Agent 的身份验证；
- 来源、请求体和 CORS 校验；
- 委托会话的创建、过期与撤销；
- 限流、防重放；
- 请求 id 与审计投递。

HTTP、MCP facade、postMessage 桥都可以承载同一套 `describe` / `invoke` 信封，但不应各自重写能力过滤和确认逻辑。

## 运行示例

```bash
pnpm tutorial:dev j-14
```

打开 `http://127.0.0.1:5279/?lang=zh`，或使用 `--locale zh`。右侧控制台只调用 `surface.handle()`，可以读取能力描述、新增任务、请求清理已完成任务。

```bash
pnpm tutorial:check j-14
```

检查覆盖能力白名单、记录窗口、成功写入、未开放能力、拒绝确认、允许确认，以及删除记录行后注销其剩余动作。

## 常见错误

**把所有已注册动作全部公开。** 外部能力面应是更小、更有意图的产品接口。页面可以有几十个控件，只开放三项操作并不奇怪。

**把同步传入的 session 当成身份验证。** session 只是数据，传输层必须先验证调用方，再交给 Surface。

**增加通用 click 或脚本方法。** 这会把能力面退化成浏览器自动化，白名单也就失去作用。

**把批准界面放到外部客户端。** 能批准自己高风险请求的客户端，没有提供真正的人工检查。

**返回整页快照。** 上下文应当有界、确定，并且只包含能力所需的信息。

返回 [原生 JS 与 jQuery 概览](/zh/vanilla/)，或阅读 [Agent Surface 简介](/zh/surface/)。
