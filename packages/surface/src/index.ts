/**
 * @plingjs/surface —— Pling Agent Surface 协议内核。
 *
 * 这里只定义“页面能力如何被外部 Agent 发现与调用”，不含传输、鉴权或 UI：
 *   · postMessage bridge、MCP facade、浏览器扩展都应复用这一层；
 *   · 权限 / 确认 / 人工接力 / 期望仍由现有 executor 负责。
 */
export * from "./types";
export * from "./surface";
