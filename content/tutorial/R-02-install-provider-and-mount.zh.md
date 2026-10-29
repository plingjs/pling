---
id: R-02
title: "安装、Provider 与首次挂载"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 安装、Provider 与首次挂载

本章在 React 应用里安装适配器、建立唯一的页面运行时，并挂载助手入口。配置模型以后，助手可以回答问题，但还没有任何业务动作可以执行。这个空结果是有意保留的：安装 Pling 本身不应该顺带扩大页面暴露面。

适配器不接管 React 的状态、路由、表单或渲染。它只增加一层声明，把已有的页面区域、数据和控件描述给 Agent；业务状态更新和事件处理仍留在原组件中。

## 安装适配器

用项目现有的包管理器安装 `@plingjs/react`：

| 包管理器 | 命令 |
| --- | --- |
| pnpm | `pnpm add @plingjs/react` |
| npm | `npm install @plingjs/react` |
| Yarn | `yarn add @plingjs/react` |

`@plingjs/react` 要求 React 18 或更新版本。安装它会同时带入适配器、Agent 运行时、DOM 执行层和问答入口所需的样式。React 的 Dock 会自行注入组件样式，因此不需要像 Vue 3 那样额外引入 `style.css`。

本章示例使用 Vite。适配器本身不依赖 Vite；换用其他构建工具时，只要应用在浏览器中渲染，安装和 Provider 的写法不变。模型配置不再自动读取 `VITE_AGENT_*`，需要按“配置模型”一节显式传入。

## 建立唯一的运行时

在应用入口创建运行时，不要把它放进 React 组件：

```tsx{2,7}
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import App from "./App";
import "./styles.css";

const pling = createPling();

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);
```

`createPling()` 持有页面的能力注册表。`PlingProvider` 只负责把这个实例交给子树中的 hooks 和助手组件。

不要在每次渲染、可能重复执行的 effect 或每个业务组件里调用 `createPling()`。那会产生多份注册表，页面、记录和助手看到的能力就不再一致。如果应用有多个独立的 React 根，并且它们属于同一个页面，应当在入口创建一次，再把同一个实例交给各个 Provider。

## 挂载助手入口

把 Dock 放进页面外壳：

```tsx{1,7}
import { AgentDock } from "@plingjs/react";

export function App() {
  return (
    <main>
      {/* 应用自己的页面内容留在这里。 */}
      <AgentDock title="页面助手" />
    </main>
  );
}
```

`AgentDock` 提供启动按钮、对话面板、执行活动和运行时的模型状态。它不会包住或接管业务状态。它是固定定位元素，接入前应检查是否与现有悬浮控件或页脚重叠。

此时页面里还没有 `usePlingTool()`、`usePlingRecord()` 或区域声明。注册表为空是预期结果。

## 配置模型

在 Vite 项目中，适配器读取与其他浏览器适配器相同的 `VITE_AGENT_*` 变量。开发值放在 `.env.local`：

```bash
VITE_AGENT_BASE_URL=https://api.example.com/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
```

修改文件后要重启 Vite。这些值在开发服务器启动时读取。

其他构建工具没有这套自动查找，需要在 `createPling` 中显式传入：

```tsx{1,5}
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

显式配置会按字段覆盖环境变量。打包进浏览器应用里的密钥可以被用户读到，因此这只适合开发。生产页面通常应请求同源模型网关。

三个配置项分别负责不同的事：

| 配置 | 控制什么 | 常见错误 |
| --- | --- | --- |
| `baseUrl` | OpenAI 兼容 API 的根地址 | 少了 `/v1`，或误填模型厂商的网页地址 |
| `model` | 请求中发送的模型 id | 使用界面展示名而不是 API 模型 id |
| `apiKey` | 直连模型端点时的认证 | 提交真实密钥，或在需要认证的公开端点上留空 |

如果模型服务不允许浏览器直接请求，可以配置 Vite 开发代理，并把 `VITE_AGENT_BASE_URL` 指向同源路径：

```bash
VITE_AGENT_BASE_URL=/llm/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
VITE_AGENT_PROXY_TARGET=https://api.example.com
```

示例的 Vite 配置会在浏览器跨源请求之前，把 `/llm/*` 转发到目标源。

## 运行示例

可运行源码位于 `examples/tutorials/r-02-install-provider/`。在仓库副本中执行：

```bash
git clone https://github.com/plingjs/pling.git
cd pling
pnpm install
pnpm tutorial:dev r-02
```

打开 `http://127.0.0.1:5238/`。中文界面使用 `pnpm tutorial:dev r-02 --locale zh`，然后打开 `http://127.0.0.1:5238/?lang=zh`。

命令会打包本章使用的 `@plingjs/*` 依赖，把示例复制到 `.tmp/tutorials/r-02/app`，在隔离目录中安装这些 tarball，再启动 Vite。这样验证的是发布包的消费路径，而不是直接引用 workspace 源码。

检查：

1. 页面正常显示原有的四项安装检查。
2. 状态徽标仍是 **0 个动作**。
3. 右下角按钮能打开助手。
4. 配置模型后，发送简单问题能得到回复。
5. 运行记录里没有执行过任何业务动作。

## 为什么还没有 `usePlingTool`

安装 Provider 是应用级决定，暴露一个按钮是业务级决定。把两者混在一起，很容易让页面在不经意间把所有控件都交给 Agent。

下一章从一个完整 Todo 页面出发，只给任务区域、任务行、新增输入框、提交按钮和每行完成控件添加 hook。筛选与删除暂时不声明，直到后续章节明确需要开放。

## 常见故障

| 现象 | 可能原因 | 检查什么 |
| --- | --- | --- |
| 提示 `pling: 请先用 <PlingProvider ...>` | Pling hook 渲染在 Provider 之外 | 让 Provider 包住所有使用 Pling 的组件 |
| 看不到启动按钮 | `AgentDock` 不在实际挂载的树里 | 把它放进根应用外壳 |
| 提示缺少模型地址 | `.env.local` 不存在、变量名错误，或 Vite 未重启 | 对照变量名并重启开发服务器 |
| 报 `Failed to fetch` | 模型服务阻止浏览器请求，或端点错误 | 使用开发代理并核对目标源 |
| 出现两份助手 | 多个根无意中各创建了一次运行时和 Dock | 每个页面保留一个运行时、每个外壳保留一个入口 |
| 助手看不到任何控件 | 还没有挂载声明 hook | 本章的预期行为 |

继续阅读 [React 快速上手：一个可用的 Todo Agent](/zh/react/quick-start-add-pling-to-a-react-app)。
