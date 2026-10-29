# V3-02 · Installation and model configuration

这是《安装与模型配置》的可运行源文件。页面只验证 Vue 应用、Pling 插件、助手入口与模型连接；动作列表必须为空。

从仓库根目录执行：

```bash
pnpm tutorial:dev v3-02
# 中文界面
pnpm tutorial:dev v3-02 --locale zh
```

同一份应用同时提供中英文。开发服务运行时也可以直接用 `?lang=zh` / `?lang=en` 切换，不需要复制第二份 demo。

脚本会先构建并打包所需包，再把本目录复制到 `.tmp/tutorials/v3-02/app`，用本地 tarball 安装依赖并启动 Vite。这样测试的是发布包路径，而不是 workspace 源码路径。

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
pnpm tutorial:check v3-02
# 只运行中文文案检查
pnpm tutorial:check v3-02 --locale zh
```

默认检查中英文两套文案；它包含类型检查、Vite 构建，以及首次渲染、模型就绪和空动作列表的确定性测试。
