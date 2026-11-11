---
id: SITE-03-bingcao-merchant-workflows-vue3
layout: page
pageClass: demo-page
title: "案例08：冰草商家工作台（Vue 3）"
description: 用模拟的商家后台展示 Pling 如何接入课程、学员、老师、会员卡和排课流程。
status: draft
release: 0.1
locale: zh
---

<DemoPlayground id="bingcao-merchant-workflows-vue3" />

## 原有页面已经具备什么

页面模拟普通瑜伽商家后台：课程列表、课程详情和编辑、老师档案、团课与私教排课、学员查询、预约和会员卡。这些页面、表单、校验和模拟业务 API 在不接入 Pling 时就存在。切换到“基线版”即可查看原有界面。

这是本地模拟，不会连接真实冰草系统；API 使用 `setTimeout` 和 `localStorage`。

## Pling 增加了什么

切换到“Pling 接入版”，在助手中尝试这些任务：

- 查询学员还剩几次课。助手按姓名或手机号末四位查找；遇到重名时展示脱敏候选，请用户确认，不要求用户知道内部 ID，也不必为了查询切换页面。
- 询问新增老师入口在哪里。Pling 会高亮真实的“新增老师”按钮。这个声明只负责定位，不会替用户点击或提交表单。
- 要求安排“接下来三周周二 13:00”的团课。Pling 按门店 `Asia/Shanghai` 时区计算日期，先预览每一天和冲突；用户确认后才写入，业务服务在保存前会再次检查整组排期。
- 创建或编辑课程后，普通业务页面会打开保存后的记录。助手和人工界面调用同一套处理函数与校验。

页面、状态、权限和业务规则仍由应用掌握。Pling 提供有边界的动作和清晰的任务上下文，不增加第二张表单或另一条写入通道。

## 本地运行

在仓库根目录执行：

```bash
pnpm dev:examples
```

打开 `http://127.0.0.1:5191/demos/bingcao-merchant-workflows-vue3/?lang=zh`。
切换到 `?lang=en` 可查看英文界面。模型请求经过服务端示例网关，供应商密钥不会进入浏览器代码。

## 源码位置

- `examples/demos/bingcao-merchant-workflows-vue3/demo/App.vue`：原有商家页面和表单。
- `examples/demos/bingcao-merchant-workflows-vue3/src/components/IntegratedAgent.vue`：Pling 动作、查询、确认和结果页切换。
- `examples/demos/bingcao-merchant-workflows-vue3/src/domain/mock-api.ts`：模拟业务规则与持久化。
- `examples/demos/bingcao-merchant-workflows-vue3/src/domain/calendar.ts`：按门店时区计算日期。
- `examples/demos/bingcao-merchant-workflows-vue3/demo/main.ts`：Pling 初始化与业务时区配置。

上方预览包含完整源码，并标出了这些接入位置。
