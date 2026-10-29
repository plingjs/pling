/** 读取 Vite 注入的环境变量；非 Vite 环境返回空对象。 */
export function readViteEnv(): Record<string, unknown> {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  return env ?? {};
}
