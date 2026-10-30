# Pling · 页灵

[English](./README.md)

Pling 是面向 Web 应用的开放能力层。页面声明 Agent 可以查看什么、可以执行什么；
Agent 通过用户正在使用的控件和业务逻辑完成操作。校验、授权、状态与最终决定权仍属于应用。

Pling 不是浏览器 Agent，不替代后端 API，也不是通用点击层。它在 Web 应用与
Agent 运行时之间提供一个有边界、可审计的接口。动作对 Agent 可见，不等于它已被授权。

> 状态：`0.1.0-alpha.3`。包 API 与 Surface 协议仍可能变化。用于生产环境前，请查看
> [版本与升级说明](https://plingjs.dev/zh/releases/)。

## 主要能力

- **声明式能力**：动作、记录、区域和只读状态由应用命名，不依赖选择器猜测。
- **页面内执行**：Agent 调用与人相同的处理器、校验和确认流程。
- **有界上下文**：模型只得到当前任务所需的记录、字段、区域与视图状态。
- **人的决定权**：确认、人工接力、委托访问与审计都是明确边界，而不是模型自行判断。
- **外部 Agent 契约**：`pling.surface/0.1` 用 `describe` / `invoke` 定义页面之外的安全访问。

## 包

| 包 | 职责 |
| --- | --- |
| `@plingjs/core` | 框架无关的注册表、策略、执行与变更证据 |
| `@plingjs/ui` | 共享语言、消息、主题与类名契约 |
| `@plingjs/dom` | DOM 定位、可见性、滚动与浏览器原语 |
| `@plingjs/agent` | Agent 循环、上下文、确认、连续性与观测 |
| `@plingjs/surface` | Agent Surface 投影与 `describe` / `invoke` 协议 |
| `@plingjs/surface-browser` | 页面侧 Surface 会话、WebSocket 传输、桥接与重连生命周期 |
| `@plingjs/delegation` | 委托凭证契约与 Web 标准处理器 |
| `@plingjs/continuity-http` | 跨设备任务连续性的 HTTP 集成 |
| `@plingjs/server` | Node 模型网关：凭据、鉴权、限额与审计 |
| `@plingjs/vue` | Vue 3 适配器与助手界面 |
| `@plingjs/react` | React Provider、Hooks 与助手界面 |
| `@plingjs/vanilla` | 原生 JavaScript / jQuery 页面适配器 |
| `@plingjs/vue2` | Vue 2.7 适配器，能力子集有明确说明 |

## 文档

- [文档首页](https://plingjs.dev/zh/start/)
- [Vue 快速上手](https://plingjs.dev/zh/vue/quick-start-add-pling-to-a-vue-app)
- [React 快速上手](https://plingjs.dev/zh/react/quick-start-add-pling-to-a-react-app)
- [原生 JavaScript 与 jQuery](https://plingjs.dev/zh/vanilla/)
- [Agent Surface](https://plingjs.dev/zh/surface/)
- [协议规范 0.1](https://plingjs.dev/zh/spec/0.1/)

## 本地开发

```bash
pnpm install
pnpm build
pnpm tutorial:build
pnpm dev:docs
```

打开 `http://localhost:5190/`。工作区包通过各自的 `dist/` 解析，所以新检出的
仓库要先执行一次 `pnpm build`；教程预览同样是生成产物，再执行一次
`pnpm tutorial:build`。入门示例使用确定性的脚本模型，不需要模型密钥。

单独构建并检查一个教程夹具：

```bash
pnpm tutorial:dev v3-03
pnpm tutorial:check v3-03
```

## 仓库结构

```text
packages/   框架包，运行实现只在这里
examples/   公开示例，包括带登录的 Todo Surface 应用
content/    双语教程源稿与目录契约
website/    VitePress 文档站
services/   可独立运行的参考服务
deploy/     通用 Docker、Caddy 与自托管参考
skills/     可复用的 Agent 接入指南
scripts/    仓库与发布检查
```

## 验证

```bash
pnpm check
pnpm release:check
pnpm build
pnpm typecheck
pnpm test
pnpm pack:check
pnpm --filter @plingjs/website build
```

各包与示例还提供自己的 `test`、`typecheck` 和 `dev` 脚本。教程夹具使用当前工作区打出的
tarball 验证，不使用未发布的源码别名。

## 安全

模型密钥只能放在服务端，不得写入前端环境变量或公开构建产物。安全问题请按
[SECURITY.md](SECURITY.md) 私下报告，不要创建包含密钥或客户数据的公开 Issue。

## 许可证

Apache-2.0。见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
