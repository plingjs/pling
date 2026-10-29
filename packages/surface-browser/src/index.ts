/**
 * @plingjs/surface-browser —— Surface 的浏览器运行时。
 *
 * 协议内核仍在 `@plingjs/surface`；这里只承载页面侧会话、WebSocket、
 * 请求桥接与 human-approval 转发。它不依赖 Vue / React，也不包含业务 UI。
 */
export * from "./types";
export { SurfaceClientError } from "./errors";
export { createSurfaceGatewayClient } from "./gateway";
export { createSurfaceTransport, type SurfaceTransportOptions } from "./transport";
export { createSurfaceBridge, type SurfaceBridge, type SurfaceBridgeOptions } from "./bridge";
export {
  createPlingSurface,
  type CreatePlingSurfaceOptions,
  type PlingSurfaceRuntime,
} from "./surface";
