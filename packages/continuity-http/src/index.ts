/**
 * @plingjs/continuity-http —— 跨设备任务连续性的可选 HTTP 集成包。
 *
 * 它只实现 `ContinuityAuthority` 与 Web 标准 `Request → Response` 的边界：
 * 身份、存储、事务、SSO、审计与撤销由宿主后端注入。默认不提供生产存储，
 * 内存实现只在 `@plingjs/continuity-http/testing` 导出。
 */
export * from "./types";
export * from "./errors";
export * from "./client";
export * from "./server";
