<script setup lang="ts">
import { computed } from "vue";
import { AgentDock } from "@plingjs/vue";
import OrderFlowPanel from "./components/OrderFlowPanel.vue";

const locale = computed(() => (new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en"));
</script>

<template>
  <main class="page">
    <OrderFlowPanel :locale="locale" />
    <AgentDock
      title="Order assistant · runtime limits"
      :quick="
        locale === 'zh'
          ? ['把 SO-1002 的备注改为“周五回电”，然后解释这次运行', '先锁定保存，观察失败错误码与逐步记录']
          : ['Change the note on SO-1002 to “Call back Friday”, then explain this run', 'Lock saving to inspect the failure code and step report']
      "
      :debug="{ maxCalls: 8 }"
    />
  </main>
</template>
