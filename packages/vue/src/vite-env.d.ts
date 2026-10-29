/**
 * Vite 的 `?raw` 导入：把文件内容当字符串拿进来。
 *
 * 为什么这里需要它：有一条测试要**盯组件源码**（面板高度必须是写死的 `height`，
 * 不能退回 `max-height`）—— jsdom 没有排版引擎，量不出像素。
 * 平时不用这个能力，只有这种「只能看源码」的断言会用到。
 */
declare module "*?raw" {
  const content: string;
  export default content;
}
