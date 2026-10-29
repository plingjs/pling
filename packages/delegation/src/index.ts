/**
 * @plingjs/delegation —— 委托凭证的可选集成包。
 *
 * 这里只保留跨项目稳定的部分：凭证 / 事件契约、内存适配器、SurfaceSession 映射、
 * 浏览器客户端与 Web 标准 HTTP/SSE handler。数据库、Redis、SSO、审计落库与业务
 * 授权属于企业后端，通过 `DelegationStore` / `DelegationEventBus` / `DelegationIdentity`
 * 三个 port 注入。
 */
export * from "./types";
export * from "./errors";
export * from "./events";
export * from "./store";
export * from "./session";
export * from "./client";
export * from "./server";
export { hashToken, hasTokenPrefix, randomId, randomToken } from "./tokens";
