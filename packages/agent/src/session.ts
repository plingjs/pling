import { createAgentLoop, type AgentLoop, type LoopOptions } from "./loop";
import type { HandoffDecision, HandoffRequest } from "@plingjs/core";
import type { SessionEvent } from "./types";
import {
  buildContinuitySnapshot,
  checkpointOf,
  continuityEnvelopeOfSnapshot,
  continuitySnapshotOfEnvelope,
  pageHref,
  prepareContinuitySnapshot,
  redactContinuitySnapshot,
  resolveContinuity,
  type ContinuityController,
  type ContinuityCheckpoint,
  type ContinuitySetting,
  type ContinuitySnapshot,
  type ContinuityStatus,
} from "./continuity";
import {
  ContinuityAuthorityError,
  createContinuitySessionId,
  type ContinuityRole,
  type ContinuityTaskSummary,
  type LeaseGrant,
  type ResidencyEnvelope,
} from "./residency";

/**
 * 会话：把「循环」包成「可串行驱动、可取消、有事件流」的东西。
 *
 * 这一层是**同构缝**：面板和业务只依赖 `AgentSession`，不关心循环跑在哪。
 *   - `createLocalSession`（本文件）：循环在浏览器，模型调用走注入的 `Llm`
 *   - `createRemoteSession`（M4，薄 Node 层）：循环在服务端，浏览器只做
 *     「上报快照 + 执行动作 + 回传结果」。它对外的 `send / cancel / events` 完全一样，
 *     所以将来切换拓扑 = 换一个构造调用，业务代码零改动。
 */
export type SessionStatus = "idle" | "running" | "cancelled";

export interface LocalSessionOptions extends LoopOptions {
  id?: string;
  continuity?: ContinuitySetting;
  /** 共享任务被另一个上下文接管后调用；运行时用它清掉旧的确认 / 接力队列。 */
  onLeaseLost?: () => void;
}

export interface AgentSession {
  readonly id: string;
  /** 串行发送：同一时刻只跑一次循环，前一次没结束的会排队 */
  send(input: string): Promise<string>;
  /** 请求取消：正在飞的模型调用会被中止，循环在下一个安全点退出 */
  cancel(): void;
  /** 直接发起一次人工接力（可编程入口；页面动作声明 handoff 时由执行器自动触发） */
  handoff(request: HandoffRequest): Promise<HandoffDecision>;
  reset(): void;
  status(): SessionStatus;
  /** 已发生的事件（面板据此渲染） */
  events(): readonly SessionEvent[];
  /** 跨整页导航 / 跨标签页的检查点控制器（未配置 continuity 时 `enabled=false`）。 */
  readonly continuity: ContinuityController;
  /** 循环本体（评测 / 调试需要挂钩子时用） */
  readonly loop: AgentLoop;
}

let seq = 0;

export function createLocalSession(options: LocalSessionOptions): AgentSession {
  const { id, continuity: continuitySetting, onLeaseLost, ...loopOptions } = options;
  const continuity = resolveContinuity(continuitySetting);
  const tabContinuity = continuity?.scope === "tab" ? continuity : null;
  const shared = continuity && continuity.scope !== "tab" ? continuity : null;
  const authority = shared?.authority ?? null;
  const restored: ContinuitySnapshot | null = tabContinuity
    ? prepareContinuitySnapshot(tabContinuity.store?.load() ?? null, tabContinuity.options)
    : null;

  let sessionId = id ?? `session_${++seq}`;
  let restoredState = Boolean(restored);
  let checkpointState: ContinuityCheckpoint | null = restored ? checkpointOf(restored) : null;

  const events: SessionEvent[] = restored ? [...restored.events] : [];
  let goal: string | undefined = restored?.goal;
  let startPage = restored?.startPage ?? restored?.page;
  let taskStatus: ContinuityStatus = restored?.status ?? "active";
  // 恢复中的 active 任务不是在这个 document 里发起的，完成时才允许「返回开始页」。
  // 恢复后在当前页另起的新任务不该把页面重新加载一遍。
  let taskStartedHere = !restored || restored.status === "done";
  if (!goal) {
    const firstUser = restored?.events.find((event) => event.type === "user");
    if (firstUser?.type === "user") goal = firstUser.text;
  }

  let loopRef: AgentLoop | undefined;
  let suppressSave = false;
  let autoResumeClaimed = false;
  let returnClaimed = false;
  let cancelled = false;
  let status: SessionStatus = "idle";

  const ownerId = `owner_${Math.random().toString(36).slice(2, 12)}`;
  let sharedTaskId: string | null = null;
  let sharedRole: ContinuityRole = "unowned";
  let sharedLease: LeaseGrant | null = null;
  let sharedRevision = 0;
  let sharedLost = false;
  let sharedCompleted = false;
  let sharedSaveTail: Promise<void> = Promise.resolve();
  let sharedHeartbeat: ReturnType<typeof setInterval> | null = null;
  let sharedUnsubscribe: (() => void) | null = null;
  const subscribers = new Set<() => void>();

  const notify = (): void => {
    for (const subscriber of subscribers) subscriber();
  };

  const stopHeartbeat = (): void => {
    if (sharedHeartbeat === null) return;
    clearInterval(sharedHeartbeat);
    sharedHeartbeat = null;
  };

  const renewShared = async (): Promise<void> => {
    const lease = sharedLease;
    if (!shared || !authority || !sharedTaskId || sharedRole !== "owner" || !lease) return;
    try {
      const grant = await authority.renew({
        sessionId: sharedTaskId,
        ownerId,
        leaseId: lease.leaseId,
        ttlMs: shared.options.leaseTtlMs,
      });
      sharedLease = grant;
      sharedRevision = Math.max(sharedRevision, grant.revision);
      notify();
    } catch {
      loseLease("无法确认任务租约仍在有效期，本页已停止执行。");
    }
  };

  const startHeartbeat = (): void => {
    if (!shared || !authority || sharedHeartbeat !== null) return;
    const interval = Math.max(1_000, Math.floor(shared.options.leaseTtlMs / 3));
    sharedHeartbeat = setInterval(() => void renewShared(), interval);
    (sharedHeartbeat as unknown as { unref?: () => void }).unref?.();
  };

  const loseLease = (message = "当前页面已失去任务执行权（可能已被其他标签页接管），本页已停止执行。"): void => {
    if (sharedRole !== "owner" || sharedLost) return;
    sharedLost = true;
    sharedRole = "follower";
    sharedLease = null;
    stopHeartbeat();
    cancelled = true;
    loopRef?.abort();
    if (status === "running") status = "cancelled";
    const notice: SessionEvent = {
      type: "notice",
      text: message,
    };
    events.push(notice);
    options.onEvent?.(notice);
    onLeaseLost?.();
    notify();
  };

  const snapshotNow = (): ContinuitySnapshot | null => {
    const current = loopRef;
    if (!continuity || !current) return null;
    const snapshot = buildContinuitySnapshot(
      {
        status: () => taskStatus,
        goal: () => goal,
        page: () => options.registry?.snapshot().page,
        startPage: () => startPage,
        summary: () => current.history.summary,
        messages: () => current.history.recent,
        events: () => events,
      },
      continuity.options,
    );
    return redactContinuitySnapshot(snapshot, options.registry);
  };

  const writeSharedCheckpoint = async (): Promise<void> => {
    const lease = sharedLease;
    if (!authority || !sharedTaskId || sharedRole !== "owner" || !lease) return;
    const snapshot = snapshotNow();
    if (!snapshot) return;
    const next = continuityEnvelopeOfSnapshot(snapshot, {
      sessionId: sharedTaskId,
      revision: sharedRevision + 1,
      ownerId,
      leaseId: lease.leaseId,
      leaseExpiresAt: lease.leaseExpiresAt,
      status: snapshot.status === "done" ? "done" : taskStatus,
    });
    try {
      const saved = await authority.compareAndSwap({
        sessionId: sharedTaskId,
        expectedRevision: sharedRevision,
        ownerId,
        leaseId: lease.leaseId,
        next,
      });
      sharedRevision = saved.revision;
      sharedLease = {
        ...lease,
        revision: saved.revision,
        leaseExpiresAt: saved.leaseExpiresAt ?? lease.leaseExpiresAt,
      };
      checkpointState = checkpointOf(continuitySnapshotOfEnvelope(saved));
    } catch {
      // 网络分区、存储配额、后端 5xx 与版本冲突都不能当作「仍然拥有租约」继续跑。
      // 客户端无法证明自己还是 owner 时一律 fail-closed。
      loseLease("无法确认任务检查点写入，本页已停止执行。");
    }
  };

  const save = (): void => {
    if (!continuity || suppressSave) return;
    if (tabContinuity) {
      const snapshot = snapshotNow();
      if (snapshot) tabContinuity.store?.save(snapshot);
      return;
    }
    if (!shared || sharedRole !== "owner" || !sharedLease) return;
    sharedSaveTail = sharedSaveTail.then(writeSharedCheckpoint).catch(() => undefined);
  };

  const finishShared = async (): Promise<void> => {
    const lease = sharedLease;
    if (!authority || !sharedTaskId || sharedRole !== "owner" || !lease) return;
    sharedRole = "unowned";
    sharedCompleted = taskStatus === "done";
    sharedLease = null;
    stopHeartbeat();
    try {
      await authority.release({ sessionId: sharedTaskId, ownerId, leaseId: lease.leaseId });
    } finally {
      notify();
    }
  };

  const queueSharedFinish = (): void => {
    const previous = sharedSaveTail;
    sharedSaveTail = previous.then(finishShared).catch(() => undefined);
  };

  const applyEnvelope = (envelope: ResidencyEnvelope): void => {
    const snapshot = continuitySnapshotOfEnvelope(envelope);
    suppressSave = true;
    sessionId = envelope.sessionId;
    sharedTaskId = envelope.sessionId;
    sharedRevision = envelope.revision;
    goal = snapshot.goal;
    startPage = snapshot.startPage ?? snapshot.page;
    taskStatus = snapshot.status;
    events.length = 0;
    events.push(...snapshot.events);
    loopRef?.history.restore({ summary: snapshot.summary, messages: snapshot.messages });
    suppressSave = false;
    restoredState = true;
    checkpointState = checkpointOf(snapshot);
    taskStartedHere = false;
    returnClaimed = false;
    autoResumeClaimed = false;
    cancelled = false;
    status = "idle";
  };

  const clearLocal = (): void => {
    suppressSave = true;
    loopRef?.reset();
    suppressSave = false;
    events.length = 0;
    goal = undefined;
    startPage = undefined;
    taskStatus = "active";
    taskStartedHere = true;
    returnClaimed = true;
    restoredState = false;
    checkpointState = null;
    autoResumeClaimed = true;
  };

  const clearContinuity = (): void => {
    const taskId = sharedTaskId;
    const lease = sharedLease;
    const shouldRemove = sharedRole === "owner" && Boolean(taskId && lease);
    if (tabContinuity) tabContinuity.store?.clear();
    if (shouldRemove && authority && taskId && lease) {
      void authority.remove({ sessionId: taskId, ownerId, leaseId: lease.leaseId }).catch(() => undefined);
    }
    stopHeartbeat();
    sharedTaskId = null;
    sharedRole = "unowned";
    sharedLease = null;
    sharedRevision = 0;
    sharedLost = false;
    sharedCompleted = false;
    clearLocal();
    notify();
  };

  const prepareNewSharedTask = (input: string): void => {
    if (!sharedCompleted && sharedTaskId) return;
    suppressSave = true;
    loopRef?.reset();
    suppressSave = false;
    events.length = 0;
    goal = input;
    startPage = options.registry?.snapshot().page;
    taskStatus = "active";
    sharedTaskId = createContinuitySessionId();
    sessionId = sharedTaskId;
    sharedCompleted = false;
    sharedLost = false;
    checkpointState = null;
    restoredState = false;
  };

  const forkSharedTask = async (sourceTaskId: string, nextGoal?: string): Promise<string> => {
    if (!shared || !authority) {
      throw new Error("continuity 没有开启跨标签页 scope");
    }
    // 若本页正好是某个任务的 owner，先把它已经产生但尚未落盘的最新事件写完，
    // 否则「从当前任务分叉」会复制到上一拍的历史。
    await sharedSaveTail.catch(() => undefined);
    const source = await authority.read(sourceTaskId);
    if (!source) throw new ContinuityAuthorityError("NOT_FOUND", "任务不存在或已过期");
    const prepared = prepareContinuitySnapshot(
      continuitySnapshotOfEnvelope(source),
      shared.options,
    );
    if (!prepared) {
      throw new ContinuityAuthorityError("INVALID_STATE", "原任务检查点不可恢复，无法分叉");
    }

    // fork 是另起一条任务：先停掉本页可能正在跑的循环并释放旧租约，
    // 但绝不 claim / 改写源任务。旧任务继续由它原来的 owner 负责。
    cancelCurrent();
    await sharedSaveTail.catch(() => undefined);

    const page = options.registry?.snapshot().page;
    const goal = nextGoal?.trim() || prepared.goal;
    const note = `本任务从 ${sourceTaskId} 分叉；原任务独立继续，不受本任务影响。`;
    const notice: SessionEvent = { type: "notice", text: note };
    const snapshot: ContinuitySnapshot = {
      ...prepared,
      updatedAt: shared.options.now(),
      status: "active",
      ...(goal ? { goal } : {}),
      ...(page ? { page, startPage: page } : {}),
      summary: prepared.summary ? `${prepared.summary}\n\n${note}` : note,
      messages: prepared.messages,
      events: [...prepared.events, notice].slice(-shared.options.maxEvents),
    };
    const taskId = createContinuitySessionId();
    const envelope = continuityEnvelopeOfSnapshot(snapshot, {
      sessionId: taskId,
      revision: 1,
      status: "active",
    });
    const grant = await authority.create({
      envelope,
      ownerId,
      ttlMs: shared.options.leaseTtlMs,
    });

    applyEnvelope(grant.envelope);
    sharedRole = "owner";
    sharedLease = grant;
    sharedRevision = grant.revision;
    sharedLost = false;
    sharedCompleted = false;
    taskStartedHere = true;
    startHeartbeat();
    const event = snapshot.events[snapshot.events.length - 1];
    if (event) options.onEvent?.(event);
    notify();
    return taskId;
  };

  const ensureOwnerForSend = async (input: string): Promise<void> => {
    if (!shared || !authority) return;
    if (sharedLost) {
      throw new ContinuityAuthorityError(
        "OWNER_MISMATCH",
        "本页已经失去任务执行权；请先从「任务」里跟随或重新接管，再继续",
      );
    }
    // 只读跟随者输入新的目标时，默认分叉，而不是偷偷改写原任务。
    if (sharedRole === "follower" && !sharedCompleted && sharedTaskId) {
      await forkSharedTask(sharedTaskId, input);
      return;
    }
    if (sharedRole === "owner" && sharedTaskId && sharedLease) {
      await renewShared();
      if (sharedRole !== "owner") {
        throw new ContinuityAuthorityError("LEASE_EXPIRED", "任务租约已失效，请重新接管");
      }
      return;
    }
    // 用户点过「停止」后租约已经释放；再次发送时重新认领同一个任务，
    // 但不抢占另一个标签页已经取得的租约。
    if (sharedRole === "unowned" && sharedTaskId && !sharedCompleted) {
      await sharedSaveTail.catch(() => undefined);
      const current = await authority.read(sharedTaskId);
      if (!current) throw new ContinuityAuthorityError("NOT_FOUND", "任务不存在或已过期");
      let grant: LeaseGrant;
      try {
        grant = await authority.claim({
          sessionId: sharedTaskId,
          expectedRevision: current.revision,
          ownerId,
          ttlMs: shared.options.leaseTtlMs,
          preempt: false,
        });
      } catch (error) {
        if (error instanceof ContinuityAuthorityError && error.code === "LEASE_HELD") {
          throw new ContinuityAuthorityError(
            "LEASE_HELD",
            "任务已被另一个页面 / 设备接手；请先在「任务」里接管，再继续",
          );
        }
        throw error;
      }
      sharedLease = grant;
      sharedRevision = grant.revision;
      sharedRole = "owner";
      sharedLost = false;
      startHeartbeat();
      notify();
      return;
    }

    prepareNewSharedTask(input);
    const taskId = sharedTaskId ?? createContinuitySessionId();
    sharedTaskId = taskId;
    sessionId = taskId;
    const snapshot = snapshotNow();
    if (!snapshot) throw new Error("无法创建任务检查点");
    const envelope = continuityEnvelopeOfSnapshot(snapshot, {
      sessionId: taskId,
      revision: 1,
      status: "active",
    });
    const grant = await authority.create({
      envelope,
      ownerId,
      ttlMs: shared.options.leaseTtlMs,
    });
    sharedLease = grant;
    sharedRevision = grant.revision;
    sharedRole = "owner";
    sharedLost = false;
    sharedCompleted = false;
    checkpointState = checkpointOf(continuitySnapshotOfEnvelope(grant.envelope));
    startHeartbeat();
    notify();
  };

  const adoptSharedTask = async (taskId: string, role: "follower"): Promise<void> => {
    if (!authority) throw new Error("当前没有配置跨标签页 continuity");
    const envelope = await authority.read(taskId);
    if (!envelope) throw new ContinuityAuthorityError("NOT_FOUND", "任务不存在或已过期");
    applyEnvelope(envelope);
    sharedRole = role;
    sharedLease = null;
    sharedLost = false;
    sharedCompleted = envelope.status === "done";
    stopHeartbeat();
    notify();
  };

  if (authority?.subscribe) {
    sharedUnsubscribe = authority.subscribe((change) => {
      if (change.sessionId === sharedTaskId) {
        if (
          change.type === "lease" &&
          sharedRole === "owner" &&
          change.ownerId &&
          (change.ownerId !== ownerId || change.leaseId !== sharedLease?.leaseId)
        ) {
          loseLease();
        }
        if (change.type === "cleared") {
          sharedTaskId = null;
          sharedRole = "unowned";
          sharedLease = null;
          sharedLost = false;
          sharedCompleted = false;
          stopHeartbeat();
          clearLocal();
        }
      }
      notify();
    });
  }

  const historyOnChange = options.history?.onChange;
  const loop = createAgentLoop({
    ...loopOptions,
    shouldStop: () => cancelled || sharedLost || (options.shouldStop?.() ?? false),
    history: {
      ...(options.history ?? {}),
      onChange: () => {
        historyOnChange?.();
        save();
      },
    },
    ...(restored ? { historyState: { summary: restored.summary, messages: restored.messages } } : {}),
    onEvent: (event) => {
      events.push(event);
      if (event.type === "user") taskStatus = "active";
      if (event.type === "final") {
        taskStatus = "done";
        if (shared) queueSharedFinish();
      }
      options.onEvent?.(event);
      // delta 每个 token 一次，落盘没有意义；其余事件都是可恢复的检查点。
      if (event.type !== "assistant_delta") save();
    },
  });
  loopRef = loop;

  const cancelCurrent = (): void => {
    cancelled = true;
    loop.abort();
    status = "cancelled";
    // 取消 = 主动放弃执行权。立即停止续租并释放租约，别让其他标签页
    // 一直看到「另一个标签页执行中」，也避免心跳把已取消的任务永久占住。
    if (shared && authority && sharedRole === "owner" && sharedTaskId && sharedLease) {
      const taskId = sharedTaskId;
      const lease = sharedLease;
      sharedRole = "unowned";
      sharedLease = null;
      stopHeartbeat();
      sharedSaveTail = sharedSaveTail
        .then(() => authority.release({ sessionId: taskId, ownerId, leaseId: lease.leaseId }))
        .catch(() => undefined);
      notify();
    }
  };

  let tail: Promise<unknown> = Promise.resolve();

  return {
    get id() {
      return sessionId;
    },
    loop,
    continuity: {
      enabled: Boolean(continuity),
      scope: continuity?.scope ?? "tab",
      get role() {
        return shared ? sharedRole : "owner";
      },
      get sessionId() {
        return shared ? sharedTaskId : null;
      },
      get leaseLost() {
        return sharedLost;
      },
      get completed() {
        return shared ? sharedCompleted : taskStatus === "done";
      },
      get restored() {
        return restoredState;
      },
      get checkpoint() {
        return checkpointState;
      },
      resume: continuity?.options.resume ?? "off",
      claimReturn() {
        if (continuity && continuity.scope !== "tab") return null;
        const returned = continuity?.options.returnOnDone;
        if (!continuity || !returned || !restoredState || taskStartedHere || returnClaimed) return null;
        if (taskStatus !== "done") return null;
        const href = returned.to ?? pageHref(startPage);
        if (!href) return null;
        if (!returned.to) {
          const currentHref = pageHref(options.registry?.snapshot().page);
          const startHref = pageHref(startPage);
          // 已经在任务开始页时不再 reload：既没有意义，也会打断用户刚看到的结果。
          if (currentHref && startHref && currentHref === startHref) return null;
        }
        returnClaimed = true;
        return { href, delayMs: returned.delayMs };
      },
      claimAutoResume(): boolean {
        if (continuity?.scope !== "tab") return false;
        if (!continuity || !checkpointState) return false;
        if (continuity.options.resume !== "auto") return false;
        if (autoResumeClaimed || checkpointState.status !== "active") return false;
        autoResumeClaimed = true;
        return true;
      },
      async tasks(): Promise<ContinuityTaskSummary[]> {
        return authority ? authority.list() : [];
      },
      async follow(taskId: string): Promise<void> {
        if (!shared || !authority) {
          throw new Error("continuity 没有开启跨标签页 scope");
        }
        cancelCurrent();
        await sharedSaveTail.catch(() => undefined);
        if (sharedRole === "owner" && sharedTaskId && sharedLease) {
          const lease = sharedLease;
          sharedRole = "unowned";
          sharedLease = null;
          stopHeartbeat();
          await authority.release({ sessionId: sharedTaskId, ownerId, leaseId: lease.leaseId });
        }
        await adoptSharedTask(taskId, "follower");
      },
      async takeover(taskId: string): Promise<void> {
        if (!shared || !authority) {
          throw new Error("continuity 没有开启跨标签页 scope");
        }
        if (shared.options.takeover === "off") {
          throw new ContinuityAuthorityError("INVALID_STATE", "当前配置不允许接管任务");
        }
        if (sharedRole === "owner" && sharedTaskId === taskId && sharedLease) return;
        cancelCurrent();
        await sharedSaveTail.catch(() => undefined);
        if (sharedRole === "owner" && sharedTaskId && sharedLease) {
          const lease = sharedLease;
          const previous = sharedTaskId;
          sharedRole = "unowned";
          sharedLease = null;
          stopHeartbeat();
          await authority.release({ sessionId: previous, ownerId, leaseId: lease.leaseId });
        }
        const current = await authority.read(taskId);
        if (!current) throw new ContinuityAuthorityError("NOT_FOUND", "任务不存在或已过期");
        const grant = await authority.claim({
          sessionId: taskId,
          expectedRevision: current.revision,
          ownerId,
          ttlMs: shared.options.leaseTtlMs,
          preempt: true,
        });
        applyEnvelope(grant.envelope);
        sharedRole = "owner";
        sharedLease = grant;
        sharedRevision = grant.revision;
        sharedLost = false;
        sharedCompleted = grant.envelope.status === "done";
        startHeartbeat();
        notify();
      },
      async fork(taskId: string, options: { goal?: string } = {}): Promise<string> {
        return forkSharedTask(taskId, options.goal);
      },
      subscribe(listener: () => void): () => void {
        subscribers.add(listener);
        return () => subscribers.delete(listener);
      },
      flush(): Promise<void> {
        return sharedSaveTail.catch(() => undefined);
      },
      save,
      clear: clearContinuity,
    },
    send(input: string): Promise<string> {
      const text = input.trim();
      if (shared && sharedLost) {
        return Promise.reject(
          new ContinuityAuthorityError(
            "OWNER_MISMATCH",
            "本页已经失去任务执行权；请先从「任务」里跟随或重新接管，再继续",
          ),
        );
      }
      // 第一条输入是任务目标；上一件事已经收口后，下一条输入就是新任务。
      // 恢复中的 active 任务不覆盖目标（「继续」只是接着做）。
      if (text && (!goal || taskStatus === "done")) {
        goal = text;
        startPage = options.registry?.snapshot().page;
        taskStartedHere = true;
      }
      taskStatus = "active";
      // 同步重置取消标记：必须在「入队那一刻」而不是「真正开始跑那一刻」，
      // 否则 send() 之后立刻 cancel() 会被任务启动时的重置吃掉。
      // 语义：cancel 取消的是「当前正在跑的 + 已经排队的」。
      cancelled = false;
      const task = tail.then(async () => {
        await ensureOwnerForSend(text);
        status = "running";
        try {
          return await loop.run(input);
        } finally {
          status = cancelled ? "cancelled" : "idle";
          save();
        }
      });
      tail = task.catch(() => undefined);
      return task;
    },
    cancel(): void {
      // 只记标记等于「等它自己跑完」：在飞的请求要真的打断，
      // 否则聊天里点「停止」毫无反应（002 那次实测就吃过这个亏）。
      cancelCurrent();
    },
    handoff(request: HandoffRequest): Promise<HandoffDecision> {
      return loop.handoff(request);
    },
    reset(): void {
      suppressSave = true;
      loop.reset();
      suppressSave = false;
      clearContinuity();
      cancelled = false;
      status = "idle";
    },
    status: () => status,
    events: () => events,
  };
}
