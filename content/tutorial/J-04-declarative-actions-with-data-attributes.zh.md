---
id: J-04
title: "用 data 属性声明动作"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 用 data 属性声明动作

服务端渲染或模板驱动的页面，能力元数据往往已经在 HTML 里。每个控件旁边再写一长段 `pling.tool()` 调用，会让这些元数据更难检查。页面可以把可序列化的部分放进 `data-*` 属性，再用一个很小的绑定器调用适配器。

原生适配器不会自动解释 `data-pling-tool`。本章的 `data-agent-*` 是应用自己的约定。把绑定器留在应用代码中，可以让约定保持可见，也便于页面决定哪些动态值需要单独处理。

## 把稳定元数据写进标记

输入框和提交按钮用属性描述动作：

```html
<input data-new-task
  data-agent-tool="composer_text"
  data-agent-desc="在这个输入框中填写一条新待办。"
  data-agent-action="fill"
  data-agent-params='[{"name":"text","label":"待办内容"}]' />

<button type="submit" data-submit
  data-agent-tool="composer_submit"
  data-agent-desc="把新待办输入框中的文字加入列表。">
  添加待办
</button>
```

这些值稳定、可读，并且可以由服务端模板生成，不需要输出组件代码。`params` 使用 JSON，因为它是数据，不是可执行代码。

## DOM 存在后再绑定

页面拥有一个绑定器，把这些属性变成声明：

```ts
function bindDataTools(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-agent-tool]")) {
    const id = element.dataset.agentTool?.trim();
    const desc = element.dataset.agentDesc?.trim();
    if (!id || !desc) continue;

    const action = element.dataset.agentAction as ToolOptions["action"] | undefined;
    const rawParams = element.dataset.agentParams;
    const params = rawParams ? JSON.parse(rawParams) : undefined;
    const available = availability[id];

    cleanups.push(pling.tool(element, {
      id,
      desc,
      ...(action ? { action } : {}),
      ...(params ? { params } : {}),
      ...(available ? { available } : {}),
    }));
  }
}
```

先注册区域，再绑定子节点。适配器会把 `data-pling-scope` 写到区域上，工具会从 DOM 继承最近的已声明区域。

## 函数与活动对象留在代码里

有两类东西不应序列化进 HTML：

- 记录的 `data` 对象，因为它必须与页面修改的是同一个活动对象；
- `available` 函数，因为它要读取当前页面状态。

页面保留一张可用性映射，并显式绑定每一行的记录：

```ts
const availability = {
  composer_submit: () => input.value.trim() ? true : "先填写一条待办。",
};

pling.record(row, { data: task, label: `待办：${task.text}` });
```

动态生成的行可以先设置 `data-agent-tool` 和 `data-agent-desc`，再调用同一个绑定器。记录及其活动对象仍通过 `pling.record` 绑定。

## data 属性是元数据，不是安全边界

浏览器里的任何人都能查看或修改 data 属性。最终声明仍要经过与显式 `pling.tool()` 相同的注册表、可用性检查、策略、执行器和服务端授权。移除属性可以减少智能体看到的内容，增加属性却不能授予业务端点本来不允许的权限。

不要在这些属性里存放密钥、访问令牌或按用户判断的权限声明。浏览器不是它们的信任边界。

## 运行示例

```bash
pnpm tutorial:dev j-04
```

打开 `http://127.0.0.1:5269/`。中文界面使用 `pnpm tutorial:dev j-04 --locale zh`，然后打开 `http://127.0.0.1:5269/?lang=zh`。

```bash
pnpm tutorial:check j-04
```

检查会确认属性绑定器注册了输入框、提交按钮和行内动作，并验证原有 DOM 处理函数仍能新增和切换待办。

## 常见问题

**把 `data-agent-tool` 放在每层容器上。** 绑定器会匹配所有元素。应把元数据放在交互控件上，或在绑定器里使用更精确的选择器。

**节点已替换，属性还留着。** 属性不是注册。替换 DOM 后要重新运行绑定器，并调用旧声明的解绑函数。

**把 `available` 或活动记录序列化成 JSON。** 它们属于代码和状态，不是静态元数据。应留在页面中，由绑定器合并。

下一步：[动态 DOM 的命令式动作](/zh/vanilla/imperative-actions-for-dynamic-dom)。
