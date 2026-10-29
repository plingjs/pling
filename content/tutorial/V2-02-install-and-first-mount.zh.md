---
id: V2-02
title: "安装与首次挂载"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 安装与首次挂载

本章把 Vue 2.7 页面连接到一个 Pling 运行时和一个助手入口。页面还没有声明任何动作，所以助手可以解释它看到的内容，但暂时不能操作业务控件。

## 安装适配器

使用应用现有的包管理器安装 `@plingjs/vue2`：

| 包管理器 | 命令 |
| --- | --- |
| pnpm | `pnpm add @plingjs/vue2` |
| npm | `npm install @plingjs/vue2` |
| Yarn | `yarn add @plingjs/vue2` |

适配器要求 Vue 2.7。它复用共享的 DOM 执行层，不替换 Vue 的渲染器或事件系统。

## 创建并安装运行时

在页面入口创建一次运行时，并在挂载应用前安装 Vue 插件：

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  ui: { locale: "zh-CN" },
  agent: {
    config: {
      systemPrompt: "你是这个页面的助手。回答保持简短。",
      limits: { maxTurns: 100 },
    },
  },
});

Vue.use(pling.plugin);
```

`Vue.use(pling.plugin)` 注册 `v-tool`、`v-scope` 和 `v-record`。它本身不会注册动作；页面必须声明控件，智能体才能看到它。

真实应用通常应由服务端网关提供模型端点和凭证。浏览器不应为了显示助手而持有生产环境的模型密钥。

## 挂载助手入口

共享 DOM 入口应在 Vue 实例创建后挂载：

```ts
new Vue({
  data() {
    return { dock: null };
  },
  mounted() {
    this.dock = pling.dock({
      title: "页面助手",
      quick: ["你能在这个页面上做什么？"],
    });
  },
  beforeDestroy() {
    this.dock?.destroy();
  },
  render(h) {
    return h("main", "一个普通的 Vue 2.7 页面");
  },
}).$mount("#app");
```

页面或微前端卸载时，应销毁入口和 Pling 运行时。应用已经消失却仍保留运行时，会留下过期注册和重复的助手入口。

## 检查首次挂载

运行示例：

```bash
pnpm tutorial:dev v2-02
```

打开 `http://127.0.0.1:5242/`。中文界面使用 `pnpm tutorial:dev v2-02 --locale zh`，然后打开 `http://127.0.0.1:5242/?lang=zh`。

确定性检查命令：

```bash
pnpm tutorial:check v2-02
```

它会检查 Vue 2.7 挂载、插件安装、助手入口，以及页面没有声明动作这一事实。

## 常见问题

**先挂载应用，再安装插件。** 使用指令的模板必须在编译前完成插件注册。把 `Vue.use(pling.plugin)` 放在入口中、`new Vue(...).$mount(...)` 之前。

**创建多个运行时。** 一个页面应有一个 Pling 实例和一个助手入口。应在应用入口创建，而不是在每一行或重复组件里创建。

**把助手入口当成页面权限。** 入口只提供对话面。没有 `v-tool` 的控件不会进入注册表，即使人能看到它。

## Vue 2.6 及更早：通过 Vanilla 适配器接入

Vue 2.6 及更早版本不能使用 `@plingjs/vue2`，因为该适配器依赖 Vue 2.7 的组合式 API。项目不必因此停在 Pling 之外：`@plingjs/vanilla` 不依赖 Vue，可以直接绑定组件已经渲染出的 DOM 元素。

这条路径没有指令，也没有适配器代管生命周期。`pling.tool()`、`pling.scope()`、`pling.record()` 和 `pling.state()` 都由应用在组件挂载后调用；每一项都会返回解绑函数，列表重新渲染时还要重新登记行记录与行内动作。

### 安装

保留项目现有的 Vue 2.6；只新增 Vanilla 适配器：

| 包管理器 | 命令 |
| --- | --- |
| pnpm | `pnpm add @plingjs/vanilla` |
| npm | `npm install @plingjs/vanilla` |
| Yarn | `yarn add @plingjs/vanilla` |

不需要安装 `@plingjs/vue2`，也不需要调用 `Vue.use()`。现有构建工具需要能处理包提供的 ESM 产物；这与 Vue 的版本无关。Pling 运行时面向支持 ES2022 模块的浏览器，这一点也不会因为应用使用 Vue 2.6 而改变；仍需支持更旧浏览器时，应先评估转译与 polyfill。

### 在入口创建运行时

在一个应用入口创建实例，再通过 `provide` 交给根组件：

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vanilla";
import App from "./App.vue";

const pling = createPling({
  ui: { locale: "zh-CN" },
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "your-model",
      limits: { maxTurns: 100 },
    },
  },
});

new Vue({
  provide: { pling },
  render: (h) => h(App),
}).$mount("#app");
```

模型端点仍应指向服务端网关。浏览器只拿到网关地址，不持有生产模型密钥。

### 在 Options API 组件中声明能力

下面的组件保留普通的 Vue 2.6 数据与事件处理。Pling 只读取这些元素、调用同一个处理函数，并通过 `pling.state()` 暴露只读计数：

```vue
<template>
  <main ref="app">
    <form @submit.prevent="addTodo">
      <label for="new-todo">新待办</label>
      <input id="new-todo" ref="composer" v-model="draft" />
      <button ref="addButton" type="submit">添加</button>
    </form>

    <ul ref="list">
      <li v-for="todo in todos" :key="todo.id" :data-todo-id="todo.id">
        <input
          data-action="toggle"
          type="checkbox"
          :checked="todo.done"
          @change="toggleTodo(todo.id)"
        />
        <span>{{ todo.text }}</span>
        <button data-action="delete" type="button" @click="removeTodo(todo.id)">
          删除
        </button>
      </li>
    </ul>
  </main>
</template>

<script>
export default {
  inject: ["pling"],

  data() {
    return {
      draft: "",
      seq: 3,
      todos: [
        { id: "t1", text: "准备周会材料", done: false },
        { id: "t2", text: "回复客户邮件", done: true },
      ],
    };
  },

  created() {
    this.rowUnbinds = [];
  },

  mounted() {
    this.pling.scope(this.$refs.app, {
      id: "todo_app",
      label: "待办应用",
      role: "main",
    });

    this.pling.tool(this.$refs.composer, {
      id: "todo_text",
      desc: "填写新待办的内容",
      action: "fill",
      params: [{ name: "text", label: "待办内容" }],
    });

    this.pling.tool(this.$refs.addButton, {
      id: "add_todo",
      desc: "把输入框中的内容添加为待办",
      kind: "write",
      available: () => (this.draft.trim() ? true : "输入框是空的"),
    });

    this.pling.state(
      "todo_view",
      () => ({
        total: this.todos.length,
        remaining: this.todos.filter((todo) => !todo.done).length,
      }),
      { description: "待办总数与未完成数量" },
    );

    this.pling.dock({
      title: "待办助手",
      quick: ["新增一条「写周报」", "把第一条待办标记完成"],
    });

    this.syncRows();
  },

  beforeDestroy() {
    this.releaseRows();
    this.pling.destroy();
  },

  methods: {
    async syncRows() {
      await this.$nextTick();
      this.releaseRows();

      for (const todo of this.todos) {
        const row = Array.from(this.$refs.list.children).find(
          (element) => element.dataset.todoId === todo.id,
        );
        if (!row) continue;

        this.rowUnbinds.push(
          this.pling.record(row, { data: todo, label: `待办：${todo.text}` }),
          this.pling.tool(row.querySelector('[data-action="toggle"]'), {
            id: `toggle_todo:${todo.id}`,
            desc: `切换待办完成状态：${todo.text}`,
            kind: "write",
          }),
          this.pling.tool(row.querySelector('[data-action="delete"]'), {
            id: `delete_todo:${todo.id}`,
            desc: `删除待办：${todo.text}`,
            kind: "danger",
          }),
        );
      }
    },

    releaseRows() {
      for (const unbind of this.rowUnbinds) unbind();
      this.rowUnbinds = [];
    },

    addTodo() {
      const text = this.draft.trim();
      if (!text) return;

      this.todos.push({ id: `t${this.seq++}`, text, done: false });
      this.draft = "";
      this.syncRows();
    },

    toggleTodo(id) {
      const todo = this.todos.find((item) => item.id === id);
      if (todo) todo.done = !todo.done;
      this.syncRows();
    },

    removeTodo(id) {
      this.todos = this.todos.filter((todo) => todo.id !== id);
      this.syncRows();
    },
  },
};
</script>
```

`v-model`、`@submit` 和 `@click` 仍由 Vue 处理。`pling.tool()` 只是把模型可见的动作接到这些元素上；输入框的 `fill` 动作会写入值并触发 `input`，提交按钮随后走原来的表单提交路径。

`syncRows()` 之所以要在每次列表变化后执行，是因为新增或删除待办会替换或移除 DOM 节点。先解绑旧的行声明，再按当前数据登记新节点，才能避免动作指向已经脱离文档的元素。只修改同一行的字段（例如完成状态）不会改变 Vue 保留的节点，记录每次快照仍会从同一个对象读取最新值。

这条手动路径不会获得 `v-tool`、`v-scope`、`v-record`、`useAgentState()` 和自动生命周期清理。它复用与 Vue 2.7 适配器相同的 `core` / `dom` 执行层，但兼容性承诺只覆盖这里明确写出的 Vanilla API。

下一步：[快速上手：一个完整的 Todo Agent](/zh/vue2/quick-start)。
