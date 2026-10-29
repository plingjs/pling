---
id: EV-01
title: "基准方法与可复现性"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 基准方法与可复现性

只有读者能判断比较了什么、在什么条件下比较、结果不能证明什么时，基准才有用。Pling 当前证据刻意很窄：两个冻结页面夹具、一个模型别名、一条确定性 DOM 基线，以及一组预注册任务。

## 比较了什么

主比较发生在同一应用与任务 oracle 上的 Surface/MCP 路径和 DOM + Playwright 路径之间。两条路径必须产生相同业务状态、执行相同确认次数，并避免相同禁止副作用。

| 条件 | Surface / MCP | DOM / Playwright |
| --- | --- | --- |
| 页面 | 冻结的订单后台夹具 | 同一夹具 |
| 任务 | 预注册 manifest | 同一 manifest |
| 模型 | `deepseek-chat` | 同一模型 |
| 温度 / 输出上限 | `0` / `1024` | 相同 |
| 轮数预算 | `24` | 相同 |
| 工具结果上限 | `24,000` 字符 | 相同 |
| 确认 | 确定性 oracle | 同一 oracle |

Surface 臂只能调用已声明能力。DOM 臂可以读取可访问角色、标签、文本与 placeholder，并操作真实控件；它不能读取 Pling 声明或 registry。这条隔离很关键：若 DOM 臂也拿到同一套声明，测到的将是提示词形状，而不是协议。

## 预注册

确认性运行在执行前固定任务、阈值、模型、提示词、夹具、轮数预算与分析方法。没有用更好的重跑替换失败样本；warm-up 不计入正式集合。聚合时检查两臂的夹具、任务 manifest、模型条件、系统提示与重复次数一致。

当前主结果为：

| 指标 | Surface / MCP | DOM / Playwright |
| --- | ---: | ---: |
| 核心 pass@1 | 60 / 60 | 60 / 60 |
| 成功运行中位步数 | 3 | 7 |
| 成功运行中位 token | 11,462.5 | 22,543 |
| `falseSuccess` | 0 | 0 |

步数比为 `0.4286`，token 比为 `0.5085`。它们只描述这组冻结条件。60/60 的 95% Wilson 区间为 93.98%–100%，不代表未来每次运行都成功。

## 复现一次结果

从仓库的基准文档与夹具结果目录开始。每个运行目录包含 manifest、`runs.jsonl`、`summary.json`，必要时还有报告。比较前检查夹具 hash、任务 manifest hash、系统提示 hash、git SHA、dirty 标记、模型别名与重复次数。

先跑确定性测试，它们不需要模型密钥，并能发现夹具与任务 oracle 不再匹配。然后再做小任务集的真实模型 smoke。全量运行应是一次独立、留档的实验，而不是反复调提示词直到数字好看。

## 证据不能证明什么

- 不能证明跨所有网页的统计显著性。
- 不能证明换模型后仍有相同 token 或步数比。
- 不能证明没有后端授权、审计与确认的 Surface 也安全。
- 不覆盖纯视觉控件、跨站发现、生产网络故障或所有框架适配器。
- 不把确定性确认 oracle 当作真人可用性研究。

## 阅读新结果

信任基准前先问：

1. 两臂是否使用同一页面与任务定义？
2. DOM 臂是否看到了 Pling 元数据，或 Surface 臂是否走了私有捷径？
3. 两臂是否使用相同确认路径？
4. 失败、基础设施错误与重试是否保留在分母里？
5. 结论是否仍局限于冻结模型与夹具？

公开原始记录与失败样本。隐藏失败的基准是营销材料，不是证据。参见 [失败样本与已知限制](/zh/evidence/failure-catalog-and-known-limitations)与 [Surface 与 DOM、Playwright、视觉方案对照](/zh/evidence/surface-vs-dom-playwright-and-vision)。
