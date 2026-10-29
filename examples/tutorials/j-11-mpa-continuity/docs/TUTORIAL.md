# Pling 062 · 多页应用（MPA）连续性

> 适用：服务端渲染、模板站、传统多页站点，或任何「点一个链接就整页卸载」的应用。
> 目标不是把 DOM 复制到下一页，而是把**任务做到哪了**接上。

## 1. 介绍

SPA 的路由切换不会销毁 document，Pling 的会话、历史、注册表一直在内存里。MPA 不一样：

```text
列表页 document
  ├─ registry（本页动作）
  ├─ session（目标 / 历史 / 事件）
  └─ token vault（本页敏感值）
      ↓ 点击 <a href> / location.href
浏览器卸载整个 document，内存全部消失
      ↓
详情页 document
  ├─ registry：本页重新声明
  ├─ session：默认全新
  └─ token vault：全新随机盐
```

`continuity` 做的事只有一件：在每次事件 / 历史变化时，把一个**有界检查点**写进
`sessionStorage`；下一个同源 document 启动时，把它恢复成一段合法的模型历史。

它**不会**：

- 恢复 DOM、元素引用或注册表；
- 自动重跑上一页的动作；
- 恢复待确认审批或人工接力；
- 把敏感真值写进存储；
- 跨标签页共享任务（`sessionStorage` 天然按标签页隔离）。

本案例额外开启「恢复后自动继续」和「完成后回到开始页」；两项都默认关闭，下面逐项说明。

## 2. 快速上手

两个页面共用同一份 agent 接线：

```ts
// demo/setup.ts
import type { AgentSetup } from "@plingjs/vanilla";

export const agentSetup: AgentSetup = {
  continuity: {
    resume: "auto",       // 新 document 自动继续
    returnOnDone: true,   // 恢复任务完成后回到开始页
  },
  config: { limits: { maxTurns: 100 } }, // demo 用；生产默认 10
};
```

列表页和详情页各自建自己的 `createPling()`：

```ts
const pling = createPling({ agent: agentSetup });
pling.registry.setPage({ path: "/demo/index.html", title: "客户回访" });
pling.dock({ title: "客户助手" });
```

```ts
const pling = createPling({ agent: agentSetup });
pling.registry.setPage({ path: "/demo/detail.html", title: "客户详情" });
pling.dock({ title: "客户助手" });
```

只要满足下面三条，整页跳转后就会接上：

1. 同一个**标签页**；
2. 同一个 **origin**；
3. 两个页面使用同一个存储 key（默认 `pling:continuity`）。

同一个标签页只应有一个启用了 `continuity` 的会话。多个入口同时写同一个 key 会互相覆盖；
混合框架页面里请只给一个 dock 开连续性。

## 3. 详细功能

### 3.1 检查点里有什么

| 字段 | 作用 | 默认上限 |
| --- | --- | --- |
| `goal` | 用户最初的任务目标 | 首次 `send()` 的输入 |
| `page` | 上一页的 `PageView`（路径 / 标题） | 有界 |
| `startPage` | 这次任务最开始的位置；完成后返回用 | 首次 `send()` 时记录 |
| `messages` | 最近完整消息（不含 system） | 20 条 / 单条 4000 字符 |
| `events` | 最近事件（对话与「最近操作」用） | 60 条 |
| `summary` | 已压缩历史的摘要 | 有界 |
| `status` | `active` / `done` | — |
| `updatedAt` | TTL 判据 | 默认 2 小时 |

`assistant_delta` 每个 token 一次，不落盘；其余事件会触发保存。

### 3.2 系统提示会按新页面重建

`system` 不保存。恢复后第一轮请求仍然是：

```text
新的页面快照（本页动作 / 区域 / 记录 / 状态）
+ 旧对话历史
+ 用户这次说的话
```

所以模型不会拿着上一页的动作清单去点新页面。

### 3.3 导航截断：结果未知，而不是成功

如果页面在 tool call 执行期间卸载，历史里会留下：

```text
assistant(toolCalls: open@c2)
```

但没有对应的 `role=tool`。直接发给模型会因配对断裂被服务端 400。恢复时会补一条：

```text
（页面在动作执行期间发生了整页导航 / 卸载，这一步的结果未知。
  请先观察当前页面，不要假设动作成功。）
```

这条边界是刻意 fail-closed 的：宁可让模型重新观察，也不伪造成功。

### 3.4 恢复策略：ask / auto / off

恢复入口由 `resume` 控制，默认 `"ask"`：

| 值 | 行为 |
| --- | --- |
| `"ask"`（默认） | 显示「继续上次任务」，用户点了才发消息 |
| `"auto"` | 恢复后自动发一条受控的「继续」消息 |
| `"off"` | 只恢复上下文，不显示入口、不自动发送 |

```ts
const agentSetup: AgentSetup = {
  continuity: {
    resume: "auto",       // 想自动推进时显式选；默认仍是 ask
    returnOnDone: true,   // 恢复中的任务完成后回到开始页
  },
  config: { limits: { maxTurns: 100 } },
};
```

`auto` 不绕过循环：模型仍要先观察新页面、重新选择动作；危险动作仍会弹确认。一个入口只会自动续跑一次，
界面重渲染不会重复发送（`runtime.continuity.claimAutoResume()`）。

`ask` / `auto` 恢复时，原生浮窗会：

- 启动器文案变成「继续上次任务」；
- 对话顶部显示上次目标；
- 如果上一页停在动作执行中，额外提示「结果未知」；
- `ask` 提供「继续上次任务」与「忽略」两个按钮；`auto` 自动发送后收起恢复卡片。

「继续」发送的是一条受控用户消息：

```text
继续上次的任务。先观察当前页面，再决定下一步；
如果上一页的动作结果未知，不要假设它已经成功。
```

它不会覆盖原来的 `goal`。「忽略」等价于 `session.reset()`，同时清空检查点。

#### 完成后返回（`returnOnDone`）

```ts
continuity: {
  returnOnDone: true,                    // 回到首次 send() 的页面
}

continuity: {
  returnOnDone: "./index.html?done=1",   // 显式同源地址
}

continuity: {
  returnOnDone: { to: "/orders", delayMs: 800 },
}
```

| 值 | 行为 |
| --- | --- |
| `false` / 不传（默认） | 不返回 |
| `true` | 回到任务开始页 `startPage` |
| `string` | 回到这个同源地址 |
| `{ to?, delayMs? }` | 显式地址 / 延迟；默认 500ms，限制 0–5000ms |

只有「从检查点恢复的 active 任务」产生 `final` 后才返回。失败、取消、达到最大轮数但没有 `final`
都不返回；每次 document / 会话最多返回一次；恢复页上新起的任务也不会触发旧任务返回。

导航前会再做同源校验，跨源 / `javascript:` / 空地址拒绝。默认用 `location.replace()`，避免
「列表 → 详情 → 列表」形成历史回退环。若当前已经在开始页，`true` 不会 reload。

测试 / 自定义宿主可以注入导航实现：`pling.dock({ navigate })`。普通业务不需要传。

### 3.5 审批与人工接力不恢复

确认队列和人工接力队列都是**当前 document 的内存状态**，不进入检查点。理由：

- 审批绑定的是「这次动作」与当时的页面上下文；换页后重放它没有意义；
- 自动恢复一个待确认的危险动作，会让用户在没看清新页面的情况下批准旧动作。

恢复后如果需要审批，模型必须重新发起动作、重新走确认。

### 3.6 敏感值：只保存代号，不保存真值

落盘前会调用 `registry.redactText()`，把本页已登记的敏感真值换回 `{{p:...}}` 代号。
检查点里不会出现手机号、证件号等真值。

**跨 document 的边界**：token vault 的盐是每个 document 随机生成的，旧代号在新页面
无法解析成真值。模型如果把旧代号原样塞进动作参数，执行器会按「未知 token」fail-closed。
这是刻意的：宁可拒绝，也不把真值写进 `sessionStorage`。新页面应重新暴露自己的敏感代号。

### 3.7 业务数据要自己跨页保存

连续性只接 agent 的任务，不接业务数据。案例里客户列表与备注存在
`sessionStorage["case062:customers"]`，agent 检查点存在 `sessionStorage["pling:continuity"]`，
两者互不依赖。

## 4. API 参考

### `createPling({ agent: { continuity } })`

```ts
type ContinuitySetting = false | "tab" | ContinuityOptions;

interface ContinuityOptions {
  key?: string;            // 默认 "pling:continuity"
  ttlMs?: number;          // 默认 2 小时
  maxMessages?: number;    // 默认 20
  maxEvents?: number;      // 默认 60
  maxChars?: number;       // 单条字符串上限，默认 4000
  store?: ContinuityStore; // 自定义同步存储
  now?: () => number;      // 测试时钟
  resume?: "ask" | "auto" | "off"; // 默认 "ask"
  returnOnDone?: false | true | string | { // 默认 false
    to?: string;
    delayMs?: number;      // 默认 500，限制 0–5000
  };
}

interface ContinuityStore {
  load(): ContinuitySnapshot | null;
  save(snapshot: ContinuitySnapshot): void;
  clear(): void;
}
```

`false` / 不传 = 关闭。`"tab"` = 同标签页 `sessionStorage`。

### `runtime.continuity`

```ts
interface ContinuityController {
  enabled: boolean;
  restored: boolean;                 // 本次 document 是否恢复
  checkpoint: ContinuityCheckpoint | null;
  resume: "ask" | "auto" | "off";    // 当前入口策略
  claimReturn(): { href: string; delayMs: number } | null; // 完成时只给出一次返回目标
  claimAutoResume(): boolean;        // auto 只消费一次；自定义 UI 发消息前调用
  save(): void;                      // 立即写一次（一般不用手动调）
  clear(): void;                     // 清空存储与内存状态
}

interface ContinuityCheckpoint {
  goal?: string;
  page?: PageView;
  startPage?: PageView;
  updatedAt: number;
  status: "active" | "done";
  interrupted: boolean;              // 上次停在 tool_call / handoff 请求
}
```

### 自定义存储

```ts
const runtime = createAgentRuntime({
  config,
  registry,
  continuity: {
    store: {
      load: () => myCache.get(),
      save: (snapshot) => myCache.set(snapshot),
      clear: () => myCache.delete(),
    },
  },
});
```

存储必须是同步的。企业可以换成自己的加密缓存；框架不引入后端。

## 5. 验证

```bash
pnpm --filter @plingjs/case-062-mpa-continuity test
pnpm --filter @plingjs/agent test
pnpm --filter @plingjs/case-062-mpa-continuity dev
```

自动化测试覆盖：

1. 列表页的「查看详情」是真实 href；
2. 详情页填写 / 保存 / 归档落到业务对象；
3. 同 store 的新 document 恢复目标与对话，浮窗显示继续入口；
4. 截断的 tool call 恢复后补「结果未知」；
5. 新 store 不恢复（新标签页隔离）；
6. 连续三页导航仍保留最早的目标与中间页结果；
7. `auto` 只消费一次，`ask` / 已完成任务不自动续跑；
8. 恢复任务完成后只导航回开始页一次，返回目标做同源校验。

`@plingjs/agent` 还覆盖 TTL、reset、敏感值脱敏、三页串联与「审批不恢复」；
原生 / Vue / React 三端浮窗各覆盖 `auto` 自动续跑一次且仍走确认闸门。

手工验证场景：

```text
Globex的备注为：周五约吃饭
```

预期：列表页点击进入详情页 → 整页重载 → agent 自动继续填写并保存 → 约 500ms 后自动回到列表页。
不需要你重复目标；回来之后也不会再自动跳转。

## 6. 已知限制

- **同源、同标签页**：跨 origin 不恢复；新标签页不继承。
- **不是 bfcache**：浏览器前进 / 后退恢复页面时，continuity 也可能再恢复一次；两者不冲突，
  但业务要保证自己的数据源一致。
- **检查点有界**：超过 20 条消息 / 60 条事件只保留最近部分；完整审计要写业务日志。
- **旧敏感代号不可执行**：见 §3.6，这是安全取舍。
- **存储可能不可用**：隐私模式 / 配额满时自动退化成「这一页不续接」，不影响业务。
- **自动续跑不是跳过审查**：`resume: "auto"` 只是自动发一条受控继续消息；危险动作、不可用动作、
  最大轮数等约束仍然生效。
- **完成不等于业务成功**：`returnOnDone` 以循环产生 `final` 为完成信号；关键结果仍应由业务校验。
- **返回只允许同源**：这是安全边界，不是可通过配置绕过的路由能力。
