# Changelog

Pling 使用[语义化版本](https://semver.org/lang/zh-CN/)。`0.x` 阶段 API 仍可能调整，
每次影响接入方式的变更都会记录在这里，并同步到 `website/releases/index.md` 的版本策略。

## [0.1.0-alpha.2] — 2026-10-29

首个可发布 alpha 的工作版本，当前包含：

- 发布前守卫：统一版本、许可证、仓库元数据、内部依赖与 CI 包名检查。
- 许可证切换为 Apache-2.0，并随发布包携带 NOTICE。
- Tarball 冒烟：验证只发布 `dist/`、不泄漏 `src/`、不夹带 `workspace:*`，并检查 README / LICENSE。
- 修复实际发布路径：所有包通过 `publishConfig.directory = "dist"` 从产物目录发布，避免 npm tarball 误带 `src/`；`0.1.0-alpha.1` 已废弃。
- `@plingjs/core`：动作注册表、UI 原语、权限、执行流水线与变更证据。
- `@plingjs/dom`：框架无关的目标解析、可用性判定、滚动与浏览器 UI 原语。
- `@plingjs/agent`：同构会话循环、上下文组装、确认闸门、钩子、观测、评测与连续性。
- `@plingjs/vue` / `@plingjs/react` / `@plingjs/vanilla`：三种适配器共享同一套执行契约。
- `@plingjs/surface` / `@plingjs/delegation`：外部 Agent 的能力发现、调用边界与委托凭证。
- `@plingjs/continuity-http`：跨标签页 / 跨设备连续性 HTTP 集成包。
- `@plingjs/server`：OpenAI 兼容的薄 Node 网关、服务端密钥、鉴权与审计。

### Known limits

- 包仍处于 alpha，公开 API 尚未承诺稳定兼容。
- 内存后端只用于测试与本地演示；生产存储、广播和身份提供方由接入方实现。
