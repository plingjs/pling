# V3-05 · Actions with input and verified results fixture

这是《带输入的动作与结果验证》的可运行源文件。业务、区域、记录与行内勾选继续沿用 V3-04；本章把“填输入框 + 点提交”合并成一个带参数、可用性、成功判据和可见变化证据的业务动作。

从仓库根目录执行：

```bash
pnpm tutorial:dev v3-05
```

脚本会先构建并打包所需包，再把本目录复制到 `.tmp/tutorials/v3-05/app`，用本地 tarball 安装依赖并启动 Vite。这样测试的是发布包路径，而不是 workspace 源码路径。

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
pnpm tutorial:check v3-05
```

它包含类型检查、Vite 构建，以及参数校验、可用性、成功判据、变化证据和确定性脚本模型的测试。
