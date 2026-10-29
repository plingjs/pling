<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAgentState, useAgentTool } from "@plingjs/vue";
import {
  copyFor,
  riskLabel,
  statusLabel,
  type AccountStatus,
  type DemoLocale,
} from "../copy";
import type { AccountStore } from "../store";

const props = defineProps<{
  store: AccountStore;
  locale: DemoLocale;
}>();

const route = useRoute();
const router = useRouter();
const copy = computed(() => copyFor(props.locale));
const accountId = computed(() => String(route.params.id ?? ""));
const account = computed(() => props.store.find(accountId.value));
const note = ref(account.value?.note ?? "");
const saved = ref(false);

watch(
  account,
  (value) => {
    note.value = value?.note ?? "";
    saved.value = false;
  },
  { immediate: true },
);

useAgentState(
  "account_detail_view",
  () => ({
    id: accountId.value,
    found: Boolean(account.value),
    name: account.value?.name ?? null,
    status: account.value?.status ?? null,
    risk: account.value?.risk ?? null,
  }),
  { description: copy.value.detailStateDescription },
);

useAgentTool({
  id: "account.update_status",
  desc: copy.value.updateStatusDesc,
  kind: "write",
  available: () => (account.value ? true : copy.value.missing),
  params: [
    {
      name: "accountId",
      label: copy.value.accountParam,
      options: () => props.store.accounts.value.map((item) => ({ value: item.id, label: item.name })),
    },
    {
      name: "status",
      label: copy.value.statusParam,
      values: ["open", "reviewing", "reviewed"],
    },
  ],
  run: ({ accountId: id, status }) => {
    const changed = props.store.setStatus(String(id), String(status) as AccountStatus);
    return { changed, accountId: id, status };
  },
});

useAgentTool({
  id: "account.save_note",
  desc: copy.value.saveNoteDesc,
  kind: "write",
  available: () => (account.value ? true : copy.value.missing),
  params: [
    {
      name: "accountId",
      label: copy.value.accountParam,
      options: () => props.store.accounts.value.map((item) => ({ value: item.id, label: item.name })),
    },
    { name: "note", label: copy.value.noteParam, maxLength: 240 },
  ],
  run: ({ accountId: id, note: value }) => {
    const changed = props.store.saveNote(String(id), String(value));
    if (String(id) === accountId.value) {
      note.value = String(value).trim();
      saved.value = changed;
    }
    return { changed, accountId: id };
  },
});

function back(): void {
  void router.push({ name: "accounts", query: props.locale === "zh" ? { lang: "zh" } : {} });
}

function setStatus(status: AccountStatus): void {
  if (!account.value) return;
  props.store.setStatus(account.value.id, status);
}

function saveNote(): void {
  if (!account.value) return;
  saved.value = props.store.saveNote(account.value.id, note.value);
}
</script>

<template>
  <section v-if="account" class="detail" v-scope="{ id: 'account_detail', label: copy.accountDetail, description: copy.lead, role: 'page' }">
    <header class="detail__head">
      <button type="button" class="back" v-tool="{ id: 'back_to_accounts', kind: 'read', desc: copy.backDesc }" @click="back">← {{ copy.back }}</button>
      <p class="eyebrow">{{ copy.accountDetail }}</p>
      <h1>{{ account.name }}</h1>
      <p class="lead">{{ account.segment }} · {{ account.owner }}</p>
    </header>

    <div
      class="detail__card"
      v-record="{
        data: account,
        label: account.name,
        fields: {
          name: account.name,
          segment: account.segment,
          owner: account.owner,
          risk: account.risk,
          status: account.status,
          revenue: account.revenue,
          lastContact: account.lastContact,
          note: account.note,
        },
      }"
    >
      <dl>
        <div><dt>{{ copy.risk }}</dt><dd>{{ riskLabel(locale, account.risk) }}</dd></div>
        <div><dt>{{ copy.status }}</dt><dd>{{ statusLabel(locale, account.status) }}</dd></div>
        <div><dt>{{ copy.revenue }}</dt><dd>¥{{ account.revenue.toLocaleString("en-US") }}</dd></div>
        <div><dt>{{ copy.lastContact }}</dt><dd>{{ account.lastContact }}</dd></div>
      </dl>

      <div class="status-actions">
        <button type="button" :class="{ 'is-active': account.status === 'open' }" @click="setStatus('open')">{{ copy.markOpen }}</button>
        <button type="button" :class="{ 'is-active': account.status === 'reviewing' }" @click="setStatus('reviewing')">{{ copy.markReviewing }}</button>
        <button type="button" :class="{ 'is-active': account.status === 'reviewed' }" @click="setStatus('reviewed')">{{ copy.markReviewed }}</button>
      </div>

      <label class="note">
        <span>{{ copy.note }}</span>
        <textarea
          v-model="note"
          rows="5"
          :placeholder="copy.notePlaceholder"
          v-tool="{ id: `account_note@${account.id}`, action: 'fill', desc: copy.notePlaceholder }"
        ></textarea>
      </label>
      <div class="note__actions">
        <span v-if="saved" class="saved">{{ copy.noteSaved }}</span>
        <button type="button" class="primary" @click="saveNote">{{ copy.saveNote }}</button>
      </div>
    </div>
  </section>

  <section v-else class="detail" v-scope="{ id: 'account_missing', label: copy.missing, description: copy.missing, role: 'page' }">
    <h1>{{ copy.missing }}</h1>
    <p class="lead">{{ copy.missingBody(accountId) }}</p>
    <button type="button" class="back" v-tool="{ id: 'back_to_accounts', kind: 'read', desc: copy.backDesc }" @click="back">← {{ copy.back }}</button>
  </section>
</template>

<style scoped>
.detail {
  padding: 22px;
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 44px rgb(15 23 42 / 7%);
}
.detail__head {
  padding-bottom: 16px;
  border-bottom: 1px solid #eef2f7;
}
.eyebrow {
  margin: 14px 0 4px;
  color: #2e9df7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.03em;
}
.lead {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}
.back {
  padding: 0;
  border: 0;
  background: none;
  color: #0b6db7;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.detail__card {
  display: grid;
  gap: 18px;
  padding-top: 18px;
}
dl {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 0;
}
dl div {
  padding: 11px;
  border-radius: 10px;
  background: #f8fbfe;
}
dt {
  color: #64748b;
  font-size: 11px;
}
dd {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 650;
}
.status-actions {
  display: flex;
  gap: 6px;
}
.status-actions button {
  padding: 6px 10px;
  border: 1px solid #dbe6f2;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}
.status-actions button.is-active {
  border-color: #a7d6fb;
  background: #eaf6ff;
  color: #0b6db7;
  font-weight: 650;
}
.note {
  display: grid;
  gap: 6px;
  color: #475569;
  font-size: 12px;
  font-weight: 650;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  color: #0f172a;
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  resize: vertical;
}
textarea:focus {
  border-color: #2e9df7;
  outline: 3px solid rgb(46 157 247 / 16%);
}
.note__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.primary {
  padding: 8px 13px;
  border: 0;
  border-radius: 9px;
  background: #1273cf;
  color: #fff;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.saved {
  color: #15803d;
  font-size: 12px;
}
@media (max-width: 720px) {
  dl {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
