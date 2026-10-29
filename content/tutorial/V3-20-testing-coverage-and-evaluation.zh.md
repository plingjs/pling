---
id: V3-20
title: "测试、覆盖率与评测"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 测试、覆盖率与评测

“助手能不能用”其实是三个问题：

1. 动作是否真的改变了它声称要改变的业务状态？
2. 页面是否把应该开放给 Agent 的控件都声明清楚了？
3. 给定一句请求，Agent 是否会选择正确的动作并完成任务？

一种测试回答不了三个问题。单元测试能证明 `add_task` 会更新列表，却不能证明模型会选它；脚本对话能证明某条路径可用，却不能证明真实模型也会这样；覆盖率能发现未声明的按钮，却不能替你决定这个按钮是否该开放。

## 用业务状态测试动作

先测执行器。它不依赖模型，结果确定，声明写错时也能给出可定位的失败信息。

```ts
const result = await executor.execute(
  "add_task",
  JSON.stringify({ text: "Prepare the demo" }),
);

expect(result).toMatchObject({ result: { ok: true } });
expect(tasks.some((task) => task.text === "Prepare the demo")).toBe(true);
```

断言用户能观察到的状态。不要只断言工具返回了 `{ ok: true }`：动作可能返回成功，却改错了行，或者预期的 DOM 更新根本没有发生。

## 用回放模型测试对话机制

`createReplayLlm` 会按顺序返回预先写好的模型轮次。它适合测试循环、工具调用、确认和失败恢复，不需要网络，也不会受供应商波动影响。

```ts
const llm = createReplayLlm([
  { calls: [{ tool: 'add_task', args: { text: 'Prepare the demo' } }] },
  { content: 'Added.' },
]);

const loop = createAgentLoop({
  registry: pling.registry,
  policy: createPolicy(async () => true),
  llm,
  settle: defaultSettle,
});
```

模型是脚本化的。如果页面不再暴露 `add_task`，回放会得到 `ACTION_NOT_FOUND`，这正是这类测试要捕捉的回归。

回放测试不衡量模型好坏。它衡量模型周围的代码：上下文组装、工具分发、状态变化、策略闸门和停止条件。

## 把一次对话变成评测用例

`runEvaluation` 在运行外增加断言，并在用例之间重置状态。断言既要覆盖发生了什么，也要覆盖什么绝不能发生。

```ts
const report = await runEvaluation({
  run: (input) => loop.run(input),
  reset: () => {
    resetBusinessState();
    loop.reset();
  },
  hooks: loop.hooks,
  cases: [
    {
      name: 'add one task',
      input: 'Add a task to prepare the demo',
      expectIncludes: ['Added'],
      expectTools: ['add_task'],
      maxToolErrors: 0,
      verify: () => tasks.some((task) => task.text === 'Prepare the demo'),
    },
    {
      name: 'do not invent a bulk delete',
      input: 'Delete every task',
      expectNotTools: ['add_task'],
      maxToolErrors: 0,
    },
  ],
});
```

各字段的职责不同：

- `expectTools` 确认使用了预期能力。
- `expectNotTools` 捕捉不该出现的路径。
- `maxToolErrors: 0` 拒绝靠一路试错才碰巧成功的运行。
- `verify` 读取真实业务状态，而不是相信最后一句回答。
- `reset` 防止历史记录和业务数据串到下一个用例。

报告中的通过率不是模型通用分数。它描述的是这个页面、这组提示词和这组用例。

## 检查覆盖率，但不要把覆盖率当成授权

`inspectCoverage()` 会扫描已挂载 Vue 根节点内的可操作控件，并区分已声明、祖先分组、派生和缺失。

```ts
const report = pling.inspectCoverage();

expect(report.missing).toBe(1);
expect(report.targets).toContainEqual({
  element: 'button#export_csv',
  label: 'Export CSV',
  status: 'missing',
});
expect(pling.registry.snapshot().actions.map((action) => action.id)).not.toContain('export_csv');
```

最后一条断言最重要。缺失控件只是诊断信息，不会被注册成动作，也不会因为 DOM 兜底而悄悄可用。示例里的“Export CSV”按钮就是故意不声明的：报告能发现它，Agent 仍然调不到它。

覆盖率是评审工具。100% 不代表每个开放能力都安全，只代表扫描到的控件附近都有某种声明。声明本身仍需有清楚的说明、合适的风险等级和确认策略。

## 真实模型测试要与确定性测试分开

真实模型测试有价值，但它回答的是另一个问题：当前供应商模型面对这套提示词和这个页面时会怎样。它应当单独成组，并明确模型、密钥、预算和可接受的波动范围。

实践中的分层是：

| 层级 | 运行条件 | 能证明什么 |
| --- | --- | --- |
| 执行器测试 | 不需要模型 | 业务动作改对了状态 |
| 回放测试 | 脚本轮次 | 循环与工具边界接对了 |
| 覆盖率检查 | 不需要模型 | 页面明确交代了可用控件 |
| 评测 | 回放或真实模型 | 一组请求产生了可接受的动作与回答 |
| 真实模型冒烟 | 供应商 | 当前模型能跟随本页提示词 |

不要让真实模型测试成为唯一的回归测试。它更慢、有成本，而且供应商更新模型后结果会变化。

## 运行示例

```bash
pnpm tutorial:dev v3-20
```

打开 `http://127.0.0.1:5233/`。Todo 列表开放新增和逐行完成动作；导出按钮对人类可见，对 Agent 不可见。

确定性检查：

```bash
pnpm tutorial:check v3-20
```

测试覆盖覆盖率报告、`export_csv` 动作不存在、回放对话、评测报告，以及运行后的业务状态。

## 失败模式

**只测模型最后说了什么。** 一句可信的回答可能完全没有改动状态。要断言动作结果和用户能看到的状态。

**把 100% 覆盖率称为“安全”。** 覆盖率只说明控件被分类过，不说明描述清楚、风险等级正确，或者这个动作本来就该开放。

**多个用例复用同一份循环历史。** 第二个用例会继承第一个的上下文，可能因为错误原因而通过。历史和业务状态都要重置。

**把 `createReplayLlm` 当成排行榜。** 回放证明接线正确，不能说明模型是否理解页面。

**让诊断信息自动暴露控件。** 缺失控件应当触发一次评审决定：声明它、归入分组，或保持不可用。它绝不能自动变成工具。
