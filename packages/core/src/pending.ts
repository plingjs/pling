/**
 * pi core · 「页面还在动」的登记处（S4b）
 *
 * 为什么需要它：框架的判定是**同步**的 —— 动作做完就取快照。
 * 但页面会自己动：平滑滚动要 300–500ms，弹窗有动画，列表有惯性滚动。
 * 不等它停就去量位置，量到的是**动的过程中**的那一帧：
 * 几何可见性会说「这一行不在可视区」（于是那一行的动作进不了快照），
 * 变更证据会说「没有观察到变化」（明明滚到位了）。
 *
 * 这一层只做一件事：给「页面还在动」这件事一个**共同的计数**。
 *   · 谁在动谁登记（`beginPending()` / `trackPending()`）；
 *   · 落定的一方（`@plingjs/agent` 的 `settle`、`@plingjs/vue` 的滚动原语）问：还有人在动吗（`whenIdle()`）。
 *
 * 它必须在 `@plingjs/core` 里、而且只有**一份**：`@plingjs/vue` 生产、`@plingjs/agent` 消费，
 * 中间不能有第二份 core（打包重复实例会让这个计数器互相看不见）。
 */

/** 此刻有几件「页面还在动」的事 */
let active = 0;

/**
 * 登记一件「页面还在动」的事，拿到一个**幂等**的结束函数。
 *
 * 幂等是刻意的：滚动观察器会「续期」（新事件不断把结束时间往后推），
 * 写起来就是「先结束上一段，再开始新的一段」—— 不幂等的话计数器会漏减、越走越高。
 */
export function beginPending(): () => void {
  active += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    active -= 1;
  };
}

/** 登记一个 promise：它结束之前，页面都算「还在动」（失败也算结束） */
export function trackPending<T>(work: Promise<T>): Promise<T> {
  const end = beginPending();
  return work.finally(end);
}

/** 此刻有几件事在飞（`0` = 页面已经静止） */
export function pendingCount(): number {
  return active;
}

export interface WhenIdleOptions {
  /** 最长等多久（ms），默认 600。超时返回 `false`，由调用方决定怎么办 */
  timeout?: number;
  /** 判定间隔（ms），默认 20 */
  interval?: number;
  /**
   * 要**连续**几次判定都空闲才算「停了」，默认 2。
   *
   * 为什么不是一次就够：滚动是**下一帧**才开始的 —— 动作调完 `scrollTo` 就返回，
   * 第一帧里滚动事件还没发生。只看一次会当场判成「没在动」，然后在滚动途中取快照。
   */
  confirmTicks?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * 等页面停下来。返回是否真的等到了（超时 = `false`，**不抛异常**）。
 *
 * 代价说明：没有任何东西在动时也要花 `interval × confirmTicks`（默认 40ms）——
 * 这是「确认真的停了」的钱。落在每次 `settle` 上，相对于一次模型往返可以忽略。
 */
export async function whenIdle(options: WhenIdleOptions = {}): Promise<boolean> {
  const timeout = options.timeout ?? 600;
  const interval = options.interval ?? 20;
  const confirmTicks = Math.max(1, options.confirmTicks ?? 2);
  const now = options.now ?? ((): number => Date.now());
  const sleep =
    options.sleep ??
    ((ms: number): Promise<void> =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }));

  const started = now();
  let idleTicks = 0;

  for (;;) {
    if (pendingCount() > 0) idleTicks = 0;
    else idleTicks += 1;
    if (idleTicks >= confirmTicks) return true;
    if (now() - started >= timeout) return false;
    await sleep(interval);
  }
}
