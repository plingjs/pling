# Tutorial fixtures

这里放教程章节的可运行源文件。它们不是 workspace 包，也不从 workspace 源码直接启动；统一通过本地 tarball 在隔离目录中消费发布产物。

## 使用

```bash
pnpm tutorial:dev v3-03
pnpm tutorial:check v3-03
pnpm tutorial:build --only=v3-03
```

`tutorial:dev`：

1. 构建并 `pnpm pack` 该章节声明的包；
2. 把章节目录复制到 `.tmp/tutorials/<id>/app`；
3. 用 `file:` tarball 安装依赖；
4. 启动固定端口的 Vite，供人工验证。

`tutorial:check` 走同一条安装路径，并执行类型检查、确定性端到端测试和生产构建。

`tutorial:build` 把同一份夹具构建成网站上的静态预览：

```text
/demos/tutorials/vue3/v3-03/?lang=zh
/demos/tutorials/react/r-03/?lang=zh
/demos/tutorials/vanilla/j-03/?lang=zh
/demos/tutorials/vue2/v2-03/?lang=zh
```

省略 `--only` 时会构建注册表中的全部章节。构建会排除夹具里的 `.env.local`，只注入同源网关地址与服务端选定的模型名；供应商密钥不会进入浏览器产物。章节文档页顶部会自动出现“浏览器预览 + 本地运行”入口，两者指向同一份源码。部署时仍需由站点服务端提供同源模型网关。

## 新增章节

在 `registry.json` 增加一项，至少包含：

- `dir`：`examples/tutorials/` 下的目录名；
- `title`：章节标题；
- `port`：人工验证端口；
- `packages`：章节需要打包的 `@plingjs/*` 包；
- `docs`：对应的中英文源稿；
- `docMarkers`：正文中必须仍然存在的关键代码标记，用于发现明显漂移。

章节目录里的 `package.json` 保留正常的包名依赖；脚本只在复制后的临时项目里把 `@plingjs/*` 改成 tarball，不改变文档中读者看到的 import。
