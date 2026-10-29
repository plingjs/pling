---
id: V3-02
title: "安装与模型配置"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 安装与模型配置

本章在 Vue 3 应用里安装 Pling、配置模型并挂载助手入口。完成后助手能够回复，但页面还没有开放任何动作。

## 前置条件

你需要一个客户端 Vue 3 应用。Pling 不依赖 Vite；Vue 适配器只要求 Vue 3，以及能够导入 ES modules 和 CSS 的构建环境。本仓库的示例与命令使用 Vite。

本章基于环境变量的快捷配置只适用于 Vite。使用其他构建工具时，请通过 `createPling` 显式传入模型配置，后文会给出写法。

示例假设 Node.js 20 或更新版本。命令使用 pnpm，但发布包同样可以用 npm 和 Yarn 安装。

## 安装与初始化

安装 Vue 适配器：

| 包管理器 | 命令 |
| --- | --- |
| pnpm | `pnpm add @plingjs/vue` |
| npm | `npm install @plingjs/vue` |
| Yarn | `yarn add @plingjs/vue` |

`@plingjs/vue` 会带入它需要的框架无关运行时与 agent 包。这一步不需要额外的状态库、路由或后端服务。

在应用入口引入一次发布包样式：

```ts{1}
import "@plingjs/vue/style.css";
```

在创建应用的位置建立一个 Pling 实例，并安装 Vue 插件：

```ts{2,3,7,9}
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import "./styles.css";

const pling = createPling();

createApp(App).use(pling.plugin).mount("#app");
```

实例持有页面的能力注册表。`pling.plugin` 注册 Vue 指令，并把同一个实例交给助手组件。这是应用级接线，应该放在 `createApp` 旁边，而不是散落在每个业务组件里。

本章 Demo 通过 `createPling({ agent: { config: { limits: { maxTurns: 100 } } } })` 把轮数上限设为 100，这只是教程约定；生产默认仍是 10 轮。

## 挂载助手界面

把助手入口放进页面外壳：

```vue{2,10}
<script setup lang="ts">
import { AgentDock } from "@plingjs/vue";
</script>

<template>
  <main>
    <!-- 应用自己的内容保留在这里。 -->
  </main>

  <AgentDock title="页面助手" />
</template>
```

`AgentDock` 增加一个悬浮启动按钮和对话面板。它不会接管页面、修改路由，也不会包住业务状态。如果应用已经有页脚或悬浮控件，需要检查两者是否重叠。

此时页面里还没有 `v-tool`、`v-record` 或状态声明，助手没有任何可操作的页面能力。

## 配置模型连接

在 Vite 项目中，Pling 从 `VITE_AGENT_*` 环境变量读取模型设置。开发阶段把配置放在项目根目录的 `.env.local`：

```bash
VITE_AGENT_BASE_URL=https://api.example.com/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
```

创建或修改文件后要重启 Vite 开发服务。环境变量在开发服务器启动时读取。

使用其他构建工具时，这种基于环境变量的快捷配置不会生效。请在创建实例时显式传入配置：

```ts{1,5}
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

显式配置会按字段覆盖环境变量。它不是存放生产密钥的位置：任何打包进浏览器的值，用户都可以读到。等到页面接入模型网关时，再处理生产凭据。

如果模型服务不允许浏览器直接请求，且项目使用 Vite，可以改用开发代理：

```bash
VITE_AGENT_BASE_URL=/llm/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
VITE_AGENT_PROXY_TARGET=https://api.example.com
```

示例里的 Vite 配置会把 `/llm/*` 转发到目标源。浏览器发出的是同源请求，开发阶段因此不会被模型的 CORS 策略拦截。

这三个值各自负责不同的事：

| 配置 | 控制什么 | 常见错误 |
| --- | --- | --- |
| `baseUrl` | OpenAI 兼容 API 的根地址 | 少了 `/v1`；填成模型厂商的网页地址，而不是 API 地址 |
| `model` | 请求中发送的模型名 | 用了界面上的展示名，而不是 API 的模型 id |
| `apiKey` | 直连模型时的认证信息 | `https://` 地址下留空；或者把真实密钥提交到源码 |

缺少必要配置时，助手会指出缺少哪个环境变量，而不是发出请求后再显示一个难以理解的 401。使用 `/llm/v1` 这样的相对 `baseUrl` 时，浏览器端不需要密钥；认证应由拥有该路径的代理或网关负责。

### 让用户填写模型（可选）

大多数应用不应该在聊天窗口里暴露模型表单。默认是 `off`。只有连接确实属于访问者时，才需要下面两种显式模式：

| 模式 | 运行（Activity）里显示什么 | 适用场景 |
| --- | --- | --- |
| `off` | 不显示 | 生产应用的默认值 |
| `readonly` | 地址、模型和“由应用托管”；不显示密钥 | 网关固定端点与模型 |
| `byok` | 可填写地址、模型和 API key | 本地工具、可信内网、演示页 |

```vue
<AgentDock :model-settings="{ mode: 'byok', persist: 'session' }" />
```

保存连接会取消当前运行时、清空对话，并用新的地址和模型开始新会话。密钥默认只保存在内存中；`persist: "session"` 会把配置保留在 `sessionStorage` 直到标签页关闭，Pling 不会把它写入 `localStorage`。

`byok` 是 **Bring Your Own Key** 的缩写。当前设置对象只有两个参数：`mode` 和 `persist`。`persist` 也只有两个可选值：`"memory"`（默认，刷新页面即丢失）和 `"session"`（保留到当前标签页关闭）。`readonly` 没有用户密钥，`persist` 会被忽略。

`byok` 不是公开 SaaS 的凭据模型。页面持有的密钥可能被页面脚本、浏览器扩展、错误上报和开发者工具读取。公开演示应使用同源网关和 `readonly`。如果应用已经注入自己的 `llm`，`byok` 表单会隐藏，因为表单不能替换应用掌握的模型传输。

这个内建表单只属于 Vue 3 适配器。React、原生 JS 与 Vue 2.7 需要宿主应用自己的设置页或服务端网关；四端接入、密钥存储与失败处理见[使用自己的模型密钥](/zh/recipes/use-your-own-model-key)。

## 验证安装结果

本章的可运行示例位于 `examples/tutorials/v3-02-install-first-render/`。如果还没有仓库副本，先克隆并安装依赖：

```bash
git clone https://github.com/plingjs/pling.git
cd pling
pnpm install
```

在仓库根目录启动本章示例：

```bash
pnpm tutorial:dev v3-02 --locale zh
```

命令会构建并打包本章依赖的 `@plingjs/*` 包，把示例复制到 `.tmp/tutorials/v3-02/app`，在隔离目录中安装这些包，然后启动 Vite。打开：

```text
http://127.0.0.1:5199/?lang=zh
```

检查：

1. 页面显示 **已连接，尚未开放任何操作**。
2. 状态标记仍然是 **0 个动作**。
3. **问助手**启动按钮能打开助手。
4. 发送一个简单问题，能得到回复。
5. 运行里没有执行过任何页面动作。

所有教程示例都在 `examples/tutorials/`，每章一个目录。`@plingjs/*` 统一来自仓库根目录的 `packages/`；`pnpm tutorial:dev` 会打包这些包，并在临时副本中通过 tarball 安装，因此验证的是发布包路径，而不是 workspace 源码。普通项目接入不需要克隆仓库；克隆仓库是为了阅读示例、运行固定版本或参与框架开发。

## 常见故障

| 现象 | 可能原因 | 检查什么 |
| --- | --- | --- |
| 助手面板没有样式 | 没有引入发布包样式 | 在应用入口加入 `import "@plingjs/vue/style.css"` |
| 后续页面提示 `Failed to resolve directive: tool` | Vue 插件没有安装 | 在挂载应用前调用 `.use(pling.plugin)` |
| 看不到启动按钮 | `AgentDock` 没有被渲染进当前组件树 | 放进真正挂载的页面外壳 |
| 助手提示没有配置模型地址 | `.env.local` 不存在、变量名拼错，或开发服务没有重启 | 对照提示里的变量名检查，并重启 Vite |
| 请求报 `Failed to fetch` | 模型服务不允许浏览器请求，或地址错误 | 使用开发代理，并核对目标源 |
| 模型返回 404 | `baseUrl` 或模型名错误 | 检查 API 根路径后缀与厂商的模型 id |
| 助手什么都点不了 | 页面还没有声明动作 | 本章的预期行为，继续看快速上手 |

最后一行不是故障。空的动作列表恰好证明这次接入没有悄悄扩大页面表面。

## 本章边界与后续

本章没有开放任何业务控件，也没有把记录、区域或页面状态提供给模型。空的动作列表是预期结果，不是需要修补的缺陷。

下一章从一个完整的 Todo 页面出发，声明已有的任务输入框和提交按钮。到那时，助手才会第一次通过页面原本的表单处理路径完成实际操作。

继续阅读 [Vue 快速上手：接入 Pling](/zh/vue/quick-start-add-pling-to-a-vue-app)。
