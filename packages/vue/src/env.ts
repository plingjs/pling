/**
 * 读 Vite 的 `import.meta.env`（webpack / Node 下拿不到就是空对象，配置全走显式传的那份）。
 *
 * ⚠️ 这里的表达式**必须保持字面写法**：Vite 是拿**源码文本**去匹配 `import.meta.env` 的 ——
 * 匹配到才会给模块注入 env（dev 在每个模块头部拼一行 `import.meta.env = {...}`，build 做静态替换）。
 * 曾经写成 `const meta = import.meta; meta.env`：编译后字面量没了，注入不发生，
 * `.env.local` 就**静默失效**（面板报「没有配置模型地址」）。所以别为了「看起来干净」重构这几行；
 * `test/env.test.ts` 守着这个约束。
 */
export function readViteEnv(): Record<string, unknown> {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  return env ?? {};
}
