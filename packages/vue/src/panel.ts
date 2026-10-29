/** 面板执行完一个动作后抛出的事件（业务侧据此记审计日志 / 埋点） */
export interface ExecutedEvent {
  id: string;
  ok: boolean;
  /** 成功时是 ok / warning 文案；失败时是错误码 */
  detail: string;
  result: unknown;
}
