import { AgentDock } from "@plingjs/react";
import type { DemoLocale } from "./locale";
import { OrderFlowPanel } from "./components/OrderFlowPanel";

export function App({ locale }: { locale: DemoLocale }) {
  return (
    <main className="page">
      <OrderFlowPanel locale={locale} />
      <AgentDock
        title={locale === "zh" ? "订单助手 · 敏感数据" : "Order assistant · sensitive data"}
        quick={locale === "zh"
          ? ["给 SO-1002 的客户打电话", "核对 SO-1002 的客户手机号"]
          : ["Call the customer on SO-1002", "Verify the customer phone on SO-1002"]}
        debug={{ maxCalls: 8 }}
      />
    </main>
  );
}
