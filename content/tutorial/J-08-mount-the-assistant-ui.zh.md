---
id: J-08
title: "挂载问答入口与助手界面"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 挂载问答入口与助手界面

页面可以提供自己的入口按钮，而不必再创建一个助手。`pling.dock()` 返回共享会话的控制器；页头按钮只需调用这个控制器。

当应用已经有工具栏、帮助菜单或键盘快捷键时，这个区分很有用。视觉入口属于宿主页面，会话、注册表和执行运行时仍集中在一处。

## 页面存在后创建一个入口

页面 DOM 渲染完成后创建入口，再接入宿主控件：

```ts
const dock = pling.dock({
  title: "待办助手",
  placeholder: "需要完成什么？",
  emptyHint: "我可以操作这个页面上的待办表格。",
  quick: ["把第 1 个待办标记完成"],
  onOpenChange: (open) => assistantButton.setAttribute("aria-expanded", String(open)),
});

assistantButton.addEventListener("click", () => dock.toggle());
```

这个按钮是人的入口。除非页面另外声明，它不会成为智能体动作。入口自带的启动按钮仍然存在，因此页面不需要重新实现焦点和无障碍行为。

## 有意识地选择可见选项

| 选项 | 改变什么 |
| --- | --- |
| `title` | 面板标题 |
| `placeholder` | 消息输入框提示 |
| `emptyHint` | 第一轮对话前的说明 |
| `quick` | 推荐用户消息 |
| `defaultOpen` | 面板初始状态 |
| `config` | 该入口的模型或运行时覆盖 |
| `gate` | 需要确认的动作所用通道 |
| `onSessionEvent` | 宿主侧观察会话事件 |
| `onOpenChange` | 让页面控件状态与面板保持同步 |

推荐问题不是能力。它们只是填入正常对话路径的文字，模型仍需解析已声明的动作。

## 让运行时归属页面所有者

一个页面、路由或微前端应只拥有一个 Pling 运行时和一个入口。所有者销毁时，先销毁入口，再销毁运行时：

```ts
dock.destroy();
pling.destroy();
```

重复调用 `pling.dock()` 会创建多个入口，而不是连接到同一个面板的多个视图。如果页面需要第二个视觉入口，应调用现有控制器的 `open`、`close` 或 `toggle`。

## 模型配置不是界面配置

入口可以接受 `config`，但生产浏览器仍应通过已认证的网关发送模型请求。页面可以选择模型别名或显示名，不应内嵌供应商密钥。入口是运行时的客户端，不是安全的模型代理。

## 运行示例

```bash
pnpm tutorial:dev j-08
```

打开 `http://127.0.0.1:5273/`，或使用 `--locale zh` 和 `http://127.0.0.1:5273/?lang=zh`。

```bash
pnpm tutorial:check j-08
```

测试会确认只存在一个入口，页面按钮可以切换它，`aria-expanded` 跟随打开状态，同时待办声明保持不变。

## 常见问题

**在每个组件或事件处理函数里创建入口。** 这会产生多个助手。应保留一个页面级控制器并复用。

**围绕 `pling.runtime` 再写一套聊天面板。** 运行时是入口集成的内部实现；公开入口是入口控制器。第二套面板会复制会话状态和无障碍行为。

**把 `defaultOpen` 当成同意。** 打开面板不等于允许执行。确认和服务端授权仍是独立边界。

**忘记同步页面控件。** 使用 `onOpenChange`，避免自定义按钮的文案或状态与实际面板不一致。

下一步：[保护敏感数据与危险操作](/zh/vanilla/protect-sensitive-data-and-destructive-actions)。
