---
id: RCP-13
title: "使用自己的模型密钥"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 使用自己的模型密钥

自带密钥（BYOK）指使用页面的人提供 OpenAI 兼容端点、模型名和 API key。它只解决一个范围很窄的问题：本地工具或可信内网页面需要连接模型，但不希望把密钥写进构建产物。

它不是服务端模型网关的替代品。密钥一旦进入浏览器，页面的 JavaScript、浏览器扩展、错误上报以及能够接触这个会话的人都能读到它。Pling 可以不把密钥写入持久化存储，但不能对同源代码隐藏它。

## 可运行页面

下面的页面使用内置 Activity 设置连接兼容模型。页面只显示端点、模型、持久策略与请求状态；密钥由运行时持有，不进入记录或页面状态。

<DemoPlayground id="recipe-model-key" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-model-key/?lang=zh`，在助手 Activity 中填写自己的兼容端点、模型与密钥。源码在 `examples/demos/recipe-model-key/`；示例本身不包含供应商密钥。

## 先确定连接归属

| 场景 | 推荐路径 | 原因 |
| --- | --- | --- |
| 公开 Demo 或 SaaS | 同源网关，密钥留在服务端 | 访客不应持有供应商凭据 |
| 企业管理模型 | 服务端别名或网关 | 便于统一轮换、限额与审计 |
| 本地工具或可信内网页面 | BYOK 表单，`memory` 持久化 | 不产生构建期密钥，生命周期短 |
| 用户想用自己的 Agent 操作站点 | Pling Surface | 这是授权问题，不是收集密钥 |

如果需求是“让我的 Codex 或 Claude agent 使用这个网站”，正确做法是接入 Surface。页面里的 provider key 输入框不会给外部 agent 有作用域的权限，反而会把应用变成凭据收集器。

## 契约

Vue 3 适配器提供内建设置界面。React、原生 JS / jQuery 与 Vue 2.7 共用同一套模型配置，但不渲染这个界面；表单和生命周期由宿主应用负责。

| 设置 | 含义 | 默认 |
| --- | --- | --- |
| `mode: "off"` | 不显示模型设置入口 | 是 |
| `mode: "readonly"` | 展示应用托管的端点与模型，不显示密钥 | 否 |
| `mode: "byok"` | 允许填写 OpenAI 兼容端点、模型与密钥 | 否 |
| `persist: "memory"` | 密钥只存在于当前运行时 | 是 |
| `persist: "session"` | 密钥写入 `sessionStorage`，标签页关闭时清除 | 否 |
| `localStorage` | 跨标签页、跨重启的浏览器存储 | 不支持 |

`readonly` 仍需要应用提供端点与模型。它只报告既有连接，不允许用户切换到另一套连接。

`byok` 不是企业密钥托管。它是显式开启的用户自有连接。应用已经注入 `llm` 时，Vue 3 的 `byok` 入口会隐藏，因为表单不能替换应用自己的模型传输。

## Vue 3

在实际挂载的入口上开启：

```vue
<AgentDock :model-settings="{ mode: 'byok', persist: 'memory' }" />
```

也可以让同一个 Pling 实例创建的所有问答入口都带上设置：

```ts
import { createPling } from "@plingjs/vue";

const pling = createPling({
  agent: {
    modelSettings: { mode: "byok", persist: "session" },
  },
});
```

组件属性优先于应用级配置。若要只展示应用托管连接、不提供密钥输入：

```vue
<AgentDock model-settings="readonly" />
```

保存时先做本地校验。直接的 `http(s)` 端点必须提供密钥；`/api/llm/v1` 这样的相对端点可以交给同源网关鉴权。随后运行时会被替换：取消旧会话、清空待确认与人工接力、重置对话与诊断记录，并在同一个入口下启动新的运行时。这样旧模型的工具调用不会落入新模型的上下文。

内置表单可用于 `AgentDock` 与 `AgentInline`，不属于 `AgentChat`。

## React

React 没有内置模型设置面板。表单、校验和持久化都属于宿主应用。`AgentDock` 在挂载时解析 `config`，所以更换连接应创建新的运行时，而不是原地修改一个已经解析过的配置。

用连接版本号作为 React key，不要把 API key 本身写进 key。

```tsx
import { useState } from "react";
import { AgentDock, PlingProvider, createPling } from "@plingjs/react";
import type { AgentConfigOverrides } from "@plingjs/agent";

const pling = createPling();

export function App() {
  // 只在没有进行中的 agent 运行时打开这个表单。
  const [connection, setConnection] = useState({
    revision: 0,
    config: {
      baseUrl: "/api/llm/v1",
      model: "app-chat",
      apiKey: "",
    } as AgentConfigOverrides,
  });
  const [draft, setDraft] = useState({ baseUrl: "", model: "", apiKey: "" });

  function saveConnection() {
    setConnection((current) => ({
      revision: current.revision + 1,
      config: { ...draft },
    }));
  }

  return (
    <PlingProvider pling={pling}>
      <form onSubmit={(event) => { event.preventDefault(); saveConnection(); }}>
        <input
          value={draft.baseUrl}
          onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
          placeholder="https://provider.example.com/v1"
        />
        <input
          value={draft.model}
          onChange={(event) => setDraft({ ...draft, model: event.target.value })}
          placeholder="model-name"
        />
        <input
          type="password"
          value={draft.apiKey}
          onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
          placeholder="sk-…"
        />
        <button type="submit">保存并开始新对话</button>
      </form>
      <AgentDock
        key={connection.revision}
        config={connection.config}
      />
    </PlingProvider>
  );
}
```

运行期间必须禁止保存。请求还在飞行中时替换运行时，会留下没有对应上下文的工具结果。公开的 `AgentDock` 事件没有可靠的 `isRunning` 标志，因此不要根据 `notice` 之类的事件猜运行状态。更安全的做法是只在空闲的设置界面显示这个表单，或者自己创建运行时并等待 `session.send()` 结束后再允许替换。如果宿主确实要跨刷新保留密钥，应只在明确接受风险时使用 `sessionStorage`，不要退到 `localStorage`。

## 原生 JS / jQuery

原生适配器同样没有设置面板。可以在保留 Pling 实例与页面声明的前提下，用一个新 `config` 重建 Dock。

```ts
import { createPling, type VanillaDock } from "@plingjs/vanilla";
import type { AgentConfigOverrides } from "@plingjs/agent";

const pling = createPling();

pling.action({
  id: "add_todo",
  desc: "新增一条待办",
  kind: "write",
  params: [{ name: "text", label: "待办内容", minLength: 1 }],
  run: (args) => addTodo(String(args.text)),
});

let dock: VanillaDock = pling.dock({
  config: { baseUrl: "/api/llm/v1", model: "app-chat", apiKey: "" },
});

function useConnection(config: AgentConfigOverrides) {
  if (dock.runtime.session.status() === "running") return;
  dock.destroy();
  dock = pling.dock({ config });
}
```

`dock.destroy()` 会移除旧运行时、旧对话和待确认操作。动作声明仍留在 `pling` 上，新 Dock 看到的还是同一组页面能力。宿主若要保留用户填写的草稿，应在标签页关闭时清除；不要自行补一个 `localStorage` 兜底。

## Vue 2.7

Vue 2.7 复用共享原生 Dock，生命周期与上一节相同。它没有内置设置表单。

```ts
import Vue from "vue";
import { createPling, type Vue2Pling } from "@plingjs/vue2";
import type { AgentConfigOverrides } from "@plingjs/agent";

const pling: Vue2Pling = createPling();
Vue.use(pling.plugin);

let dock = pling.dock({
  config: { baseUrl: "/api/llm/v1", model: "app-chat", apiKey: "" },
});

function useConnection(config: AgentConfigOverrides) {
  if (dock.runtime.session.status() === "running") return;
  dock.destroy();
  dock = pling.dock({ config });
}
```

新 Dock 会创建新会话。Vue 2.7 不提供内置模型设置或调试面板，也不会替用户收集密钥。应用需要设置页时，在自己的 Vue 2 页面里实现，再把结果传给 `pling.dock({ config })`。

## 存储与暴露

| 存储位置 | 生命周期 | 不能解决的问题 |
| --- | --- | --- |
| 运行时内存 | 到刷新或运行时替换为止 | 页面脚本、扩展与开发者工具仍可读取 |
| `sessionStorage` | 到标签页关闭；在该标签页内刷新仍保留 | XSS 与同源脚本；存储不是授权边界 |
| `localStorage` | 跨标签页、跨重启 | Pling 不支持；不要自行复制密钥实现 |
| 服务端网关 | 密钥不进入浏览器 | 仍需认证、租户限额与审计 |

密钥只用于构造请求的 `Authorization` 头。它不会进入系统提示词、聊天记录或页面状态。这减少了误泄露的机会，但不能防御能读取页面内存或模型请求本身的代码。

不要把密钥放进 URL、分析事件、错误消息、截图或支持工单。错误上报与遥测应屏蔽 `Authorization`、请求头和宿主侧的设置对象。

## 常见失败

| 现象 | 更可能的原因 | 处理 |
| --- | --- | --- |
| Vue 3 看不到设置入口 | `modelSettings` 是 `off`，或属性传给了未挂载的界面 | 在 `AgentDock` / `AgentInline` 或 `createPling({ agent })` 上开启 |
| `byok` 表单被隐藏 | 应用注入了自己的 `llm` | 保留注入传输；确实需要用户连接时再移除 |
| 刷新后密钥消失 | `persist` 是 `memory` | 产品接受额外暴露时才改为 `session` |
| 关闭标签页后密钥仍在 | 宿主把密钥写进了 `localStorage` | 删除这段代码；Pling 不提供持久化密钥存储 |
| 第一条请求仍使用旧模型 | 宿主只改了 `config`，没有重建 React 运行时或原生 Dock | 重新挂载 React 入口，或先 `dock.destroy()` 再创建新 Dock |
| 运行中仍能保存 | 宿主表单没有应用层保护 | 只在空闲时显示表单，或自己创建运行时并等待 `session.send()`；运行时替换不是飞行中更新 |
| 相对端点被要求填密钥 | 宿主对所有端点都强制密钥 | `/api/llm/v1` 交给网关鉴权；只对直接 `http(s)` 端点要求密钥 |
| 供应商拒绝请求 | 端点、模型 id 或上游策略不对 | 核对 API 根地址、模型标识与供应商的 CORS / 安全设置 |

## 验证

运行本页的独立示例：

```bash
pnpm dev:examples
```

在 **Activity** 中打开模型设置。页面同时提供 `memory` 与 `session` 两种持久化选择，便于对照刷新后的行为。

逐项检查：

1. `off` 时，运行界面没有模型设置入口。
2. `readonly` 时，能看到端点与模型，没有密钥输入框。
3. `memory` 时，刷新页面会清空已填写的密钥。
4. `session` 时，同一标签页刷新会恢复连接；关闭标签页后清空。
5. 运行期间保存按钮不可用。
6. 保存后旧对话被清空，并创建新运行时。
7. 请求诊断与系统提示词中没有 API key。

证据：

- 设置类型与存储规则：`packages/vue/src/model-settings.ts`。
- Vue 3 表单与运行时替换：`packages/vue/src/components/AgentModelSettings.vue`、`packages/vue/src/components/AgentInline.vue`。
- 本方案的可运行源码：`examples/demos/recipe-model-key/`。
- 网关部署：[接入模型网关](/zh/operations/connect-a-model-gateway)。

## 本地验证

先用 `memory` 保存模型，刷新页面后确认需要重新填写；再用 `session` 保存并刷新同一标签页，连接应恢复。最后检查系统提示词与模型请求消息，确认任何位置都没有出现密钥。
