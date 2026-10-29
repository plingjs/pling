<script setup lang="ts">
import { computed } from "vue";
import type { BridgeConnectionState } from "./mcp-bridge";
import type { DemoLocale } from "./copy";

const props = defineProps<{
  locale: DemoLocale;
  state: BridgeConnectionState | "disabled";
}>();

const copy = computed(() =>
  props.locale === "zh"
    ? {
        eyebrow: "接入真实 Agent",
        title: "让 Codex、Claude 等客户端使用这组能力",
        lead: "下面的控制台本身也是外部客户端，但它在同一页面里运行。要验证真正的第三方 Agent，请启动本地 MCP server，再在 Agent 中注册它。",
        status: "MCP 桥",
        states: {
          disabled: "未启用",
          connecting: "正在连接",
          connected: "已连接",
          disconnected: "等待 server",
        },
        step1: "在仓库根目录启动示例，再打开本地页：",
        step2: "仍在仓库根目录，用当前路径注册 MCP server：",
        step3: "在 Codex / Claude 中输入任务。先 describe，再 invoke；删除会等待页面上的真人确认。",
        task: "用 pling-todo MCP 描述当前 Todo 页面，新增“准备客户演示”，再把第一条未完成事项标记为完成。",
        cliClients: "Codex 与 Claude Code 的命令行配置",
        cliHint: "在仓库根目录执行，并把绝对路径替换成你自己的 mcp-server.mjs 路径。Hermes 等客户端没有统一的 CLI 写法，请在它自身的 MCP 设置里填入下面这组 command 与 args。",
        desktopClients: "Claude Desktop、WorkBuddy 或其他 MCP 客户端",
        generic: "如果客户端使用 JSON 配置，填入同一个 command 与 args；支持 stdio MCP 即可。",
        boundary:
          "这是本机开发参考。node 命令是客户端启动的 stdio MCP 进程，不读取页面文件；它通过 127.0.0.1 连接当前页面。线上页面应与 Surface Gateway 配对，向 Agent 提供 HTTPS MCP 端点；身份、授权、审计与审批仍不进入模型。",
      }
    : {
        eyebrow: "Connect a real agent",
        title: "Use these capabilities from Codex, Claude, and other clients",
        lead: "The console below is also an external client, but it runs in the same page. To test a real third-party agent, start the local MCP server and register it with the agent.",
        status: "MCP bridge",
        states: {
          disabled: "not enabled",
          connecting: "connecting",
          connected: "connected",
          disconnected: "waiting for server",
        },
        step1: "Start the examples from the repository root, then open the local page:",
        step2: "Still in the repository root, register the MCP server with the current path:",
        step3: "Ask Codex or Claude to use it. The agent calls describe first, then invoke; destructive actions wait for the person on the page.",
        task: "Use the pling-todo MCP to describe the current Todo page, add “Prepare the customer demo”, and mark the first open task complete.",
        cliClients: "Codex and Claude Code CLI setup",
        cliHint: "Run these from the repository root and replace the absolute path with your own mcp-server.mjs path. Hermes and similar clients do not share one CLI syntax; enter the same command and args in their own MCP settings.",
        desktopClients: "Claude Desktop, WorkBuddy, or another MCP client",
        generic: "If the client uses JSON configuration, provide the same command and args. Any stdio MCP client can use it.",
        boundary:
          "This is a local development reference. The node command is the stdio MCP process your client launches; it does not read page data from a file, and it reaches the open page over 127.0.0.1. A hosted page pairs with a Surface Gateway and exposes an HTTPS MCP endpoint; identity, authorization, audit, and approval remain outside the model.",
      },
);

const statusText = computed(() => copy.value.states[props.state]);
</script>

<template>
  <section class="guide" aria-labelledby="mcp-guide-title">
    <header class="guide__head">
      <div>
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h2 id="mcp-guide-title">{{ copy.title }}</h2>
      </div>
      <span class="status" :data-state="state">
        <i aria-hidden="true"></i>
        {{ copy.status }} · {{ statusText }}
      </span>
    </header>
    <p class="lead">{{ copy.lead }}</p>

    <ol class="steps">
      <li>
        <span>{{ copy.step1 }}</span>
        <pre><code>pnpm dev:examples
http://localhost:5191/external-agent-surface/?mcp=1&amp;lang=zh</code></pre>
      </li>
      <li>
        <span>{{ copy.step2 }}</span>
        <pre><code>codex mcp add pling-todo -- node "$(pwd)/examples/demos/external-agent-surface/mcp-server.mjs"</code></pre>
      </li>
      <li>
        <span>{{ copy.step3 }}</span>
        <p class="task">“{{ copy.task }}”</p>
      </li>
    </ol>

    <details open>
      <summary>{{ copy.cliClients }}</summary>
      <p>{{ copy.cliHint }}</p>
      <pre><code>codex mcp add pling-todo -- node "$(pwd)/examples/demos/external-agent-surface/mcp-server.mjs"
claude mcp add pling-todo -- node "$(pwd)/examples/demos/external-agent-surface/mcp-server.mjs"</code></pre>
    </details>

    <details>
      <summary>{{ copy.desktopClients }}</summary>
      <p>{{ copy.generic }}</p>
      <pre><code>{
  "mcpServers": {
    "pling-todo": {
      "command": "node",
      "args": ["/absolute/path/to/pageelf/examples/demos/external-agent-surface/mcp-server.mjs"]
    }
  }
}</code></pre>
    </details>

    <p class="boundary">{{ copy.boundary }}</p>
  </section>
</template>

<style scoped>
.guide {
  padding: 18px;
  border: 1px solid #dbe6f2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 36px rgb(15 23 42 / 6%);
}
.guide__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.eyebrow {
  margin: 0 0 3px;
  color: #2e9df7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.35;
}
.status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  font-weight: 650;
}
.status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
}
.status[data-state="connected"] {
  background: #ecfdf3;
  color: #18794e;
}
.status[data-state="connected"] i { background: #22a06b; }
.status[data-state="connecting"] i { background: #f59e0b; }
.status[data-state="disconnected"] i { background: #ef4444; }
.lead {
  margin: 10px 0 14px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}
.steps {
  display: grid;
  gap: 10px;
  margin: 0;
  padding-left: 20px;
  color: #334155;
  font-size: 12px;
  line-height: 1.6;
}
.steps span { display: block; }
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.steps > li > code,
.task {
  display: inline-block;
  margin: 5px 0 0;
  padding: 3px 6px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #0b6db7;
}
pre {
  margin: 6px 0 0;
  padding: 9px 10px;
  overflow: auto;
  border-radius: 8px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 10px;
  line-height: 1.55;
}
details {
  margin-top: 14px;
  color: #475569;
  font-size: 12px;
}
summary {
  color: #0b6db7;
  font-weight: 650;
  cursor: pointer;
}
.boundary {
  margin: 14px 0 0;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.55;
}
</style>
