---
id: R-14
title: "页面反馈、目标高亮与人工指引"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 页面反馈、目标高亮与人工指引

用户让助手保存工作区名称。由于输入为空，保存失败，页面在旁边显示了一条错误说明。对用户来说，原因已经清楚；对模型来说，动作只是失败了，失败原因仍藏在渲染结果里。它可能原样重试，也可能把并未完成的操作说成完成。

人工接力也有类似问题。助手说“请输入验证码”，却没有指出哪个输入框、哪个按钮需要处理。高亮只有在说明本身清楚时才有帮助。

React 应用需要三个彼此相关、但不能互相替代的机制：

- `usePlingFeedback` 把页面上已经出现的错误或状态变成只读上下文；
- `usePlingGuideTarget` 为人标记一个可被指引的元素，但不会把它变成动作；
- presence 显示助手正在操作哪个真实元素，或正在等待人处理哪一步。

## 页面看得见的错误，模型未必读得到

示例中的发布面板包含工作区名称、验证码和发布按钮。名称为空时，保存会失败，并显示一条可读提示。模型需要的并不只是“调用失败”：

| 信息 | 作用 |
| --- | --- |
| 提示内容 | 不知道原因的重试只会浪费一轮 |
| 对应字段 | 模型可以修正正确的输入，而不是猜 |
| 严重级别 | error、warning 与普通状态需要不同处理 |

Pling 从两个来源读取反馈。第一种是开发者用 `usePlingFeedback` 显式声明；第二种是页面已有的无障碍语义：`role="alert"`、`role="status"`、`aria-live` 和 `aria-invalid="true"`。

自动收集的范围有意收得很窄。它不会因为样式类名叫 `error`，或边框是红色，就推断出业务错误。读屏软件读不到的状态，模型也读不到。

## 在页面显示反馈的位置声明反馈

发布面板只保留一份反馈状态，并把它交给 hook：

```tsx{10-19}
const [feedbackText, setFeedbackText] = useState("");
const [feedbackField, setFeedbackField] = useState<string | undefined>();

usePlingFeedback(
  feedbackText
    ? {
        id: "release_feedback",
        message: feedbackText,
        ...(feedbackField ? { field: feedbackField } : {}),
        severity: "error",
        scope: "release_check",
      }
    : null,
);
```

传入 `null` 表示页面当前没有反馈。文案变化不需要重新登记，下一次快照会读取最新值。

对象形式携带模型真正需要的定位信息：

| 字段 | 含义 |
| --- | --- |
| `id` | 同一条反馈的稳定身份 |
| `message` | 用户已经看到的文案，也可以是读取文案的函数 |
| `field` | 出错的输入字段；字段会变化时也可以传函数 |
| `severity` | `error`、`warning`、`info` 或 `success` |
| `scope` | 反馈所属的已声明区域 |

这里的 `scope` 必须与真实区域 id 一致，也就是 `release_check`。只有反馈确实不属于某个区域时才应省略。hook 不会根据 React 组件边界猜测作用域。

模型收到的是一段有界数据，而不是整页 DOM：

```text
## Current page feedback (1 total, showing 1)
- [error] Enter a workspace name. It cannot contain only spaces.
  id: release_feedback · field: workspace_name · scope: release_check
```

反馈是数据，不会进入工具清单，模型不能执行它。系统提示词可以要求模型在失败后先阅读这段内容再决定是否重试，但权限边界没有改变。

同一条消息如果在多个位置显示，应由真正拥有这份状态的元素声明一次。重复反馈会增加上下文，也会让页面显得比实际更混乱。

## 已有 ARIA 语义可以直接复用

许多 React 表单组件已经提供了可访问的校验状态。满足明确语义时，不需要再声明一遍：

```tsx
<input
  aria-invalid={invalid ? "true" : undefined}
  aria-errormessage={invalid ? "name-error" : undefined}
/>
<p id="name-error" role="alert">请填写工作区名称。</p>
```

无效输入会贡献字段与错误状态，alert 会贡献用户可见的提示。输入框需要通过 `<label>`、`aria-label`、`aria-labelledby` 或 `data-pling-field` 提供稳定名称；否则模型只收到一条错误，不知道应当修改哪里。

当业务含义比可见文字更丰富时，使用显式声明：多个字段共同导致一次失败、账户被临时锁定，或同一条状态需要在多次更新之间保持稳定 id。

不要把同一条消息同时声明为反馈、又挂在 live region 上。示例在有显式错误时关闭 `aria-live`，只在成功状态没有显式反馈时让它自动收集。一个状态元素只应有一个真相来源。

## 指引目标不是动作

验证码只能由人填写。用 `usePlingTool` 注册它，会诱导模型填入它本不该知道的值；完全不标记，又会让接力过程难以跟随。

`usePlingGuideTarget` 提供了中间层：

```tsx{8}
const codeTargetRef = usePlingGuideTarget<HTMLInputElement>("verification_code");

<input
  ref={codeTargetRef}
  value={code}
  onChange={(event) => setCode(event.target.value)}
  data-pling-field="verification_code"
  autoComplete="off"
/>
```

这个输入框有了稳定的视觉指引目标，但不会进入动作清单。模型可以从接力说明中知道必须由人填写，却不能自己填入或点击。

两个方向要分清：

- 智能体可以操作的元素，应声明成动作；
- 只由人查看或操作的控件，可以是指引目标。

`usePlingGuideTarget` 只改变展示，不产生权限、业务操作或工具 schema。

## 把人工步骤写进动作声明

发布动作不模拟用户的操作，而是声明人工接力。每一步指向当时应该关注的元素：

```tsx{6-9}
const publishToolRef = usePlingTool<HTMLButtonElement>({
  id: "publish_changes",
  desc: copy.publishDesc,
  kind: "danger",
  handoff: {
    reason: copy.publishReason,
    steps: [
      { text: copy.publishStepOne, highlight: "verification_code" },
      { text: copy.publishStepTwo, highlight: "publish_changes" },
    ],
    expect: {
      desc: copy.publishExpect,
      check: () => publishedRef.current,
    },
  },
});
```

`highlight` 可以指向指引目标，也可以指向已注册动作。第一步指向仅供人填写的验证码，第二步指向发布按钮本身。用户推进步骤时，执行器会把视觉焦点移到对应元素。

`expect` 必须读取可靠的业务结果。示例在发布成功时更新一个 ref，再用它确认结果。只检查用户是否点过“我已完成”，不能证明页面真的到达了承诺状态。

## 让控制权的转移可见

应用创建时启用一次 presence：

```ts
const pling = createPling({
  presence: { effect: "spotlight" },
});
```

可选的画法：

| 效果 | 外观 | 适用场景 |
| --- | --- | --- |
| `ring` | 轻量光圈 | 普通动作 |
| `spotlight` | 压暗其余部分 | 需要集中注意的人工步骤 |
| `none` | 不显示覆盖层 | 测试或完全自定义的展示 |

光圈跟随执行器实际作用的元素，而不是附近的包装层。人工接力期间，它跟随当前步骤。覆盖层使用 `pointer-events: none` 并带有 Pling 的界面标记，因此不会拦截点击，也不会进入页面快照。系统启用减少动态效果时，动画会关闭，静态轮廓仍保留。

操作指示不能代替无障碍标签或文字说明。它回答“控件现在在哪里”；接力面板与步骤文字回答“我需要做什么”。

## 三个机制，三个问题

| 机制 | 回答的问题 |
| --- | --- |
| 页面反馈 | 页面已经告诉了用户什么？ |
| 操作指示（presence） | 助手正在操作或等待哪个元素？ |
| 人工接力 | 哪一步必须由人完成？ |

不要把反馈当成审批。“这个操作有风险”的提示，不能替代 `confirm` 或 `handoff`。也不要把指引目标当成权限；把元素标出来供人查看，不等于允许模型操作它。

## 验证

启动示例：

```bash
pnpm tutorial:dev r-14 --locale zh
```

示例源码位于 `examples/tutorials/r-14-page-feedback-target-highlighting-and-guidance`。它使用工作区中的 Pling 包，没有复制框架实现。

打开 `http://127.0.0.1:5254/?lang=zh`，依次检查：

1. 清空工作区名称，点击“保存名称”。反馈出现，状态变为“需要修正”。
2. 打开“运行”。页面快照中应包含文案、字段、级别和 `release_check` 区域；动作清单中不应出现 `release_feedback`。
3. 查看工具清单。`verification_code` 不在其中，`publish_changes` 在。
4. 让助手发布变更。接力面板应列出验证码输入框和发布按钮，聚光随当前步骤移动。
5. 输入 `246810`，完成发布并确认接力。状态变为“已发布”。

确定性检查覆盖显式反馈、清除、错误验证码、双语文案、指引目标和接力步骤：

```bash
pnpm tutorial:check r-14
```

## 常见错误

**把唯一的错误藏在样式里。** 红框不是消息。应在拥有该状态的组件边界补上显式反馈或真实的 ARIA 语义。

**把同一条状态声明两次。** 显式反馈和 live region 单独使用都可能正确，放在一起却会产生重复上下文。每条消息只保留一个真相来源。

**给智能体可操作的控件使用指引目标。** 如果助手应当能操作它，就声明动作；指引目标留给必须由人查看或操作的控件。

**只检查用户是否点了“我已完成”。** 人工接力成功的依据是页面到达预期业务状态，而不是确认按钮被点击。
