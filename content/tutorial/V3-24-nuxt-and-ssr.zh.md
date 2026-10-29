---
id: V3-24
title: "Nuxt 与服务端渲染"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Nuxt 与服务端渲染

服务端渲染改变的是各部分代码可以运行的时机。浏览器还不存在时，服务端就要先返回可用的 HTML；Pling 的运行时、DOM 动作解析和模型循环则属于浏览器，要等这份 HTML 到达之后再接入。

本章的示例使用 Vite 和 `@vue/server-renderer`，不是完整的 Nuxt 工程。两者要处理的边界相同，较小的示例更容易看清哪段代码在服务端运行、哪段在浏览器运行。最后一节再说明同样的部件在 Nuxt 中放在哪里。

## 先渲染页面，再接入助手

业务列表不引用 Pling。它接收语言参数，渲染初始待办，只把客户端助手之后要调用的处理函数暴露出来：

```vue
<script setup lang="ts">
const tasks = ref<Task[]>(createSeedTasks(props.locale));

function add(text: string): void {
  const value = text.trim();
  if (!value) return;
  tasks.value = [{ id: `t${++sequence}`, text: value, done: false }, ...tasks.value];
}

defineExpose({
  add,
  toggle,
  clearCompleted,
  snapshot: () => ({ ...counts.value, records: tasks.value }),
});
</script>
```

共用的 `App` 增加一个只在客户端出现的挂载位置，但不让助手进入首屏：

```vue
<script setup lang="ts">
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
</script>

<template>
  <main>
    <TodoList ref="list" :locale="locale" @change="counts = $event" />
    <ClientAssistant v-if="mounted" :list="list" :counts="counts" :locale="locale" />
  </main>
</template>
```

`onMounted` 并不会让组件自动具备服务端安全性。这里只是把助手推迟到水合完成之后再创建。业务列表在服务端和客户端使用同一份参数与初始数据渲染。

服务端创建同一棵应用树，再把它序列化为 HTML：

```ts
export function renderTodoSsr(locale: DemoLocale): Promise<string> {
  return renderToString(createSSRApp(App, { locale }));
}
```

开发服务器再把这段 HTML 放进页面模板。请求 `/?lang=zh` 时，第一份响应里已经有中文待办行，不会先返回空的 `<div id="app">`，再等 JavaScript 把页面填出来。

示例把样式表链接也放在 `index.html`，所以首份 HTML 到达时页面已经有基本排版。助手脚本负责后续增强，不负责把业务页面从空白填出来。

## 浏览器通过水合接手

浏览器入口同样用 `createSSRApp` 挂载 `App`，而不是另建一棵纯客户端组件树：

```ts
const locale: DemoLocale = new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";

const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: { limits: { maxTurns: 100, contextTokens: 8_192 } },
  },
});

createSSRApp(App, { locale }).use(pling.plugin).mount("#app");
```

这里有两个前提。浏览器挂载的组件树必须与服务端渲染的一致；两侧的初始语言也必须相同。示例里服务端从请求 URL 读取 `?lang=`，浏览器读取同一个查询参数。不能一侧读请求头、另一侧读 `window`。

`createPling` 应放在浏览器入口。不要在共享的服务端模块顶层创建运行时：同一进程会处理很多请求，而运行时依赖浏览器环境。

## 水合完成后再登记能力

助手放在 `ClientAssistant.vue`。它创建时，`TodoList` 已经挂载，可以通过组件 ref 调用其方法：

```ts
useAgentTool({
  id: "todo.add",
  desc: copy.addDescription,
  kind: "write",
  params: [{ name: "text", label: copy.taskLabel, minLength: 1, maxLength: 80 }],
  run: ({ text }: Record<string, unknown>) => props.list?.add(String(text)),
});

useAgentState("todo_ssr", () => ({ ...props.counts }), {
  description: copy.overview,
});
```

同一组件还登记了只读工具和需要确认的清除动作，最后渲染 `AgentDock`。这些登记都属于客户端组件，组件卸载时会一起注销。

在纯客户端页面里，`v-tool` 通常是接入现有控件最短的写法。这里的业务列表先由服务端渲染，助手晚一步接入，所以函数级工具能把这条边界写得更直接。两种写法最终进入同一个注册表和执行器。

## Nuxt 中的同一道边界

在 Nuxt 中，把运行时放进只在客户端执行的插件，避免服务端求值：

```ts
// plugins/pling.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  const pling = createPling({
    ui: { locale: useCookie("locale").value ?? "en-US" },
    agent: { config: { limits: { maxTurns: 100 } } },
  });

  nuxtApp.vueApp.use(pling.plugin);
});
```

调用 `useAgentTool`、`useAgentState` 或 `usePling` 的组件，也要放在组件树的客户端一侧：

```vue
<ClientOnly>
  <TodoAssistant />
</ClientOnly>
```

`.client.ts` 插件和 `<ClientOnly>` 解决的是两件事。前者决定运行时在哪里创建，后者让助手的 setup 和渲染不进入服务端过程。业务页面仍然照常做服务端渲染。

上面的 Nuxt 代码只说明放置位置。本章真正运行的示例是 Vite SSR；它覆盖了同一套生命周期，但没有再引入一套 Nuxt 构建。

## 验证两侧

运行英文示例：

```bash
pnpm tutorial:dev v3-24
```

打开 `http://127.0.0.1:5237/`。运行中文示例：

```bash
pnpm tutorial:dev v3-24 --locale zh
```

打开 `http://127.0.0.1:5237/?lang=zh`。

第一份响应就是普通待办页面，助手在客户端运行时水合之后才出现。禁用 JavaScript，待办列表仍然可读；助手是增强项，不是页面成立的前提。

确定性检查：

```bash
pnpm tutorial:check v3-24
```

测试会渲染服务端 HTML，确认业务行存在且没有助手外壳；再用 `createSSRApp` 水合同一棵树，最后在已挂载组件上执行 `todo.add`。

## 常见问题

**在共享的服务端模块里创建 Pling。** 模块级运行时会跨请求复用，也可能在渲染期间访问浏览器全局对象。应放在浏览器入口或仅客户端插件中。

**两侧渲染了不同语言。** 水合会比较服务端与客户端组件树。初始语言必须来自同一个值。

**把助手状态放进服务端组件树。** `AgentDock`、工具和模型会话都依赖已经存在的浏览器页面，应留在客户端边界内。

**在 DOM 出现前声明 DOM 动作。** 组件挂载后再注册函数级工具，或者让 `v-tool` 随元素登记；目标应在执行时解析。

**以为 SSR 会顺带解决模型边界。** 服务端渲染不提供模型网关、会话鉴权、费用限额或审计，这些仍是独立的部署工作。
