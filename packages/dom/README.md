# @plingjs/dom

Pling 的框架无关 DOM 执行层。Vue、React 与原生 JS（`@plingjs/vanilla`）适配器共用同一套语义，避免每个适配器各写一份近似逻辑。

| 能力 | 入口 |
| --- | --- |
| UI 原语执行（click / type / select / press / hover / scroll / navigate） | `performPrimitive()` |
| 元素可用性判定（disabled / inert / aria-hidden / hidden / 样式） | `checkActionable()` |
| 动作目标解析（原生元素 / 显式 target / 唯一内层候选 / 参数校验告警） | `resolveTarget()` / `targetWarning()` |
| 滚动登记与落定信号 | `scrollWatcher()` / `markScrolling()` / `scrollElementIntoView()` |
| 作用域可见性（活跃区域 / 容器视口裁剪 / 命中测试遮挡 / 探索动作） | `createScopeController()` / `SCOPE_ATTR` / `nearestScope()` |
| 动作存在感（光圈 / 聚光 / waiting / 自定义 render） | `createPresence()` / `PLING_UI_Z_INDEX` |
| 自动派生（原生候选 / 文案铸 id / 行身份 / 危险词表 / 显式让路 / 动态合批） | `createDeriveController()` / `DeriveOptions` / `DeriveController` |
| 混合框架页面的共享运行时（整页一份 registry + scopes） | `createPlingPage()` / `PlingPage` / `PlingPageOptions` |
| 适配器级身份命名空间（动作 / 记录 / 区域 / 状态 key / 反馈 id / 指引目标自动加前缀、行引用 / 复合步骤 / handoff 高亮固化、续跑动作保留） | `createActionNamespace()` / `getRegistryNamespace()` |
| 组合树查询（open Shadow DOM 的祖先 / 包含 / 查询顺序 / 命中测试） | `closestComposed()` / `containsComposed()` / `queryAllComposed()` / `elementFromPointComposed()` |
| 同源 iframe 页面投影（显式共享运行时 / 矩形与点坐标换算 / 跨层滚动） | `sharePlingPageWithFrame()` / `waitForPlingPageFromParent()` / `frameViewportBox()` / `projectRectToDocument()` / `pointInFrame()` / `frameChainOf()` |

React 的受控输入需要绕过框架安装在元素实例上的 `value` setter；`performPrimitive("type")` 已经使用原生 setter，因此 React `onChange` 与 Vue `v-model` 都能收到值。

这个包不依赖 Vue / React，也不提供动作注册或 UI。

## 页面投影

- **open Shadow DOM**：元素仍在当前 document，组合树函数跨过 shadow root；closed shadow root 不穿透。
- **同源 iframe**：必须由父页面显式 `sharePlingPageWithFrame()`；跨域不读取、不合并。
- 可见性、容器裁剪、遮挡命中、存在感与 `scrollElementIntoView()` 使用投影后的坐标。
- 支持平移 / CSS transform 缩放；不覆盖旋转 / 3D transform。

完整用法见 `website/concepts/projection-shadow-dom-and-iframes.md` 与 `website/reference/continuity-and-projection.md`。
