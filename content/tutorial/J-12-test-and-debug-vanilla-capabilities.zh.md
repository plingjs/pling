---
id: J-12
title: "测试与调试原生页面能力"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 测试与调试原生页面能力

一次 Agent 运行可能在不同位置出错，但在聊天窗口里看起来很像：控件从未声明、动作存在但当前不可用、模型选错了动作、动作已经执行却没有改变页面。有效的测试要先把这些情况分开，而不是只断言最后一句回答读起来是否合理。

示例是一个小型工作队列。页面仍用普通 DOM 处理交互，Pling 只增加一个区域、一个输入动作、一个提交动作，以及每行一个动作。下面的检查都针对同一页面。

## 先测三条边界

第一条是声明边界。测试直接读取注册表，确认页面实际公开了什么：

```ts
const snapshot = pling.registry.snapshot();

expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({ role: "main" });
expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
expect(snapshot.actions.map((action) => action.id)).toContain("composer_text");
expect(snapshot.actions.map((action) => action.id)).not.toContain("composer_submit");
```

最后一条不是附带检查。输入框为空时提交按钮不可用，因此该时刻的页面快照里不应出现提交动作。如果它仍然出现，页面和模型看到的就不是同一个状态。

第二条是执行边界。使用同一个注册表和确定性的策略，再检查业务对象与 DOM：

```ts
const executor = createExecutor({
  registry: pling.registry,
  policy: createPolicy(async () => true),
});

await executor.execute("composer_text", JSON.stringify({ text: "记录本次回归结果" }));
await executor.execute("composer_submit", "{}");

expect(tasks[0]).toMatchObject({ text: "记录本次回归结果", done: false });
expect(document.querySelectorAll(".task")).toHaveLength(4);
```

这项检查不启动模型循环，也不访问模型网关。它只回答一个更窄的问题：页面接受这个动作后，确实修改了界面正在渲染的那个业务对象吗？

第三条是 Agent 循环。用回放脚本替代远端模型：

```ts
const llm = createReplayLlm([
  { calls: [{ tool: "composer_text", args: { text: "验证请求轨迹" } }] },
  { calls: [{ tool: "composer_submit" }] },
  { content: "任务已经加入。" },
]);

await dock.runtime.session.send("添加一条名为“验证请求轨迹”的任务");
```

回放脚本使用与模型相同的工具协议。它会经过可用性计算、执行、结果回填和下一轮请求，但不会假装已经测试了自然语言理解能力。

## 查看真实请求

开发环境需要解释一次运行时，可以开启 `trace`：

```ts
createPling({
  agent: {
    trace: { maxCalls: 8 },
    config: { limits: { maxTurns: 100 } },
  },
});
```

轨迹默认关闭，并且有数量上限。每条记录包含这次请求实际发送的消息、function tools、页面快照、模型响应、状态、耗时和上下文估算。

```ts
const trace = dock.runtime.trace;

expect(trace?.calls).toHaveLength(3);
expect(trace?.calls[0]?.messages.map((message) => message.role)).toEqual(["system", "user"]);
expect(trace?.calls[0]?.tools.map((tool) => tool.function.name)).toContain("composer_text");
expect(trace?.calls[1]?.tools.map((tool) => tool.function.name)).toContain("composer_submit");
```

排查时按顺序回答四个问题：

1. 第一次请求里有没有用户指令？
2. 请求里有没有目标动作和当时可见的记录？
3. 下一次请求里有没有工具调用及其结果？
4. 页面最终状态是否与模型的结论一致？

轨迹仍包含会被发送到模型的上下文，因此上线环境应默认关闭；确实需要时，也要限制能打开它的人。

## 把失败也当作正常结果

模型网关可能离线，动作可能不可用，业务处理函数也可能拒绝某个值。这些是不同的结果，应分别断言。

示例会保留模型请求的结构化失败，而不是把它压缩成一句空回答：

```ts
await dock.runtime.session.send("你好");

expect(dock.runtime.trace?.calls[0]).toMatchObject({
  turn: 1,
  status: "error",
  error: { code: "LLM_FAILED", message: "gateway offline" },
});
```

如果产品确实依赖模型判断意图，可以保留一小组真实模型测试。把它和确定性测试分开运行，记录模型与提示词版本，不要让每次代码检查都依赖外部服务。

## 运行示例

```bash
pnpm tutorial:dev j-12
```

打开 `http://127.0.0.1:5277/?lang=zh`。页面同时保留人工操作和回放模型可使用的动作。

```bash
pnpm tutorial:check j-12
```

检查会执行类型检查、声明与执行测试、回放与轨迹测试、失败测试，并生成生产构建。

## 常见错误

**断言模型的完整原话。** 文案变化不等于行为回归。应断言页面状态、返回码、使用的工具，以及流程必需的消息。

**一上来就测真实模型。** 如果声明或执行层已经错了，真实模型只会放大噪声。先用确定性测试穿过这些层。

**在所有环境保留请求轨迹。** 轨迹会在内存里保存系统提示词和页面快照。它是调试工具，不是默认开启的日志。

**用固定等待代替可观察条件。** 应等待记录、结果或状态变化。任意延时会拖慢测试，而且仍然可能竞态。

下一步：[在存量 jQuery 应用中接入 Pling](/zh/vanilla/add-pling-to-an-existing-jquery-app)。
