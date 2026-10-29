/**
 * pi core · 等待与期望（S4）
 *
 * 「点一下」和「事情真的发生」之间往往隔着一段时间：提交要走 500ms 网络，抽屉要 300ms 动画，
 * 列表要等下一批数据。而框架取快照是**同步**的 —— 动作刚点完就去看，看到的是「什么都没变」，
 * 于是把「还在处理」报成「无变化」，把成功说成没做成。
 *
 * 这一层只提供一件事：**等一个判据成立**。两个用法：
 *
 *   · 声明侧 `expect`（见 `types.ts` 的 `Expectation`）—— 接进执行流水线，
 *     不成立就报 `EXPECTATION_FAILED`，不假装成功；
 *   · `run` 里直接 `await waitFor(() => …)` —— 工具作者自己拿捏等待时机。
 *
 * 三条约定：
 *   1. **超时不抛异常，只返回 `false`** —— 怎么处理由调用方决定（框架选择如实报错）；
 *   2. 判据自己的异常**原样抛出** —— 那是开发者代码里的 bug，吞掉只会让人查不到；
 *   3. 每次判定之间**让出一轮宏任务**：Vue 的更新在微任务里 flush，让出来它才落地，
 *      紧接着的几何判定（`getBoundingClientRect`）读到的才是新布局。
 */

/** 默认等多久（ms）。2s 覆盖绝大多数「一次网络往返 + 一次渲染」的异步动作 */
export const DEFAULT_WAIT_TIMEOUT = 2000;
/** 默认轮询间隔（ms）。够密（察觉不到延迟）又够疏（不至于把主线程刷满） */
export const DEFAULT_WAIT_INTERVAL = 30;

export interface WaitForOptions {
  /** 最长等多久（ms），默认 {@link DEFAULT_WAIT_TIMEOUT}。传 0 = 只判一次，不等待 */
  timeout?: number;
  /** 两次判定之间隔多久（ms），默认 {@link DEFAULT_WAIT_INTERVAL} */
  interval?: number;
  /** 注入时钟 / 睡眠（测试用；生产不传） */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** 取消：置位后立即返回 `false`（循环被打断时不必等满超时） */
  signal?: AbortSignal;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * 反复判定直到条件成立或超时。**永不抛超时异常**：成立返回 `true`，超时返回 `false`。
 *
 * 先判一次再等 —— 条件本来就成立（同步动作）时，一次都不必睡。
 */
export async function waitFor(
  check: () => boolean | Promise<boolean>,
  options: WaitForOptions = {},
): Promise<boolean> {
  const timeout = options.timeout ?? DEFAULT_WAIT_TIMEOUT;
  const interval = options.interval ?? DEFAULT_WAIT_INTERVAL;
  const now = options.now ?? ((): number => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  const started = now();

  for (;;) {
    if (options.signal?.aborted) return false;
    if (await check()) return true;
    const elapsed = now() - started;
    if (elapsed >= timeout) return false;
    // 睡到「下一次判定」与「超时时刻」里更早的那个：超时了就不再多睡一轮
    await sleep(Math.min(interval, timeout - elapsed));
  }
}
