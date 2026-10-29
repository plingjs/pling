---
id: V3-14
title: "页面反馈、目标高亮与人工指引"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 页面反馈、目标高亮与人工指引

用户说“保存工作区名称”，页面因为输入为空而拒绝。对人来说，红框和错误文字已经说明了原因；对模型来说，如果页面没有用可读取的形式暴露这些信息，它会以为只是动作没有生效，于是可能重复提交、换一个动作，甚至报告一个并不存在的成功。

还有一种相似的情况：某一步必须由人完成。助手只说“请输入验证码”，却没有说明是哪个输入框、最后点哪个按钮，用户只能自己在页面里找。高亮不是装饰，它是在解释动作从 agent 转交给人的位置。

这一章加入三个相互配合的机制：

- `v-feedback` 把页面上已经出现的错误或状态变成结构化上下文。
- `v-guide-target` 标记需要给人看的地方，但不会把它变成 agent 动作。
- `presence` 在元素被执行或等待人工操作时给出视觉提示。

## 为什么“用户看得见”不等于“模型读得懂”

示例页有工作区名称和发布验证码。名称为空时保存失败。用户能看到失败，但模型还需要三项信息：

| 信息 | 作用 |
| --- | --- |
| 发生了什么 | 避免没有理由地重试 |
| 涉及哪个字段 | 模型可以修正对应输入，而不是猜 |
| 严重程度 | 校验错误与普通状态提示需要不同处理 |

Pling 从两个来源读取反馈：

1. 通过 `v-feedback` 显式声明；
2. 已有的无障碍语义，例如 `role="alert"`、`role="status"`、`aria-live`、`aria-invalid="true"`。

第二个来源是自动收集，但范围刻意很窄。它不会根据 `.error`、`.warning` 这类 CSS 类猜含义。页面必须已经通过 ARIA 或声明表达了状态。

## 在页面显示反馈的地方声明反馈

示例把错误状态保存为计算值，并挂到用户实际看到的反馈区：

```vue{6-10}
<p id="release-status" v-feedback="feedback" class="release__feedback">
  <span v-if="feedback">{{ feedback.message }}</span>
  <span v-else-if="status === 'saved'">{{ copy.saved(name.trim()) }}</span>
  <span v-else-if="status === 'published'">{{ copy.published }}</span>
</p>
```

可能产生反馈的输入框通过 `aria-describedby="release-status"` 指向这个元素。
这样，用户看到的错误、浏览器的无障碍树和模型读到的上下文就是同一份内容。
不要再给这个元素加 `aria-live`：它已经通过 `v-feedback` 显式声明，ARIA
自动收集会把同一条消息登记两遍。

对象形式可以携带模型需要的细节：

```ts
const feedback = computed(() => ({
  id: "release_feedback",
  message: "请先填写工作区名称，名称不能只包含空格。",
  field: "workspace_name",
  severity: "error",
  scope: "release_check",
}));
```

`message` 可以是字符串，也可以是函数。`field` 同样可以是函数，适合错误字段会变化的场景。`scope` 把反馈关联到已声明的区域；这里必须使用真实的区域 id `release_check`。省略时会附着到最近的区域。

下一轮模型会收到类似这样的内容：

```text
## Current page feedback (1 total, showing 1)
- [error] 请先填写工作区名称，名称不能只包含空格。
  id: release_feedback · field: workspace_name · scope: release_check
```

反馈是只读页面数据，不是动作，模型不能执行它。系统提示会要求模型在动作失败后先读反馈，再决定是否重试。

同一条消息如果在页面上重复显示三处，不要登记三次。让一个元素负责状态即可。重复反馈会放大上下文，也让页面显得比实际更混乱。

## 让已有的 ARIA 语义自动成为反馈

标准表单语义往往已经足够：

```vue
<input
  v-model="name"
  :aria-invalid="invalid ? 'true' : undefined"
  :aria-errormessage="invalid ? 'name-error' : undefined"
/>
<p v-if="invalid" id="name-error" role="alert">请填写工作区名称。</p>
```

Pling 会收集无效字段和 alert。现有组件库已经生成无障碍错误时，这种方式尤其方便。输入框要通过 `<label>`、`aria-label`、`aria-labelledby` 或 `data-pling-field` 提供稳定名称；否则模型只看到一条错误，不知道它属于哪个字段。

如果业务含义比可见文字更丰富，例如多个字段共同导致一次失败，或页面需要解释临时锁定，显式 `v-feedback` 更合适。

## 区分“可执行动作”和“该看哪里”

示例中的验证码只能由人填写。把它注册成工具，会诱导模型填入它不该知道的值；完全不标记，又会让人工接力难以跟随。

`v-guide-target` 提供了中间层：

```vue{7}
<input
  v-model="code"
  data-pling-field="verification_code"
  autocomplete="off"
  v-guide-target="'verification_code'"
/>
```

这个字段有用于高亮的 id，但不会进入动作清单。人工接力步骤可以引用它：

```ts
handoff: {
  reason: "发布前需要本人确认验证码。",
  steps: [
    { text: "在验证码输入框中填写 246810。", highlight: "verification_code" },
    { text: "点击“发布变更”完成确认。", highlight: "publish_changes" },
  ],
  expect: {
    desc: "工作区变更已经发布",
    check: () => published.value,
  },
}
```

`highlight` 可以指向 guide target，也可以指向已注册动作。目标只负责展示，不增加权限、不产生业务操作，也不会进入模型的工具 schema。

## 让 agent 的操作可见

在应用初始化时启用一次存在感：

```ts
const pling = createPling({
  presence: { effect: 'spotlight' },
});
```

可选效果：

| 效果 | 外观 | 适用场景 |
| --- | --- | --- |
| `ring` | 轻量光圈 | 普通动作 |
| `spotlight` | 压暗其余部分 | 必须由人完成的步骤 |
| `none` | 不显示 | 无头测试或完全自定义的界面 |

存在感跟随执行器真正作用的目标元素。动作运行时，光圈出现在实际控件上；人工接力等待时，对应的 guide target 或动作被强调；执行结束后，覆盖层自动清除。

覆盖层设置了 `pointer-events: none`，并带有框架 UI 标记，因此不会拦截点击，也不会进入页面快照。系统启用减少动态效果时，动画会关闭，但静态轮廓仍保留。

存在感不能替代无障碍说明。接力面板仍要写清楚步骤，输入框仍要有真实标签。高亮帮助用户找到位置，但“要做什么”必须由文字说明。

## 不要混淆反馈、高亮和确认

三个机制回答不同问题：

| 机制 | 回答的问题 |
| --- | --- |
| 反馈 | 页面已经告诉了用户什么？ |
| 存在感 | agent 正在操作或等待哪个元素？ |
| 人工接力 | 哪一步必须由人完成？ |

不要把反馈当成审批。一条“这个操作有风险”的提示，不能替代 `confirm` 或 `handoff`。也不要把高亮当成权限。`v-guide-target` 只表示可以给人看，不表示模型可以操作。

## 验证页面

启动示例：

```bash
pnpm tutorial:dev v3-14
```

依次检查：

1. 清空工作区名称，点“保存名称”。反馈信息出现。
2. 让助手在没有提供名称时保存。打开诊断，确认模型收到字段名和错误消息。
3. 查看页面动作。`verification_code` 不在动作清单中，`publish_changes` 在。
4. 让助手发布变更。接力面板指出验证码字段和发布按钮，聚光高亮跟随步骤移动。
5. 输入 `246810` 并发布。状态变为已发布，反馈清除。

运行确定性检查：

```bash
pnpm tutorial:check v3-14
```

## 常见失败

**把唯一的错误藏在 CSS 类里。** 红框对读屏软件和 Pling 都不可见，除非同时提供 ARIA 语义或 `v-feedback`。应在组件边界补上语义状态。

**把每个说明文字都注册成工具。** 反馈用于描述页面，不应创造操作。保持只读，让动作成为改变状态的唯一入口。

**给 agent 可操作的控件使用 guide target。** 模型应当能操作的元素要用 `v-tool` 声明。`v-guide-target` 只适合必须由人查看或操作的控件。

**只有高亮，没有说明。** 聚光告诉用户“看这里”，接力原因和步骤文字必须说明“做什么”以及“怎样算完成”。
