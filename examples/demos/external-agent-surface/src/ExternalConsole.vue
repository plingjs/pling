<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import { priorityLabel, type DemoLocale, type Priority } from "./copy";
import { copyFor } from "./copy";

interface ExternalRecord {
  id: string;
  label?: string;
  fields?: Record<string, unknown>;
}

const props = defineProps<{
  surface: AgentSurface;
  locale: DemoLocale;
}>();

const copy = computed(() => copyFor(props.locale));
const response = ref<SurfaceResponse | null>(null);
const proof = ref("—");
const notice = ref("");
const records = ref<ExternalRecord[]>([]);
const selectedId = ref("");
const text = ref("");
const priority = ref<Priority>("today");
let sequence = 0;

const selected = computed(() => records.value.find((record) => record.id === selectedId.value) ?? null);

watch(records, (value) => {
  if (!value.some((record) => record.id === selectedId.value)) selectedId.value = value[0]?.id ?? "";
});

function request(method: "describe" | "invoke", extra: Record<string, unknown> = {}) {
  return {
    protocol: SURFACE_PROTOCOL,
    id: `external-${++sequence}`,
    method,
    ...extra,
  };
}

function outcomeOf(result: SurfaceResponse): string {
  if (!result.ok) return result.error.code;
  if ("error" in result.result) return result.result.error.code;
  return "ok";
}

async function send(value: ReturnType<typeof request>): Promise<SurfaceResponse> {
  const result = await props.surface.handle(value);
  response.value = result;
  proof.value = JSON.stringify(result, null, 2);
  await refreshRecords();
  return result;
}

async function refreshRecords(): Promise<void> {
  const result = await props.surface.handle(request("describe", { input: { limit: 24 } }));
  if (result.ok && "context" in result.result) {
    records.value = result.result.context.records.map((record) => ({
      id: record.id,
      ...(record.label ? { label: record.label } : {}),
      ...(record.fields ? { fields: record.fields } : {}),
    }));
  }
}

async function describe(): Promise<void> {
  notice.value = "";
  const result = await props.surface.handle(request("describe", { input: { limit: 24 } }));
  response.value = result;
  proof.value = JSON.stringify(result, null, 2);
  if (result.ok && "context" in result.result) {
    records.value = result.result.context.records.map((record) => ({
      id: record.id,
      ...(record.label ? { label: record.label } : {}),
      ...(record.fields ? { fields: record.fields } : {}),
    }));
  }
}

function taskLabel(record: ExternalRecord): string {
  const value = record.fields?.text;
  return typeof value === "string" ? value : record.label ?? record.id;
}

async function add(): Promise<void> {
  if (!text.value.trim()) return;
  const result = await send(request("invoke", { capability: "todo.add", input: { text: text.value, priority: priority.value } }));
  notice.value = `todo.add → ${outcomeOf(result)}`;
  if (result.ok) text.value = "";
}

async function update(): Promise<void> {
  if (!selectedId.value || !text.value.trim()) return;
  const result = await send(
    request("invoke", { capability: "todo.update", input: { taskId: selectedId.value, text: text.value } }),
  );
  notice.value = `todo.update → ${outcomeOf(result)}`;
}

async function toggle(): Promise<void> {
  if (!selectedId.value) return;
  const result = await send(
    request("invoke", { capability: "todo.toggle", input: { taskId: selectedId.value } }),
  );
  notice.value = `todo.toggle → ${outcomeOf(result)}`;
}

async function remove(): Promise<void> {
  if (!selectedId.value) return;
  const result = await send(
    request("invoke", { capability: "todo.delete", input: { taskId: selectedId.value } }),
  );
  notice.value = `todo.delete → ${outcomeOf(result)}`;
}

async function clear(): Promise<void> {
  const result = await send(request("invoke", { capability: "todo.clear_completed" }));
  notice.value = `todo.clear_completed → ${outcomeOf(result)}`;
}

onMounted(() => {
  void describe();
});

defineExpose({ response });
</script>

<template>
  <aside class="external" aria-labelledby="external-title">
    <header class="external__head">
      <div>
        <p class="eyebrow">{{ copy.panelEyebrow }}</p>
        <h2 id="external-title">{{ copy.panelTitle }}</h2>
      </div>
      <code>0.1</code>
    </header>
    <p class="external__lead">{{ copy.panelLead }}</p>

    <div class="external__form">
      <label>
        <span>{{ copy.recordLabel }}</span>
        <select v-model="selectedId">
          <option v-if="records.length === 0" value="">{{ copy.noRecords }}</option>
          <option v-for="record in records" :key="record.id" :value="record.id">
            {{ taskLabel(record) }} · {{ record.id }}
          </option>
        </select>
      </label>
      <label>
        <span>{{ copy.textLabel }}</span>
        <input v-model="text" :placeholder="selected ? taskLabel(selected) : copy.newTaskPlaceholder" />
      </label>
      <label>
        <span>{{ copy.priorityParam }}</span>
        <select v-model="priority">
          <option value="today">{{ priorityLabel(locale, "today") }}</option>
          <option value="soon">{{ priorityLabel(locale, "soon") }}</option>
          <option value="later">{{ priorityLabel(locale, "later") }}</option>
        </select>
      </label>
    </div>

    <div class="external__actions">
      <button type="button" @click="describe()">{{ copy.describe }}</button>
      <button type="button" @click="add">{{ copy.externalAdd }}</button>
      <button type="button" :disabled="!selectedId || !text.trim()" @click="update">{{ copy.externalUpdate }}</button>
      <button type="button" :disabled="!selectedId" @click="toggle">{{ copy.externalToggle }}</button>
      <button type="button" class="danger" :disabled="!selectedId" @click="remove">{{ copy.externalDelete }}</button>
      <button type="button" class="danger" @click="clear">{{ copy.externalClear }}</button>
    </div>

    <p v-if="notice" class="notice">{{ notice }}</p>
    <p class="response-label">{{ copy.response }}</p>
    <pre>{{ proof }}</pre>
  </aside>
</template>

<style scoped>
.external {
  padding: 18px;
  border: 1px solid #dbe6f2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 36px rgb(15 23 42 / 6%);
}
.external__head,
.external__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.external__head {
  justify-content: space-between;
}
.eyebrow {
  margin: 0 0 3px;
  color: #2e9df7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h2 {
  margin: 0;
  font-size: 18px;
}
code {
  padding: 3px 6px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
}
.external__lead {
  margin: 9px 0 14px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}
.external__form {
  display: grid;
  grid-template-columns: 1fr 1.2fr 110px;
  gap: 8px;
  margin-bottom: 10px;
}
.external__form label {
  display: grid;
  gap: 4px;
  color: #475569;
  font-size: 11px;
  font-weight: 650;
}
.external__form input,
.external__form select {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-size: 12px;
  font-weight: 400;
}
.external__actions {
  flex-wrap: wrap;
}
.external__actions button {
  padding: 6px 9px;
  border: 1px solid #dbe6f2;
  border-radius: 8px;
  background: #f8fbfe;
  color: #0b6db7;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}
.external__actions button.danger {
  color: #b91c1c;
}
.external__actions button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}
.notice {
  margin: 10px 0 0;
  color: #0b6db7;
  font-size: 12px;
}
.response-label {
  margin: 14px 0 6px;
  color: #64748b;
  font-size: 11px;
}
pre {
  max-height: 260px;
  margin: 0;
  padding: 11px;
  overflow: auto;
  border-radius: 9px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 11px;
  line-height: 1.5;
}
@media (max-width: 700px) {
  .external__form {
    grid-template-columns: 1fr;
  }
}
</style>
