---
id: J-02
title: "脚本接入与首次挂载"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 脚本接入与首次挂载

本章给一个已经有 HTML 和 JavaScript 的页面接入 Pling。页面保留自己的标记和事件处理；接入层只创建唯一的运行时并挂载助手，还没有声明任何业务动作。

动作列表为空很重要。页面负责人还没有开放控件时，Agent 不应该从 DOM 里自行猜出一个可用按钮。

## 安装适配器

安装原生 JS 包：

| 包管理器 | 命令 |
| --- | --- |
| pnpm | `pnpm add @plingjs/vanilla` |
| npm | `npm install @plingjs/vanilla` |
| Yarn | `yarn add @plingjs/vanilla` |

包中会带入框架无关的运行时、DOM 执行层、Agent 循环和 Dock UI。Dock 会自行注入样式。如果宿主页面已经有很大的全局样式表，先检查右下角的固定定位是否重叠，不必急着合并所有组件样式。

## 只创建一次运行时

把运行时放在应用启动代码附近：

```ts{1,6}
import { createPling } from "@plingjs/vanilla";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount point");

const pling = createPling();

pling.dock({ title: "页面助手" });
```

运行时持有这个页面的注册表。`pling.dock()` 挂载启动按钮和对话面板。重复调用会创建多余注册表或助手入口，因此这里应保持页面级的一次性入口。

如果脚本会在每次导航时重新执行，应先销毁上一份运行时，再建立新的。这属于后续的多页连续性主题；本章先保持一个文档、一份运行时。

## 页面保持原样

示例从一个普通 HTML 页面开始：

```html
<main class="page">
  <section class="setup">
    <h1>已连接，尚未开放任何操作</h1>
    <ol class="checks">...</ol>
  </section>
</main>
```

JavaScript 填充已有的挂载点，并保留原有事件监听。Pling 不需要重建页面树，也不接管状态。页面由服务端渲染或由另一个工具构建时，这一点同样成立。

## 配置模型

在 Vite 项目中使用共享的开发变量：

```bash
VITE_AGENT_BASE_URL=https://api.example.com/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
```

修改 `.env.local` 后重启开发服务器。没有 Vite 的项目可以显式传入同样的值：

```ts{1,6}
const pling = createPling({
  agent: {
    config: {
      baseUrl: "https://api.example.com/v1",
      model: "chat-model",
      apiKey: "replace-with-a-development-key",
    },
  },
});
```

这些值会在浏览器中暴露。开发阶段直连模型不是生产密钥方案；生产页面应通过同源网关请求模型。

如果模型服务阻止浏览器访问，可以配置 Vite 代理，把浏览器请求指向本地路径：

```bash
VITE_AGENT_BASE_URL=/llm/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
VITE_AGENT_PROXY_TARGET=https://api.example.com
```

## 运行示例

源码位于 `examples/tutorials/j-02-script-setup/`。在仓库副本中执行：

```bash
git clone https://github.com/plingjs/pling.git
cd pling
pnpm install
pnpm tutorial:dev j-02
```

打开 `http://127.0.0.1:5240/`。中文界面执行 `pnpm tutorial:dev j-02 --locale zh`，打开 `http://127.0.0.1:5240/?lang=zh`。

检查：

1. 原有页面和四项检查正常显示。
2. 助手启动按钮出现。
3. 配置模型后可以回答简单问题。
4. 注册表仍然没有动作和记录。
5. 除助手宿主外，挂载 Pling 没有修改业务 DOM。

## 常见故障

| 现象 | 可能原因 | 检查什么 |
| --- | --- | --- |
| `createPling is not defined` | 没有导入模块，或更早的脚本已经报错 | 查看 import 与浏览器控制台 |
| 看不到启动按钮 | 没有调用 `pling.dock()`，或脚本在调用前中断 | 检查挂载顺序和控制台 |
| 出现两个启动按钮 | 启动脚本执行了两次 | 每个文档保留一份运行时，并在卸载时销毁 |
| 模型不能回答 | 缺少地址、模型名或密钥 | 使用 `.env.local` 或显式 `agent.config` |
| 助手看不到动作 | 还没有任何声明 | 本章的预期行为 |
| 样式与宿主页面冲突 | 页面存在范围过宽的全局 CSS 或固定控件 | 收敛宿主样式，检查右下角视口 |

## 下一步

下一章开始声明业务能力：给任务模块一个区域，给每一行一个记录，给输入框一个填写动作，给提交按钮一个提交动作，再给每行一个完成动作。现有 DOM 和事件处理保持不变。

继续阅读 [原生页面快速上手](/zh/vanilla/quick-start-add-pling-to-a-vanilla-page)。
