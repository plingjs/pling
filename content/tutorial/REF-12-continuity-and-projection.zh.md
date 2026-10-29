---
id: REF-12
title: "连续性与投影"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 连续性与投影

连续性与投影回答两个不同问题。连续性规定哪个页面实例有权继续任务，以及共享哪些有界检查点；投影规定 Shadow DOM 与同源 iframe 边界内的控件如何进入同一套页面能力面。把两者混为一谈会产生错误安全模型：检查点不是执行租约，可见的 iframe 也不自动代表共享权限。

## 连续性范围

`@plingjs/agent` 提供三种范围：

| 范围 | 存储与裁决 | 适用场景 |
| --- | --- | --- |
| `tab` | 默认使用浏览器 `sessionStorage`，也可注入 `ContinuityStore` | 同一标签页内的 MPA 导航 |
| `browser` | 同源浏览器 authority；默认使用 `localStorage` 与租约协调 | 多标签页跟随任务或由用户显式接管 |
| `remote` | 宿主注入的 `ContinuityAuthority`，例如 `@plingjs/continuity-http` | 跨浏览器或跨设备 |

`scope` 默认是 `tab`。`remote` 必须显式提供 `authority`，不会悄悄退回本地存储。

```ts
createPling({
  continuity: {
    scope: "remote",
    authority: createHttpContinuityAuthority({ baseUrl: "/pling/continuity" }),
  },
});
```

### 检查点边界

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| `ttlMs` | 2 小时 | 超过该时间的检查点不恢复 |
| `maxMessages` | 20 | 最多保留的对话消息 |
| `maxEvents` | 60 | 最多保留的 UI 事件 |
| `maxChars` | 4000 | 单个字符串或参数的字符上限 |
| `leaseTtlMs` | 30 秒 | 执行 owner 的租约时长 |
| `takeover` | `"manual"` | 只有真人显式操作才能抢占活跃 owner |
| `maxTasks` | 20 | 共享任务发现上限 |
| `resume` | `"ask"` | 面向用户的恢复策略 |
| `returnOnDone` | 关闭 | 完成后回到同源页面；延迟最多五秒 |

检查点只包含有界任务摘要、近期消息、近期事件、页面身份与状态，不含 DOM、截图、Cookie、JWT、服务商密钥或任意应用状态。

## Authority 操作

`ContinuityAuthority` 是与传输无关的端口：

```ts
interface ContinuityAuthority {
  list(): Promise<ContinuityTaskSummary[]>;
  read(sessionId: string): Promise<ResidencyEnvelope | null>;
  create(input: CreateTaskInput): Promise<LeaseGrant>;
  claim(input: ClaimTaskInput): Promise<LeaseGrant>;
  renew(input: RenewLeaseInput): Promise<LeaseGrant>;
  release(input: ReleaseLeaseInput): Promise<void>;
  compareAndSwap(input: CompareAndSwapInput): Promise<ResidencyEnvelope>;
  remove(input: ReleaseLeaseInput): Promise<void>;
  subscribe?(listener: (change) => void): () => void;
  dispose?(): void;
}
```

后端必须原子校验 revision 与 lease。过期写入以 `REVISION_CONFLICT` 拒绝，不能覆盖更新的检查点。`preempt: true` 只用于用户显式接管。自动恢复可以以 follower 身份加入，但不能夺取活跃 owner。

`ContinuityChange` 只是通知元数据，包含类型、会话 id、revision、状态、owner/lease 标识、租约过期时间与时间戳。它不是第二套权限来源。通知丢失可能延迟 UI 更新，但每次写入仍校验当前租约与 revision。

## HTTP 集成

`@plingjs/continuity-http` 同时提供浏览器与后端：

- `createHttpContinuityAuthority(options)`：浏览器侧 authority；
- `createContinuityHandler({ backend, identity, ... })`：Web `Request → Response` 后端。

默认基础路径为 `/pling/continuity`。

| 方法与路径 | 操作 |
| --- | --- |
| `GET /health` | 健康检查 |
| `GET /session` | 解析身份 |
| `GET /events` | SSE 租约与 revision 元数据 |
| `GET /tasks` | 列出当前用户任务 |
| `POST /tasks` | 创建任务与租约 |
| `GET /tasks/:id` | 读取检查点 |
| `PUT /tasks/:id` | Compare-and-swap 更新检查点 |
| `DELETE /tasks/:id` | 仅 owner 删除 |
| `POST /tasks/:id/claim` | 领取或显式接管 |
| `POST /tasks/:id/renew` | 续租 |
| `POST /tasks/:id/release` | 释放租约 |

`userId` 只来自已验证身份，绝不从请求体读取。handler 把稳定后端错误映射为 HTTP 状态：

| 错误码 | HTTP |
| --- | --- |
| `UNAUTHORIZED` | `401` |
| `OWNER_MISMATCH` | `403` |
| `NOT_FOUND` | `404` |
| `TASK_EXISTS`、`REVISION_CONFLICT`、`LEASE_HELD`、`LEASE_REVOKED` | `409` |
| `LEASE_EXPIRED` | `410` |
| `INVALID_STATE` | `422` |
| `STORE_UNAVAILABLE` | `500` |

网络失败、`401` 与无法证明的租约都 fail-closed。页面不会仅因记得一份任务摘要就继续执行。

## 跨边界投影

### Shadow DOM

Shadow root 改变父节点遍历规则，不改变动作模型。声明仍留在元素上，DOM 层使用组合树跨越边界，使记录、区域、可用性与反馈保持同一语义。Shadow root 不建立第二份注册表。

### 同源 iframe

框架不会扫描或自动接管 iframe。父页面必须显式调用：

```ts
import { sharePlingPageWithFrame } from "@plingjs/dom";

const stop = sharePlingPageWithFrame(frame, page);
```

子页面可以读取或等待这份运行时：

```ts
import { plingPageFromParent, waitForPlingPageFromParent } from "@plingjs/dom";

const existing = plingPageFromParent();
const page = existing ?? await waitForPlingPageFromParent({ timeoutMs: 5000 });
```

共享内存路径要求同源。跨域 iframe 必须通过显式 `postMessage` 或 Surface 传输，并各自完成身份与权限校验。读取 `contentWindow` 失败不是授权结果。

同一页面嵌入多个框架岛时，为每个适配器设置短 `namespace`。动作、区域、记录、状态与反馈的 id 会加上 `namespace/` 前缀。命名冲突体现在完整 id 上，不会靠多个注册表掩盖。

## 不应推断

- 投影出的控件不自动适合对外暴露；暴露范围仍是 `expose` 与会话 scope 的交集。
- 检查点不授予执行权；有效租约才授予。
- 可见的跨域 iframe 不是共享运行时。
- SSE 消息不是持久任务事实。
- 浏览器 `localStorage` 协调不是跨设备 authority。

## 验证

对一次性命名空间运行后端一致性套件：

```ts
import { assertContinuityBackendConformance } from "@plingjs/continuity-http/testing";

await assertContinuityBackendConformance(productionBackend, {
  expiryTtlMs: 1_100,
  advanceTime: () => clock.advance(1_200),
});
```

它检查用户隔离、重复创建、非抢占领取、接管、过期 compare-and-swap、续租、释放与重新领取、仅 owner 删除以及租约过期。内置内存后端只是测试参考，不是生产存储。

相关参考实现覆盖 MPA 连续性、Shadow DOM 投影、同源 iframe 投影、跨标签页跟随与接管、跨标签页分叉、跨设备连续性，以及服务端连续性存储。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/continuity-http` `0.1.0-alpha.2` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；HTTP 后端需 Node.js 20 或更高版本 |
| Peer 依赖 | 无 |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

连续性后端实现的是本包定义的端口；内存后端只是测试夹具。因此兼容性同时取决于包版本与后端的一致性测试结果。
