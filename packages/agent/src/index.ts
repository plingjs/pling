/**
 * @plingjs/agent —— pi 的 agent 层（浏览器与 Node 同构）。
 *
 * 分工：
 *   `@plingjs/core`   契约与执行（注册表 / 原语 / 权限 / 单动作流水线）
 *   `@plingjs/agent`  编排（会话循环 / 上下文组装 / 模型协议 / 确认闸门 / 钩子 / 观测 / 评测）
 *   `@plingjs/vue`    界面（指令 + 面板 + 问答入口）
 *
 * 关键约束（从 lesson13 的实战教训固化下来）：
 *   1. 一次响应里的多个 tool_call 必须逐条回填 role="tool"，少一条服务端就 400；
 *   2. 历史压缩的切点不能落在 role="tool" 上（同一个配对问题换个地方发作）；
 *   3. 确认请求不能走「处理用户消息的同一条串行队列」，否则循环等确认时死锁。
 */
export * from "./types";
export * from "./transcript";
export * from "./activity";
export * from "./tokens";
export * from "./trace";
export * from "./hooks";
export * from "./telemetry";
export * from "./retry";
export * from "./chain";
export * from "./approval";
export * from "./approval-queue";
export * from "./handoff";
export * from "./protocol";
export * from "./prompt";
export * from "./config";
export * from "./runtime";
export * from "./history";
export * from "./continuity";
export * from "./residency";
export * from "./loop";
export * from "./session";
export * from "./replay";
export * from "./evaluate";
export * from "./llm/openai";
