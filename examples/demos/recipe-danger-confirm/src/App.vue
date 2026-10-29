<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Report { id: string; title: string; owner: string; status: "ready" | "archived" }

const zh = resolveLocale() === "zh";
const reports = ref<Report[]>([
  { id: "RPT-31", title: "Q3 reconciliation", owner: "Finance", status: "ready" },
  { id: "RPT-32", title: "Supplier risk review", owner: "Procurement", status: "ready" },
  { id: "RPT-33", title: "Access review", owner: "Security", status: "ready" },
  { id: "RPT-34", title: "Archive index", owner: "Operations", status: "archived" },
]);
const log = ref<string[]>([]);
const ready = computed(() => reports.value.filter((report) => report.status === "ready"));

function archive(id: string): Report {
  const report = reports.value.find((item) => item.id === id);
  if (!report || report.status === "archived") throw new Error("The report is absent or already archived.");
  report.status = "archived";
  log.value.unshift(`${new Date().toLocaleTimeString()} · archived ${id}`);
  return { ...report };
}

function archiveReady(): number {
  const ids = ready.value.map((report) => report.id);
  for (const id of ids) archive(id);
  return ids.length;
}

useAgentState("archive_view", () => ({
  ready: ready.value.length,
  archived: reports.value.length - ready.value.length,
  lastOperation: log.value[0] ?? null,
}), { description: "Counts of ready and archived reports plus the last destructive result" });

useAgentTool({
  id: "archive_all_ready_reports",
  desc: bilingual("Archive every report that is still ready; this is irreversible in the demo", "归档所有仍为就绪状态的报告；在示例中不可撤销"),
  kind: "danger",
  confirm: "always",
  available: () => ready.value.length > 0 || bilingual("There are no ready reports", "当前没有就绪报告"),
  run: () => ({ archived: archiveReady() }),
});
</script>

<template>
  <RecipeShell eyebrow="Recipe 05 · Consequential actions" :title="bilingual('Destructive work stops for a person', '有后果的动作必须停在真人面前')" :description="bilingual('Rejecting the confirmation leaves the record untouched. Approving runs the same business function once and records the result. The model never receives an approval tool.', '拒绝确认时记录完全不变；允许时才执行一次同一业务函数并留下结果。模型不会拿到“代为批准”的工具。')">
    <template #actions><span class="tag warn">{{ ready.length }} {{ bilingual('ready', '就绪') }}</span><button class="button danger" type="button" :disabled="ready.length === 0" @click="archiveReady">{{ bilingual('Archive all ready', '归档全部就绪报告') }}</button></template>
    <div class="grid equal">
      <section class="panel" v-scope="{ id: 'reports', label: bilingual('Reports', '报告'), role: 'list' }">
        <div class="panel__head"><div><h2>{{ bilingual('Reports', '报告') }}</h2><p>{{ bilingual('Archive is available on each ready row.', '每条就绪记录都有归档动作。') }}</p></div></div>
        <ul class="records">
          <li v-for="report in reports" :key="report.id" class="record" :class="{ 'is-muted': report.status === 'archived' }" v-record="{ data: report, label: report.title, fields: { owner: report.owner, status: report.status } }">
            <div class="record__main"><p class="record__title">{{ report.title }} <span class="record__id">{{ report.id }}</span></p><p class="record__meta">{{ report.owner }} · {{ report.status }}</p></div>
            <div class="record__actions"><button v-if="report.status === 'ready'" class="danger" type="button" v-tool="{ id: `archive@${report.id}`, desc: bilingual(`Archive ${report.id}; this needs human confirmation`, `归档 ${report.id}；需要真人确认`), kind: 'danger', confirm: 'always' }" @click="archive(report.id)">{{ bilingual('Archive', '归档') }}</button><span v-else class="tag">{{ bilingual('Archived', '已归档') }}</span></div>
          </li>
        </ul>
      </section>
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('Result log', '结果记录') }}</h2><p>{{ bilingual('Only an executed business action appears here.', '只有真正执行过的业务动作才会出现在这里。') }}</p></div></div><div class="body"><div v-if="log.length === 0" class="empty">{{ bilingual('No destructive action has run.', '尚未执行破坏性动作。') }}</div><div v-else class="event-log"><p v-for="entry in log" :key="entry">{{ entry }}</p></div></div></section>
    </div>
    <AgentDock :title="bilingual('Archive assistant', '归档助手')" :quick="zh ? ['归档 RPT-31', '先拒绝一次确认，再归档 RPT-32'] : ['Archive RPT-31', 'Reject the confirmation once, then archive RPT-32']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
