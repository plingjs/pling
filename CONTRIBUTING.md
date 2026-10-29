# Contributing to Pling

Pling 是一个 pnpm workspace。运行实现只在 `packages/`，公开示例放在
`examples/`；框架不能反向依赖业务应用。

## 本地开发

```bash
pnpm install
pnpm dev                 # 启动文档站与示例
pnpm check               # 框架 / 业务边界守卫
pnpm release:check       # 发布元数据与 CI 契约
pnpm typecheck
pnpm test
```

需要验证真实 tarball 时：

```bash
pnpm build
pnpm pack:check
```

`pack:check` 会把公开包打成 tarball，在临时项目里安装、类型检查、构建并跑导入冒烟。

## 改动约定

- 修框架能力时改 `packages/`，不要在示例里复制执行逻辑。
- 新能力同步 `website/` 与 `content/tutorial/`；文档站是公开文档的唯一真相。
- 修改公开包 `package.json`、依赖或发布配置后，必须跑 `pnpm release:check` 与 `pnpm pack:check`。
- 不提交 `.env.local`、`.llm`、模型密钥或真实用户数据。

## Pull request

PR 请说明：解决了什么、用户如何验证、跑了哪些检查。涉及安全边界、协议或确认闸门时，
同时说明失败路径为什么是 fail-closed。
