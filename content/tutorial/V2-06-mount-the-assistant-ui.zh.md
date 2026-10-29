---
id: V2-06
title: "挂载问答入口与助手界面"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 挂载问答入口与助手界面

助手入口与能力声明是两件不同的事。页面可以把一组定义清楚的动作开放给智能体，同时只显示一个共享助手；也可以等应用初始化完成后再挂载入口。本章处理后一种情况：一个 Vue 2.7 页面、一个 Pling 运行时，以及一个生命周期明确的浮动入口。

## 在应用挂载后创建入口

`pling.dock()` 返回控制器。应把它保存在拥有页面生命周期的组件上：

```ts
data() {
  return { dock: null };
},
mounted() {
  this.dock = pling.dock({
    title: "待办助手",
    placeholder: "需要完成什么？",
    emptyHint: "我可以操作这个页面上的任务列表。",
    quick: ["把第 1 个待办标记完成"],
    defaultOpen: true,
    onOpenChange: (open) => { this.assistantOpen = open; },
  });
},
beforeDestroy() {
  this.dock?.destroy();
  this.dock = null;
}
```

在 `mounted` 之后创建入口，可以避免 Vue 还在构建页面时挂入第二个宿主。在 `beforeDestroy` 中销毁它，可以连同页面一起移除观察器和已注册控件。

## 配置可见入口

入口接受展示设置和应用级智能体接线：

| 选项 | 用途 |
| --- | --- |
| `title` | 助手面板标题 |
| `placeholder` | 消息输入框内的提示 |
| `emptyHint` | 第一轮对话前的说明 |
| `quick` | 推荐问题；点击后会直接发送 |
| `defaultOpen` | 是否默认展开面板 |
| `config` | 仅针对这个入口的模型或运行时覆盖 |
| `gate` | 需要确认的动作所使用的确认通道 |
| `onSessionEvent` | 接收会话事件，供审计或宿主观测使用 |
| `onOpenChange` | 面板开关状态变化时通知宿主 |
| `navigate` | 覆盖任务完成后的默认导航 |

推荐问题只是给用户的示例。它们不会授予权限，也不会绕过注册表、确认策略或模型轮数限制。

## 显式控制入口

返回的控制器提供宿主通常需要的操作：

```ts
dock.open();
dock.close();
dock.toggle();
dock.isOpen();
dock.destroy();
```

这可以用于帮助按钮、键盘快捷键，或由应用决定助手何时可用。页面仍应只有一个权威入口，而不是每次点击都新建一段会话。

## 运行示例

```bash
pnpm tutorial:dev v2-06
```

打开 `http://127.0.0.1:5267/`。中文界面使用 `pnpm tutorial:dev v2-06 --locale zh`，然后打开 `http://127.0.0.1:5267/?lang=zh`。

```bash
pnpm tutorial:check v2-06
```

检查会确认入口只挂载一次、按配置初始展开，并且可以通过控制器关闭，同时 Vue 页面仍正常工作。

## 常见问题

**在每一条待办里创建入口。** 这会产生多个启动按钮和多段会话。应在页面入口创建一个入口，并把控制器交给页面所有者保存。

**忘记销毁控制器。** 路由切换或微前端卸载后，旧助手可能仍挂在 `document.body` 上。所有者消失时，应同时销毁入口和 Pling 运行时。

**把 `defaultOpen` 当成用户同意。** 打开面板不等于允许执行动作。确认、授权和服务端检查仍是独立边界。

**把模型供应商密钥放进入口选项。** 这些选项属于浏览器代码。即使入口只在认证后创建，生产环境仍应使用服务端网关。

下一步：[测试与部署 Vue 2 应用](/zh/vue2/test-and-deploy-a-vue-2-app)。
