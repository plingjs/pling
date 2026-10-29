import type { AgentSetup } from "@plingjs/vanilla";

/**
 * 两个页面共用同一份 agent 接线。
 *
 * 两个页面共用一条 continuity 配置：整页跳转后自动续跑，任务收口后自动回到开始页。
 * 新标签页天然是空的。
 */
export const agentSetup: AgentSetup = {
  continuity: {
    resume: "auto",
    returnOnDone: true,
  },
  config: { limits: { maxTurns: 100 } },
};
