import { AgentDock } from "@plingjs/react";
import type { DemoLocale } from "./locale";
import { OrderFlowPanel } from "./components/OrderFlowPanel";

export function App({ locale }: { locale: DemoLocale }) {
  return (
    <main className="page">
      <OrderFlowPanel locale={locale} />
      <AgentDock
        title={locale === "zh" ? "订单助手 · 运行时" : "Order assistant · runtime"}
        quick={locale === "zh"
          ? ["把 SO-1002 的备注改为“周五回电”，再说明这次运行", "先锁定保存，查看失败代码和逐步记录"]
          : ["Change the note on SO-1002 to “Call back Friday”, then explain this run", "Lock saving to inspect the failure code and step report"]}
        debug={{ maxCalls: 8 }}
      />
    </main>
  );
}
