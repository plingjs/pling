---
id: REF-03
title: "UI 文案、主题与语言"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# UI 文案、主题与语言

Pling 内置助手在 Vue 3、React、原生 JS / jQuery 与 Vue 2.7 上共用一套 UI 控制器。它管理框架自己的按钮文案、主题 token 与语言选择，不管理应用的业务文案。

这条边界很重要。翻译“提交订单”属于应用自己的 i18n；翻译“批准”“清空对话”“等待你确认”属于 Pling。

## 默认值与解析

默认语言是 `en-US`。框架不会悄悄跟随浏览器语言；需要时显式写 `locale: "auto"`。

| `ui.locale` | 结果 |
| --- | --- |
| 省略 | `en-US` |
| `"en-US"`、`"en-GB"`、`"zh-CN"`、`"zh-TW"` | 在内置目录中精确匹配或按基础语言匹配 |
| 不支持的语言 | 回退英语 |
| `"auto"` | 使用浏览器语言列表中的第一个可匹配项，否则英语 |

语言匹配不区分大小写，`_` 与 `-` 等价。缺少某个 key 时先回退英语，再回退 key 本身。不要把 key 当作正式界面文案。

## 选项

```ts
createPling({
  ui: {
    locale: "en-US",
    theme: {
      mode: "auto",
      tokens: {
        colorPrimary: "#0f766e",
        colorPrimaryStrong: "#115e59",
        radiusLg: "16px",
      },
    },
    messages: {
      "zh-CN": {
        "chat.empty": "可以问我当前页面上的任务。",
      },
    },
    classNames: {
      dock: "product-dock",
      panel: "product-panel",
      launcher: "product-launcher",
      chat: "product-chat",
    },
  },
});
```

| 选项 | 用途 |
| --- | --- |
| `locale` | 内置 UI 语言，默认英语 |
| `theme` | `light`、`dark`、`auto`，或 `{ mode, tokens }` |
| `messages` | 按语言覆盖框架文案 key |
| `classNames` | 应用可控的四个挂点：`dock`、`panel`、`launcher`、`chat` |

主题 token 会变成挂载表面的 CSS 变量，例如 `--pling-color-primary`、`--pling-color-surface`、`--pling-radius-lg`。应用样式可以直接使用这些变量，不必进入组件内部选择元素。

`classNames` 不是第二套主题系统。它用于颜色、圆角、阴影与字体 token 无法表达的布局和品牌选择器。

## 运行时切换语言与主题

```ts
pling.ui.setLocale("zh-CN");
pling.ui.setTheme({ mode: "dark" });
pling.ui.setTheme("auto");
```

控制器会原地通知已挂载的表面。React 通过 `useSyncExternalStore` 读取，Vue 与原生 Dock 订阅同一份快照。切换语言不会重建会话，也不会丢失历史。

当前实现只对中文界面（`zh*`）追加明确的回答语言说明。其他语言依赖基础规则：跟随用户最新一条消息。因此把界面切到英文，并不会强制模型用英文回答。UI 语言是解释与界面文案的默认值，不是对用户的限制。

## 各适配器接入

### Vue 3

```ts
const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
});

pling.ui.setLocale("zh-CN");
```

### React

```tsx
const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
});

export function App() {
  return (
    <PlingProvider pling={pling}>
      <TodoPage />
      <AgentDock />
    </PlingProvider>
  );
}
```

应用控件需要读取当前快照时使用 `usePlingUi()`：

```tsx
const ui = usePlingUi();
ui.locale;
ui.resolvedTheme;
ui.cssVars;
```

### 原生 JS / jQuery

```ts
const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
});

pling.dock();
pling.ui.subscribe(() => {
  document.documentElement.dataset.plingTheme = pling.ui.resolvedTheme;
});
```

### Vue 2.7

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
});

Vue.use(pling.plugin);
pling.dock();
```

Vue 2.7 使用共享原生 Dock，因此也暴露同一套 `ui` 控制器与语言目录。它没有 Vue 3 的组件插槽，也没有 Vue 3 独有的模型设置与调试面板。

## 文案归属

| 文案 | 归属 | 原因 |
| --- | --- | --- |
| “批准”“取消”“等待你确认” | Pling 目录 | 内置交互的一部分 |
| “保存订单”“2021 年起成为客户” | 应用 | 业务含义与品牌语气 |
| 错误码及简短解释 | Pling 目录 | 四端保持一致 |
| 服务端错误详情 | 应用或网关 | 可能包含领域恢复建议 |
| 模型回答 | 模型，受 UI 语言与最新用户消息约束 | 用户可以在任一轮切换语言 |

不要把整个应用翻译目录送进模型上下文。UI 控制器只需要内置表面实际使用的 key。

`agent.config.systemPrompt` 会追加在框架规则之后。它可以补充应用背景，但不能替换“跟随用户最新消息”的基础规则。

## 常见失败

| 现象 | 更可能的原因 | 处理 |
| --- | --- | --- |
| 浏览器是中文，助手仍以英文打开 | 默认英语，浏览器检测需要显式开启 | 传 `locale: "auto"`，或让用户选择 |
| 自定义语言仍显示英文 | 自定义目录缺少该 key | 补 key，或接受文档说明的英语回退 |
| 主题切换后页面没变 | 应用控件读取了 `pling.ui.theme` 而不是 `resolvedTheme` | 渲染颜色使用 `resolvedTheme` |
| 切换语言后会话被清空 | 宿主重建了整个 Pling 实例 | 调用 `pling.ui.setLocale()`，不要重建实例 |
| 自定义类名没有效果 | 它只能是 `classNames` 的挂点 | 使用 `dock`、`panel`、`launcher` 或 `chat` |
| 模型回答语言与界面不一致 | 非中文界面不会追加额外语言说明，仍以用户最新消息为准 | 明确请用户切换语言，或追加不与最新消息冲突的应用级说明 |

## 证据

- 共享 UI 控制器：`packages/ui/src/controller.ts`。
- 主题 token 解析：`packages/ui/src/theme.ts`。
- 语言解析与回退：`packages/ui/src/locale.ts`。
- 共用同一订单界面的四个可运行适配器：`examples/recipes/vue3`、`examples/recipes/react`、`examples/recipes/vanilla`、`examples/recipes/vue2`。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/ui` `0.1.0-alpha.2` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；Node 侧使用需 Node.js 20 或更高版本 |
| Peer 依赖 | 无 |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

本页的主题 token 与语言目录属于当前版本的 `@plingjs/ui`。新增目录键是兼容变更；重命名或删除公开键会破坏依赖它的应用。

