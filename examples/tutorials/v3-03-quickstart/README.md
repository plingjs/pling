# V3-03 · Complete Todo agent fixture

这是《Vue 快速上手：一个可用的 Todo Agent》的可运行源文件。业务仍是一份完整的 Todo 页面；接入层用区域、记录和三个声明动作，让助手能够新增待办和标记完成。

本章不是完整 API 清单。它只建立一条能工作的路径：页面原有业务函数不变，Agent 选择和操作开发者明确开放的任务输入、提交按钮与完成复选框。

从仓库根目录执行：

```bash
pnpm tutorial:dev v3-03
```

脚本会先构建并打包所需包，再把本目录复制到 `.tmp/tutorials/v3-03/app`，用本地 tarball 安装依赖并启动 Vite。这样测试的是发布包路径，而不是 workspace 源码路径。

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
pnpm tutorial:check v3-03
```

它包含类型检查、Vite 构建，以及手动操作、区域与记录投影、两步新增、折叠行内动作和中文文案的确定性测试。
