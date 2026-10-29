---
id: V2-08
title: "从 Vue 2 迁移到 Vue 3"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 从 Vue 2 迁移到 Vue 3

Vue 2.7 和 Vue 3 使用不同的 Pling 包。能力模型不变，但插件安装位置、组件生命周期和助手入口会变。如果只替换包名，构建可能通过，运行时却会丢掉动作。

本章用两个完整示例做对照，不另造第三份迁移页面。Vue 2.7 示例确定原有行为，Vue 3 示例给出目标接入方式。对照始终跟随可维护的示例，避免复制出的迁移夹具与两端逐渐脱节。

## 先固定业务契约

迁移应用外壳之前，先记下不能改变的部分：

| 契约 | 需要记录什么 |
| --- | --- |
| 动作 id | 模型和测试已经在用的完整 id，包括 `edit@t2` 这类记录级 id |
| 记录 id | 每一行的业务身份，而不是它当前的 DOM 位置 |
| 区域 id | 描述页面结构和父子关系的名称 |
| 业务处理函数 | 按钮、输入框或表单最终触达的现有函数 |
| 可见性规则 | 弹窗、遮挡、禁用条件和区域边界 |
| 信任边界 | 确认、人工接力、网关鉴权和审计 |

这些是行为契约。替换导入路径、增加组件包装或改写渲染函数，都不构成重命名动作、把业务修改搬进能力层的理由。

## 对照两端接入方式

Vue 2.7 使用全局插件和共享 DOM 问答入口：

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: { config: { limits: { maxTurns: 100 } } },
});

Vue.use(pling.plugin);
pling.dock({ title: "待办助手" });
```

Vue 3 把插件安装到应用实例上，并把问答入口作为组件挂载：

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import App from "./App.vue";

const pling = createPling({
  agent: { config: { limits: { maxTurns: 100 } } },
});

createApp(App).use(pling.plugin).mount("#app");
```

```vue
<AgentDock title="待办助手" />
```

声明名称仍然相通：两个适配器都提供 `v-tool`、`v-scope` 和 `v-record`。但表达式仍需逐处检查。Vue 2 的渲染函数使用 `this` 和指令描述对象；Vue 3 使用 setup 状态、模板绑定或 `withDirectives`。同一个业务意图，落到代码上可能长得不同。

## 运行对照

先启动 Vue 2.7 示例：

```bash
pnpm tutorial:dev v2-05 --locale zh
```

打开 `http://127.0.0.1:5266/?lang=zh`。示例包含任务行、编辑弹窗和共享问答入口。运行确定性检查：

```bash
pnpm tutorial:check v2-05
```

再启动 Vue 3 示例：

```bash
pnpm tutorial:dev v3-09 --locale zh
```

打开 `http://127.0.0.1:5222/?lang=zh`。它用 Vue 3 适配器演示同样的记录与弹窗行为，并增加了明确的区域树和遮挡状态。运行检查：

```bash
pnpm tutorial:check v3-09
```

两个应用并不共享同一份业务代码。对照能力契约，而不是逐行对照模板：

- `edit@<记录 id>` 打开的是对应记录的编辑器；
- 弹窗存在时，弹窗内的动作才出现；
- 弹窗打开时，背景动作变为不可用；
- 保存走页面原有的业务修改函数；
- 关闭弹窗后，弹窗动作消失；
- 下一次快照反映修改后的记录。

## 按受控顺序迁移

1. 如果应用还停留在更早的 Vue 2，先升级到 Vue 2.7。
2. 盘点每一个 Pling 声明，以及它实际触达的业务处理函数。
3. 保留 Vue 2 能力测试，作为行为基线。
4. 在不扩大能力范围的前提下，把应用外壳迁移到 Vue 3。
5. 用 `@plingjs/vue` 替换 `@plingjs/vue2`。
6. 在创建 Vue 3 应用的位置安装插件。
7. 用 Vue 3 助手组件替换 DOM 问答入口。
8. 对 Vue 3 页面重新运行同一组执行器与无障碍测试。
9. 迁移后的能力面稳定后，再增加新能力。

除非迁移本身要求，不要在同一步更换模型网关、确认策略或审计路径。边界保持不动，失败时才容易判断是哪一层变了。

## 迁移审查

完成迁移前检查：

- 每个动作 id 仍指向预期的业务记录。
- 弹窗打开时出现控件，关闭时移除控件。
- 区域仍描述正确的活动范围。
- 助手不会看到没有计划迁移的能力。
- 服务端网关、确认策略和审计仍然生效。
- 同一业务路径在两个版本中都能通过确定性测试。
- Vue 3 入口只安装一次插件，也只配置一次模型。

目标不是保留某个实现细节，而是在框架改变时保留每项能力的含义。

延伸阅读：[记录与弹窗](/zh/vue2/records-and-dialogs) 与 [区域、可见性与遮挡](/zh/vue/regions-visibility-and-overlays)。
