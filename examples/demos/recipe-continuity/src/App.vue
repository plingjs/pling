<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Customer { id: string; name: string; plan: string; note: string }

const zh = resolveLocale() === "zh";
const customers = ref<Customer[]>([
  { id: "CUS-1001", name: "Northwind", plan: "Enterprise", note: "" },
  { id: "CUS-1002", name: "Globex", plan: "Growth", note: "" },
  { id: "CUS-1003", name: "Initech", plan: "Starter", note: "" },
  { id: "CUS-1004", name: "Umbrella", plan: "Enterprise", note: "" },
]);
const query = new URLSearchParams(location.search);
const recordId = query.get("record");
const record = computed(() => customers.value.find((item) => item.id === recordId) ?? null);
const noteDraft = ref(record.value?.note ?? "");
const savedNote = ref(record.value?.note ?? "");
const detailHref = (id: string) => `${location.pathname}?record=${encodeURIComponent(id)}${zh ? "&lang=zh" : ""}`;

function save(): Customer {
  const current = record.value;
  if (!current) throw new Error("Open a customer detail document first.");
  const note = noteDraft.value.trim();
  if (!note) throw new Error("A note is required.");
  current.note = note;
  savedNote.value = note;
  return { ...current };
}

useAgentState("continuity_view", () => ({
  document: record.value ? "detail" : "list",
  record: record.value?.id ?? null,
  noteSaved: Boolean(savedNote.value),
}), { description: "Current document, selected customer, and whether the detail note was saved" });

useAgentTool({
  id: "save_customer_note",
  desc: bilingual("Save the follow-up note on the open customer detail document", "保存当前客户详情文档中的跟进备注"),
  kind: "write",
  params: [{ name: "note", label: "Follow-up note", maxLength: 300 }],
  available: () => Boolean(record.value) || bilingual("Open a customer detail page first", "请先打开客户详情页"),
  run: async (args) => { noteDraft.value = String(args.note); return save(); },
  expect: { desc: bilingual("The saved note appears on the detail page", "详情页出现已保存备注"), check: () => savedNote.value.length > 0 },
});
</script>

<template>
  <RecipeShell eyebrow="Recipe 08 · Across documents" :title="bilingual('A task can outlive the document that started it', '任务可以比启动它的 document 活得更久')" :description="bilingual('List and detail are separate documents. Opening a customer performs a full navigation; the pending task reconnects on the new page and finishes there.', '列表与详情是两个独立 document。打开客户会执行整页导航；待完成任务在新页面重新接上并完成。')">
    <template #actions><a v-if="record" class="chip" :href="`${location.pathname}${zh ? '?lang=zh' : ''}`">← {{ bilingual('Back to list', '返回列表') }}</a><span class="tag">{{ record ? bilingual('Detail document', '详情文档') : bilingual('List document', '列表文档') }}</span></template>
    <section v-if="!record" class="panel" v-scope="{ id: 'customers', label: bilingual('Customers', '客户'), role: 'list' }">
      <div class="panel__head"><div><h2>{{ bilingual('Customer list', '客户列表') }}</h2><p>{{ bilingual('Each link replaces the current document.', '每个链接都会替换当前 document。') }}</p></div></div>
      <ul class="records">
        <li v-for="customer in customers" :key="customer.id" class="record" v-record="{ data: customer, label: customer.name, fields: { plan: customer.plan, note: customer.note } }"><div class="record__main"><p class="record__title">{{ customer.name }} <span class="record__id">{{ customer.id }}</span></p><p class="record__meta">{{ customer.plan }} · {{ customer.note || bilingual('No note', '无备注') }}</p></div><a class="button" :href="detailHref(customer.id)" v-tool="{ id: `open@${customer.id}`, desc: bilingual(`Open ${customer.id} in a new document`, `在新的 document 打开 ${customer.id}`), kind: 'read' }">{{ bilingual('Open detail', '打开详情') }} →</a></li>
      </ul>
    </section>
    <section v-else class="grid">
      <div class="panel"><div class="panel__head"><div><h2>{{ record.name }}</h2><p>{{ record.id }} · {{ record.plan }}</p></div><span class="tag ok">{{ bilingual('Full page navigation', '整页导航') }}</span></div><div class="body"><dl class="kv"><dt>{{ bilingual('Customer', '客户') }}</dt><dd>{{ record.name }}</dd><dt>{{ bilingual('Plan', '方案') }}</dt><dd>{{ record.plan }}</dd><dt>{{ bilingual('Saved note', '已保存备注') }}</dt><dd>{{ savedNote || bilingual('None', '无') }}</dd></dl></div></div>
      <div class="panel"><div class="panel__head"><div><h2>{{ bilingual('Follow-up', '跟进') }}</h2><p>{{ bilingual('The resumed task can finish here.', '恢复后的任务可以在这里完成。') }}</p></div></div><div class="body"><label class="field"><span>{{ bilingual('Note', '备注') }}</span><textarea v-model="noteDraft" v-tool="{ id: 'customer_note_input', action: 'fill', desc: bilingual('Follow-up note for this customer', '给这个客户填写跟进备注') }" /></label><div class="form__footer"><span class="status">{{ savedNote ? bilingual('Saved.', '已保存。') : '' }}</span><button class="button primary" type="button" @click="save">{{ bilingual('Save note', '保存备注') }}</button></div></div></div>
    </section>
    <AgentDock :title="bilingual('Customer assistant', '客户助手')" :quick="zh ? ['打开 Globex 的详情页，把备注写成：周五约吃饭，然后保存', '返回列表'] : ['Open Globex, set the note to “Dinner on Friday”, and save it', 'Return to the list']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
