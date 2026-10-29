<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import { api, errorMessage } from "../../../recipe-shared/api";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Delegation { id: string; agent: string; scopes: string[]; createdAt: string; expiresAt: number; revokedAt: string | null }
interface User { email: string; name: string }

const zh = resolveLocale() === "zh";
const email = ref("demo@example.com");
const password = ref("pling-demo");
const user = ref<User | null>(null);
const agent = ref("Codex");
const ttl = ref(120);
const scopes = ref(["invoice.list"]);
const delegations = ref<Delegation[]>([]);
const token = ref("");
const result = ref("");
const error = ref("");
const signedIn = computed(() => Boolean(user.value));
const canIssue = computed(() => signedIn.value && scopes.value.length > 0);

async function signIn(): Promise<void> {
  error.value = "";
  try {
    const data = await api<{ user: User }>("/session/login", { method: "POST", body: { email: email.value, password: password.value } });
    user.value = data.user;
    await refresh();
  } catch (value) { error.value = errorMessage(value); }
}
async function refresh(): Promise<void> {
  try {
    const data = await api<{ delegations: Delegation[] }>("/delegations");
    delegations.value = data.delegations;
  } catch (value) { error.value = errorMessage(value); }
}
async function issue(): Promise<void> {
  if (!canIssue.value) throw new Error("Sign in and choose at least one scope.");
  try {
    const data = await api<{ delegation: Delegation; token: string }>("/delegations", { method: "POST", body: { agent: agent.value, ttlSeconds: ttl.value, scopes: scopes.value } });
    token.value = data.token;
    result.value = bilingual("Delegation issued. The raw token is shown once in this demo.", "委托已签发。示例中只在此处显示原始凭证。");
    await refresh();
  } catch (value) { error.value = errorMessage(value); }
}
async function invoke(capability: string): Promise<void> {
  error.value = "";
  try {
    const input = capability === "invoice.add_note" ? { record: "INV-2041", note: "Delegated follow-up" } : {};
    const data = await api<{ result: unknown }>("/delegations/invoke", { method: "POST", headers: { authorization: `Bearer ${token.value}` }, body: { capability, input } });
    result.value = JSON.stringify(data, null, 2);
  } catch (value) { error.value = errorMessage(value); result.value = ""; }
}
async function revoke(id: string): Promise<void> {
  try { await api(`/delegations/${encodeURIComponent(id)}`, { method: "DELETE" }); token.value = ""; await refresh(); result.value = bilingual("Delegation revoked. The next invoke must fail.", "委托已撤销。下一次调用必须失败。"); } catch (value) { error.value = errorMessage(value); }
}

useAgentState("delegation_view", () => ({ signedIn: signedIn.value, agent: agent.value, scopes: scopes.value, issued: delegations.value.length, active: delegations.value.filter((item) => !item.revokedAt && item.expiresAt > Date.now()).length }), { description: "Consent choices and delegation counts; the raw token is never repeated in state" });
useAgentTool({ id: "issue_delegation", desc: bilingual("Issue a short-lived delegated credential after the user chose scopes", "在用户选择范围后签发短期委托凭证"), kind: "write", available: () => canIssue.value || bilingual("Sign in and choose scopes first", "请先登录并选择范围"), run: issue });
onMounted(() => { void refresh(); });
</script>

<template>
  <RecipeShell eyebrow="Recipe 11 · Consent" :title="bilingual('Give one agent a narrow, expiring credential', '给一个 Agent 一份窄范围、会过期的凭证')" :description="bilingual('The browser session is not copied. Consent chooses an agent, scope, and lifetime; revocation must make the next external request fail before business code runs.', '这里不复制浏览器会话。用户选择 Agent、范围和有效期；撤销后，下一次外部请求必须在业务代码之前失败。')">
    <div class="grid">
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('Consent', '授权') }}</h2><p>{{ signedIn ? user?.email : bilingual('Sign in first', '请先登录') }}</p></div></div><div class="body"><form class="form" @submit.prevent="signIn"><label class="field"><span>{{ bilingual('Email', '邮箱') }}</span><input v-model="email" type="email" /></label><label class="field"><span>{{ bilingual('Password', '密码') }}</span><input v-model="password" type="password" /></label><button v-if="!signedIn" class="button primary" type="submit">{{ bilingual('Sign in', '登录') }}</button></form><div v-if="signedIn" class="form" style="margin-top: 14px"><label class="field"><span>{{ bilingual('Agent name', 'Agent 名称') }}</span><input v-model="agent" /></label><label class="field"><span>{{ bilingual('TTL seconds', '有效期（秒）') }}</span><input v-model.number="ttl" type="number" min="15" max="3600" /></label><div class="field"><span>{{ bilingual('Scopes', '范围') }}</span><label class="check-row"><input v-model="scopes" type="checkbox" value="invoice.list" /> invoice.list</label><label class="check-row"><input v-model="scopes" type="checkbox" value="invoice.add_note" /> invoice.add_note</label><label class="check-row"><input v-model="scopes" type="checkbox" value="report.export" /> report.export</label></div><button class="button primary" type="button" :disabled="!canIssue" @click="issue">{{ bilingual('Issue delegation', '签发委托') }}</button></div></div></section>
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('Delegations', '委托记录') }}</h2><p>{{ delegations.length }} {{ bilingual('issued', '已签发') }}</p></div></div><ul class="records" v-scope="{ id: 'delegations', label: bilingual('Delegations', '委托'), role: 'list' }"><li v-for="item in delegations" :key="item.id" class="record" :class="{ 'is-muted': item.revokedAt }" v-record="{ data: item, label: item.id, fields: { agent: item.agent, scopes: item.scopes, expiresAt: item.expiresAt, revokedAt: item.revokedAt } }"><div class="record__main"><p class="record__title">{{ item.agent }} <span class="record__id">{{ item.id }}</span></p><p class="record__meta">{{ item.scopes.join(', ') }} · {{ item.revokedAt ? bilingual('revoked', '已撤销') : new Date(item.expiresAt).toLocaleTimeString() }}</p></div><div class="record__actions"><button v-if="!item.revokedAt" class="danger" type="button" @click="revoke(item.id)">{{ bilingual('Revoke', '撤销') }}</button><span v-else class="tag bad">{{ bilingual('Revoked', '已撤销') }}</span></div></li></ul><div v-if="token" class="body"><p class="hint">{{ bilingual('Use this token only in the demo invoke buttons.', '这个凭证只用于下方的示例调用按钮。') }}</p><pre class="code-box">{{ token }}</pre><div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px"><button class="button" @click="invoke('invoice.list')">invoice.list</button><button class="button" @click="invoke('report.export')">report.export</button><button class="button" @click="invoke('invoice.add_note')">invoice.add_note</button></div><pre v-if="result" class="code-box" style="margin-top: 10px">{{ result }}</pre></div><p v-if="error" class="notice error">{{ error }}</p></section>
    </div>
    <AgentDock :title="bilingual('Delegation assistant', '委托助手')" :quick="zh ? ['帮我签发一个只能读取发票的 2 分钟委托', '撤销最新的委托'] : ['Issue a two-minute delegation that can only read invoices', 'Revoke the latest delegation']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
