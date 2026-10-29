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
      title="Order assistant"
      :quick="
        locale === 'zh'
          ? ['把 SO-1002 的备注改为“周五回电”', '先锁定保存，再完成一次可恢复的失败']
          : ['Change the note on SO-1002 to “Call back Friday”', 'Lock saving, then run a recoverable failure']
      "
      :debug="{ maxCalls: 8 }"
    />
  </main>
</template>
