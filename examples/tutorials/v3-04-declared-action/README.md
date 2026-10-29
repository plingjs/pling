# V3-04 · Inspect one agent run fixture

这是《查看一次 Agent 运行》的可运行源文件。业务、页面结构与 V3-03 保持一致；本章只把 `:debug` 打开，并保留最近 8 次模型调用，用于查看页面投影、工具清单、真实 messages 和请求时的页面快照。

从仓库根目录执行：

```bash
pnpm tutorial:dev v3-04
```

脚本会先构建并打包所需包，再把本目录复制到 `.tmp/tutorials/v3-04/app`，用本地 tarball 安装依赖并启动 Vite。这样测试的是发布包路径，而不是 workspace 源码路径。

需要真实模型时，在本目录创建 `.env.local`：

```dotenv
VITE_AGENT_BASE_URL=https://api.example.com/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
```

如果浏览器被 CORS 拦住，也可以使用 Vite 开发代理：

```dotenv
VITE_AGENT_BASE_URL=/llm/v1
VITE_AGENT_PROXY_TARGET=https://api.example.com
```

脚本会把 `.env.local` 一并复制到临时消费项目。自动检查运行：

```bash
pnpm tutorial:check v3-04
```

它包含类型检查、Vite 构建，以及检查器入口、页面投影、工具清单、组装消息、中文界面和确定性模型路径的测试。
