import { AgentDock } from "@plingjs/react";
import type { DemoLocale } from "./locale";
import { OrderFlowPanel } from "./components/OrderFlowPanel";

export function App({ locale }: { locale: DemoLocale }) {
  return (
    <main className="page">
      <OrderFlowPanel locale={locale} />
      <AgentDock
        title={locale === "zh" ? "订单助手" : "Order assistant"}
        quick={locale === "zh"
          ? ["把 SO-1002 的备注改为“周五回电”", "先锁定保存，再完成一次可恢复的失败"]
          : ["Change the note on SO-1002 to “Call back Friday”", "Lock saving, then run a recoverable failure"]}
        debug={{ maxCalls: 8 }}
      />
    </main>
  );
}
