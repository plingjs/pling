---
id: R-20
title: "测试、覆盖率与评测"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 测试、覆盖率与评测

“助手能工作”可能指三件不同的事。一个已声明的动作可能没有修改它承诺修改的状态；一个可见控件可能从未被分类给 Agent；页面接线也可能完全正确，但某个模型针对具体请求选错了动作。

这些问题需要分开验证。执行器测试不能说明模型会不会选这个动作；脚本化对话不能证明每个控件都有明确策略；覆盖率报告也不能证明已暴露的动作是安全的。

这一章仍然使用小型 Todo 页面，并刻意留下一个覆盖率缺口。缺口让读者能直接观察“被检测到”和“对 Agent 可用”之间的区别。

## 用可观察状态验证动作

从模型下面一层开始。执行器是确定性的；它失败时，问题在声明或业务函数里，而不在模型行为里。

```ts
const result = await executor.execute(
  "add_task",
  JSON.stringify({ text: "Prepare the demo" }),
);

expect(result).toMatchObject({ result: { ok: true } });
expect(document.body.textContent).toContain("Prepare the demo");
```

React 页面需要等组件完成提交，再读取 DOM。在 Vitest 里，用 `act` 包住断言边界即可：

```ts
await act(async () => {});
expect(document.querySelector(".task")?.textContent).toContain("Prepare the demo");
```

断言用户能看见的状态，而不只是执行器返回值。动作可能报告成功，却改了错误的行，或组件根本没有渲染新状态。

## 用回放模型验证对话机制

`createReplayLlm` 按预设顺序返回模型轮次。它去掉了供应商差异，同时保留页面测试真正关心的链路：上下文组装、工具选择、执行、状态更新和停止条件。

```ts
const llm = createReplayLlm([
  { calls: [{ tool: "add_task", args: { text: "Prepare the demo" } }] },
  { content: "Added." },
]);

const loop = createAgentLoop({
  registry: pling.registry,
  policy: createPolicy(async () => true),
  llm,
  settle: async () => {
    flushSync(() => {});
    await act(async () => {});
  },
});
```

`flushSync` 在 React 里不可省略。两轮脚本之间，React 必须先提交动作产生的状态更新，下一轮才能读到最新的注册表或 DOM。否则测试看到的是尚未重新渲染的旧页面。

回放模型不衡量模型质量。它衡量模型周围的代码。如果 `add_task` 消失，回放会得到 `ACTION_NOT_FOUND`，这正是测试应该发现的回归。

## 把一次对话变成评测用例

`runEvaluation` 为每次运行增加断言，并在用例之间调用 `reset`。页面和对话都要重置；否则第二个用例会继承第一个用例的历史。

```ts
const report = await runEvaluation({
  run: (input) => loop.run(input),
  reset: () => {
    app.current?.reset();
    loop.reset();
  },
  hooks: loop.hooks,
  cases: [
    {
      name: "add one task",
      input: "Add a task to prepare the demo",
      expectIncludes: ["Added"],
      expectTools: ["add_task"],
      maxToolErrors: 0,
      verify: () => app.current?.getTasks().some(
        (task) => task.text === "Prepare the demo",
      ) === true,
    },
    {
      name: "do not invent a bulk delete",
      input: "Delete every task",
      expectNotTools: ["add_task"],
      maxToolErrors: 0,
    },
  ],
});
```

每个字段只回答一个问题：

- `expectTools` 确认使用了预期能力。
- `expectNotTools` 捕获编造或不安全的路径。
- `maxToolErrors: 0` 拒绝靠反复试错才成功的运行。
- `verify` 读取真实业务状态，而不是相信最后一句回复。
- `reset` 防止页面数据和对话历史在用例之间泄漏。

报告给出的是这些用例在这个页面上的通过率，不是模型的通用评分。

## 查看覆盖率，但不要把它当成权限

`inspectCoverage()` 扫描已挂载应用，检查可交互控件是否经过分类。报告区分直接声明、可选的自动派生、挂在前辈声明下的控件，以及完全没有声明的控件。

```ts
const report = pling.inspectCoverage(document.querySelector("main"));

expect(report.missing).toBe(1);
expect(report.targets).toContainEqual({
  element: "button#export_csv",
  label: "Export CSV",
  status: "missing",
});
expect(pling.registry.snapshot().actions.map((action) => action.id))
  .not.toContain("export_csv");
```

最后一条断言才包含安全决定。缺失控件只是诊断信号，不会自动注册，也不会通过 DOM 兜底暴露。页面里的“Export CSV”按钮仍然能由人使用，Agent 仍然不能调用它。

页面里有多个挂载面时，应传入应用根节点。React 适配器默认扫描 `document.body`；单应用页面足够方便，嵌入式组件则应缩小范围。

覆盖率是审查工具。100% 只表示检测到的控件附近都有分类，不表示说明清楚、风险等级正确，或者这些控件本来就应该开放给 Agent。

## 保持测试分层

| 层次 | 运行条件 | 证明什么 |
| --- | --- | --- |
| 执行器测试 | 不需要模型 | 动作改变了人能观察到的状态 |
| 回放测试 | 脚本化轮次 | 上下文和工具分发接线正确 |
| 覆盖率检查 | 不需要模型 | 每个检测到的控件都有明确决定 |
| 评测 | 回放或真实模型 | 一组定义好的请求产生可接受的行动和回答 |
| 真实模型冒烟测试 | 供应商 | 当前模型今天能遵循这个页面的提示 |

不要让真实模型测试成为唯一的回归测试。它更慢、会产生费用，也会随供应商更新模型而变化。它适合了解当前模型表现，不适合替代确定性检查。

## 运行示例

英文：

```bash
pnpm tutorial:dev r-20
```

中文：

```bash
pnpm tutorial:dev r-20 --locale zh
```

打开 `http://127.0.0.1:5260/`。待办列表开放一个新增动作，以及每行一个完成动作。“导出 CSV”按钮刻意没有声明。

源码位于 `examples/tutorials/r-20-testing-coverage-and-evaluation`。

发布等价检查：

```bash
pnpm tutorial:check r-20
```

它会验证覆盖率缺口、`export_csv` 没有被注册、回放对话、评测结果，以及运行后的业务状态。

## 常见失败

**只断言最后一句回复。** 有说服力的回答可以和零状态变化同时存在。要检查动作结果和渲染后的页面。

**在用例之间复用对话历史。** 第二个用例可能因为继承第一个用例的上下文而“通过”。对话与页面都需要重置。

**在 React 提交前断言。** 脚本轮次之间要先 flush 并等待组件更新，否则读到的注册表或 DOM 是旧结果。

**把覆盖率当成授权。** 覆盖率只说明控件曾被分类，不说明分类本身安全或合理。

**把缺失控件警告变成自动动作。** 警告之后的正确动作是人工复核：补声明、归组，或明确保持不开放。
