---
id: C-11
title: "失败模型与错误码"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 失败模型与错误码

可靠的 Agent 接入不能把不同失败混成一句“助手没有完成”。它可能根本没有配好模型、动作从未声明、动作存在但当前不可用、真人拒绝、业务处理函数抛错，或者动作已经执行但声明的结果始终没有出现。

## 四层失败

| 层次 | 例子 | 能说明什么 |
| --- | --- | --- |
| 配置 | `NOT_CONFIGURED`、`MODEL_BASE_URL_MISSING` | 运行时还不能发出合法的模型请求 |
| 协议 | `INVALID_REQUEST`、`PROTOCOL_VERSION_UNSUPPORTED`、`CAPABILITY_NOT_EXPOSED` | 调用方与能力面没有就这次交换达成一致 |
| 执行 | `ACTION_NOT_FOUND`、`ACTION_UNAVAILABLE`、`PERMISSION_DENIED`、`INVALID_PARAMS`、`EXECUTION_FAILED`、`EXPECTATION_FAILED` | 请求到了页面边界，但没有得到可接受的结果 |
| 模型 / 网络 | `LLM_FAILED`、重试耗尽、超时 | 推理服务或传输没有返回可用响应 |

层次比文案重要。配置错误需要改部署；协议错误需要改客户端或收窄白名单；动作不可用往往要让页面满足前置条件；期望失败则必须检查页面，而不是重复发送同一个调用。

## 协议失败与业务失败

Surface 刻意保留两种结果：

```ts
// 能力从未对当前调用方公开。
{ ok: false, error: { code: "CAPABILITY_NOT_EXPOSED", message: "..." } }

// 调用到达动作，但策略或处理函数拒绝了。
{ ok: true, result: { error: { code: "PERMISSION_DENIED", message: "..." } } }
```

只判断 `ok` 的客户端会把一次被拒绝的写入当成成功。两条分支都必须处理。

## 恢复取决于当前状态

- `ACTION_NOT_FOUND`：重新读取页面描述，声明可能已经消失或改名。
- `ACTION_UNAVAILABLE`：读取原因并满足前置条件，不要绕过闸门。
- `INVALID_PARAMS`：按 schema 修正字段，不要原样重试。
- `PERMISSION_DENIED`：停止该操作，询问用户或改走允许的路径。
- `EXPECTATION_FAILED`：先观察页面，判断是否发生了部分成功。
- `LLM_FAILED`：保留请求 id，检查网关状态，只在受限策略下重试。

## 错误也是证据

错误码、当前快照和工具结果共同构成恢复上下文。一句笼统的“出错了”会丢掉这些证据。界面文案可以解释给人听，程序逻辑应按稳定错误码分支。

完整错误码表、限额默认值和适配器行为见 [错误码与诊断](/zh/reference/error-codes-and-diagnostics)。
