---
id: V2-04
title: "基于指令的动作声明"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 基于指令的动作声明

Vue 2 已经知道一次点击属于哪个元素。Pling 应利用这个事实，而不是再为页面维护一份描述。`v-tool` 把能力挂到 Vue 渲染出的元素上，浏览器继续执行原有的点击和输入处理函数。

在页面入口安装一次适配器：

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: { config: { limits: { maxTurns: 100 } } },
});

Vue.use(pling.plugin);
```

插件注册 `v-tool`、`v-scope` 和 `v-record`。它不会替换 Vue 的渲染器、事件系统或组件生命周期。

## 把动作挂在真实控件上

新增按钮是一个普通按钮，表单处理函数已经存在。指令补上的是人能从界面推断、模型无法推断的名称、说明和前置条件：

```ts
h("button", {
  attrs: { type: "submit", disabled: !this.draft.trim() },
  directives: [{
    name: "tool",
    value: {
      id: "composer_submit",
      desc: copy.composerSubmitDesc,
      available: () => this.draft.trim() ? true : copy.submitReason,
    },
  }],
}, copy.addTask)
```

`id` 必须稳定。说明写清动作做什么。输入框为空时，`available` 返回给模型的原因与用户看到的禁用状态保持一致。

文本输入框可以用同一个指令描述原语：

```ts
directives: [{
  name: "tool",
  value: {
    id: "composer_text",
    desc: copy.composerTextDesc,
    action: "fill",
    params: [{ name: "text", label: copy.textParamLabel }],
  },
}]
```

执行器运行 `composer_text` 时走输入路径；运行 `composer_submit` 时点击按钮。随后 Vue 处理函数按用户操作的方式新增待办。

风险等级也是声明的一部分。删除一行与打开编辑表单不是同一类操作：

```ts
directives: [{ name: "tool", value: {
  id: `remove@${task.id}`,
  desc: copy.removeDesc(task.text),
  kind: "danger",
} }]
```

这不会自动让删除变安全。它让执行器和模型知道影响类别，确认策略才能把它与读取或普通写入区分开。

## 描述页面区域

`v-scope` 声明包含表单和任务行的区域。子动作默认继承这个区域，除非自己声明另一个：

```vue
<section v-scope="{ id: 'todo', label: 'Tasks', role: 'main' }">
  <ul v-scope="{ id: 'todo_list', role: 'list', parent: 'todo' }">
    <li v-for="task in tasks" :key="task.id">...</li>
  </ul>
</section>
```

区域有两个用处：帮助模型理解动作所在的位置；让可见性规则可以排除不活跃或被遮挡区域里的动作。`v-record` 和 `v-tool` 使用稳定行 id，还能让注册表只移除真正发生变化的行。

## 运行示例

```bash
pnpm tutorial:dev v2-04
```

打开 `http://127.0.0.1:5265/`。中文界面：

```bash
pnpm tutorial:dev v2-04 --locale zh
```

打开 `http://127.0.0.1:5265/?lang=zh`。确定性检查：

```bash
pnpm tutorial:check v2-04
```

测试覆盖指令登记、通过原有点击处理函数执行、填写并提交表单，以及删除一行后对应的记录与动作注销。

## 常见问题

**把 `v-tool` 放在收不到事件的包装元素上。** 应声明真正拥有行为的元素；操作落在一个内层原生控件时，用 `target` 指定它。

**行 id 会变化。** 使用 `remove@0` 或数组下标后，排序或删除会让同一个 id 指向另一条待办。应从记录的稳定键生成 id。

**没有写 `desc`。** 模型无法从类名或图标推断业务含义。说明应当像写给一个刚加入团队、熟悉业务的同事。

**把指令当成权限系统。** 它只负责投影能力。鉴权、危险操作确认和服务端校验仍然是独立边界。
