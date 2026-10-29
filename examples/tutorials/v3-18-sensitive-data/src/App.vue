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
      title="Order assistant · sensitive data"
      :quick="
        locale === 'zh'
          ? ['给 SO-1002 的客户打电话', '核对 SO-1002 的客户信息']
          : ['Call the customer on SO-1002', 'Verify the customer for SO-1002']
      "
      :debug="{ maxCalls: 8 }"
    />
  </main>
</template>
