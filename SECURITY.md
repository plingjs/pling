# Security Policy

## Supported versions

当前处于 `0.1.0-alpha` 阶段，只为最新发布的 alpha 版本提供安全修复。

## Reporting a vulnerability

请通过仓库的 **Security → Report a vulnerability**（GitHub Security Advisories）私下报告，
不要在公开 issue 中披露可利用细节、真实凭证或用户数据。报告建议包含：

- 受影响包与版本；
- 最小复现；
- 预期边界与实际行为；
- 是否涉及动作执行、确认闸门、Surface / delegation、跨设备租约或模型网关。

维护者会先确认影响范围，再与报告者协调修复和披露时间。

## Security boundaries

- 未声明的页面控件不进入 agent 能力清单；框架不提供通用 DOM 点击或脚本执行逃逸口。
- 危险动作必须经过确认闸门；确认不能由模型自行伪造。
- 外部 Agent 的能力取页面暴露范围与会话 scope 的交集，缺失、过期或撤销时 fail-closed。
- 模型密钥只能放在薄 Node 层或服务端代理，不进入浏览器构建产物。
