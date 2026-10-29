---
id: RCP-03
title: "表单填写、校验与提交"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 表单填写、校验与提交

让 agent 填三个字段再点“保存”并不难，难的是说清它能提交什么、校验由谁负责，以及“按钮点到了”和“记录真的创建了”之间的差别。

这篇配方把表单当作一次业务操作。模型提供值，应用仍然掌握校验与持久化。

## 可运行页面

下面的发票表单分别测试字段校验、提交期间的不可用状态、业务策略拒绝与成功回执。模型可以填值，但不能绕过应用自己的判断。

<DemoPlayground id="recipe-form-validation" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-form-validation/?lang=zh`。源码在 `examples/demos/recipe-form-validation/`；示例不依赖后端，服务端拒绝路径由页面中的业务策略模拟。

## 任务

用户说：

> “新建一个客户：Northwind，邮箱 ops@northwind.example，Pro 套餐。”

页面暴露一个 `create_customer` 动作，包含三个必填参数；同时暴露一个小型只读视图，说明表单是否已修改、是否正在提交、是否因校验而不可用。

除非用户确实需要逐个字段编辑，否则不要为每个输入框各做一个动作。一次操作只给模型一个成功判据，也只给应用一个完整校验入口。

## 声明一次操作

```ts
useAgentTool({
  id: "create_customer",
  desc: "Create a customer from the customer form",
  kind: "write",
  params: [
    { name: "name", label: "Customer name", minLength: 2, maxLength: 80 },
    { name: "email", label: "Contact email", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    { name: "plan", label: "Subscription plan", values: ["starter", "pro"] },
  ],
  available: () => (submitting.value ? "A save is already in progress" : true),
  run: async (args) => {
    await saveCustomer({
      name: String(args.name),
      email: String(args.email),
      plan: String(args.plan),
    });
  },
  expect: {
    desc: "The new customer appears in the table",
    check: () => rows.value.some((row) => row.id === savedCustomerId.value),
  },
});
```

参数契约在 `run` 之前执行。缺字段、邮箱形状不合法、套餐不在 `starter / pro` 内，都会返回 `INVALID_PARAMS`，业务函数不会被调用。

`available` 回答另一个问题：这次操作能否开始。它不是参数校验的替代品。表单被禁用、工作区只读、已有一次保存在进行中，才属于这个位置。

`expect` 补上页面更新的最后一段。它只在 `run` 成功结束后运行，并等待可观察的业务结果。`run` 里的服务端拒绝会报告为 `EXECUTION_FAILED`；页面结果始终不出现才返回 `EXPECTATION_FAILED`。

## 暴露表单状态，但不重复敏感值

```ts
useAgentState(
  "customer_form",
  () => ({
    dirty: formIsDirty.value,
    submitting: submitting.value,
    invalidFields: invalidFields.value,
    lastSaveFailed: lastError.value !== null,
  }),
  {
    description: "Customer form status; values are not repeated in page state",
  },
);
```

这组状态回答“为什么现在不能提交”，但不会把邮箱、电话或备注再复制进模型上下文。需要提醒哪些字段有问题时，暴露字段名，不暴露字段内容。模型确实需要比较新旧值时，应提供有界的、明确设计的差异视图。

## 各适配器实现

### Vue 3

```ts
import { ref } from "vue";
import { useAgentState, useAgentTool } from "@plingjs/vue";

const submitting = ref(false);
const savedCustomerId = ref<string | null>(null);

useAgentTool({
  id: "create_customer",
  desc: "Create a customer from the customer form",
  kind: "write",
  params: [
    { name: "name", label: "Customer name", minLength: 2 },
    { name: "email", label: "Contact email", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    { name: "plan", label: "Plan", values: ["starter", "pro"] },
  ],
  available: () => !submitting.value,
  run: async (args) => {
    submitting.value = true;
    try {
      const customer = await api.createCustomer(args as CustomerInput);
      savedCustomerId.value = customer.id;
    } finally {
      submitting.value = false;
    }
  },
  expect: {
    desc: "The customer is visible in the table",
    check: () => rows.value.some((row) => row.id === savedCustomerId.value),
  },
});
```

### React

```tsx
import { useRef, useState } from "react";
import { useAgentTool } from "@plingjs/react";

export function CustomerForm() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const lastCreated = useRef<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useAgentTool({
    id: "create_customer",
    desc: "Create a customer from the customer form",
    kind: "write",
    params: [
      { name: "name", label: "Customer name", minLength: 2 },
      { name: "email", label: "Contact email", pattern: EMAIL },
      { name: "plan", label: "Plan", values: ["starter", "pro"] },
    ],
    available: () => !submitting,
    run: async (args) => {
      setSubmitting(true);
      try {
        const customer = await api.createCustomer(args as CustomerInput);
        lastCreated.current = customer.id;
        setRows((current) => [...current, customer]);
      } finally {
        setSubmitting(false);
      }
    },
    expect: {
      desc: "The customer appears in the table",
      check: () => rowsRef.current.some((row) => row.id === lastCreated.current),
    },
  });

  return <form>{/* name, email, and plan fields */}</form>;
}
```

### 原生 JS / jQuery

```ts
const off = pling.action({
  id: "create_customer",
  desc: "Create a customer from the customer form",
  kind: "write",
  params: [
    { name: "name", label: "Customer name", minLength: 2 },
    { name: "email", label: "Contact email", pattern: EMAIL },
    { name: "plan", label: "Plan", values: ["starter", "pro"] },
  ],
  available: () => !state.submitting,
  run: async (args) => {
    state.submitting = true;
    try {
      const customer = await api.createCustomer(args);
      state.savedId = customer.id;
      appendRow(customer);
    } finally {
      state.submitting = false;
    }
  },
  expect: {
    desc: "The new customer is visible",
    check: () => document.querySelector(`[data-customer="${state.savedId}"]`) !== null,
  },
});
```

### Vue 2.7

```ts
import { defineComponent, onBeforeUnmount, ref } from "vue";
import { useAgentState, usePling } from "@plingjs/vue2";

export default defineComponent({
  setup() {
    const pling = usePling();
    const submitting = ref(false);
    const savedCustomerId = ref<string | null>(null);

    const off = pling.action({
      id: "create_customer",
      desc: "Create a customer from the customer form",
      kind: "write",
      params: [
        { name: "name", label: "Customer name", minLength: 2 },
        { name: "email", label: "Contact email", pattern: EMAIL },
        { name: "plan", label: "Plan", values: ["starter", "pro"] },
      ],
      available: () => !submitting.value,
      run: async (args) => {
        submitting.value = true;
        try {
          const customer = await api.createCustomer(args);
          savedCustomerId.value = customer.id;
        } finally {
          submitting.value = false;
        }
      },
      expect: {
        desc: "The customer is visible in the table",
        check: () => document.querySelector(`[data-customer="${savedCustomerId.value}"]`) !== null,
      },
    });

    onBeforeUnmount(off);

    useAgentState("customer_form", () => ({ submitting: submitting.value }), {
      description: "Customer form status",
    });

    return { submitting };
  },
});
```

## 执行顺序

1. 用户在对话中提供值。
2. 运行时按声明参数校验。
3. `available()` 确认表单当前允许保存。
4. `run()` 调用与可见提交按钮相同的业务函数。
5. 应用或服务端再次校验请求。
6. `expect()` 等待能证明保存生效的行或成功状态。
7. 下一份快照包含新记录与更新后的表单状态。

服务端返回字段错误时，应作为真实错误返回并带上修复条件。不要把它改写成“操作成功”，再用一段泛泛的道歉收尾。

## 常见失败

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 界面允许的值却返回 `INVALID_PARAMS` | 声明的格式或范围比业务规则更严 | 让动作契约与服务器规则一致 |
| 模型填了字段但没有保存 | 只有分散的填写动作，没有提交动作 | 暴露一次原子提交，或明确要求两次调用 |
| 点击成功，但没有记录 | 动作只证明了 DOM 交互 | 增加 `expect`，并原样返回服务端错误 |
| 第二次保存覆盖第一次 | `available()` 没有考虑进行中的请求 | 提交期间设为不可用 |
| 敏感值在上下文中出现两次 | 状态重复了每个字段值 | 暴露状态与字段名，不暴露内容 |
| 校验失败后模型用同一个值重试 | 错误没有说明修复条件 | 返回目标格式与被拒绝的字段 |

## 安全边界

前端校验提供即时反馈，不是授权。保存接口仍必须认证调用方、限制租户范围、再次校验，并拒绝不允许的套餐或字段。

表单包含密码、支付信息、证件号或一次性验证码时，不要把它们当普通参数暴露。使用人工接力，或设计一个从不让秘密进入模型上下文的服务端流程。

## 证据

- 参数校验：`packages/core/src/params.ts`。
- 本方案的可运行源码：`examples/demos/recipe-form-validation/`。

## 本地验证

先提交空字段，再用 `Blocked Co` 触发业务拒绝，最后填写合法值完成提交。三次结果应分别落在参数错误、业务错误与成功回执上；模型不能把前两次改写成成功。

