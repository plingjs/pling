<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import { api, errorMessage } from "../../../recipe-shared/api";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Invoice { id: string; customer: string; amount: number; status: string; note: string }
interface Approval { id: string; ownerId: string; capability: string; record: string; state: "pending" | "approved" | "rejected"; requestedBy: string; createdAt: string }
interface AuditEvent { id: string; at: string; type: string; [key: string]: unknown }
interface User { email: string; name: string }

const zh = resolveLocale() === "zh";
const email = ref("demo@example.com");
const password = ref("pling-demo");
const user = ref<User | null>(null);
const invoices = ref<Invoice[]>([]);
const approvals = ref<Approval[]>([]);
const audit = ref<AuditEvent[]>([]);
const error = ref("");
const signedIn = computed(() => Boolean(user.value));
const pending = computed(() => approvals.value.filter((item) => item.state === "pending"));

async function signIn(): Promise<void> {
  try { const data = await api<{ user: User }>("/session/login", { method: "POST", body: { email: email.value, password: password.value } }); user.value = data.user; await refreshAll(); } catch (value) { error.value = errorMessage(value); }
}
async function refreshAll(): Promise<void> {
  if (!signedIn.value) return;
  try {
    const [me, list, events] = await Promise.all([
      api<{ invoices: Invoice[] }>("/session/me"),
      api<{ approvals: Approval[] }>("/approvals"),
      api<{ events: AuditEvent[] }>("/audit"),
    ]);
    invoices.value = me.invoices;
    approvals.value = list.approvals;
    audit.value = events.events;
    error.value = "";
  } catch (value) { error.value = errorMessage(value); }
}
async function requestDelete(record = "INV-2042"): Promise<Approval> {
  if (!signedIn.value) throw new Error("Sign in first.");
  try { const data = await api<{ approval: Approval }>("/approvals", { method: "POST", body: { capability: "invoice.delete", record, requestedBy: "codex" } }); await refreshAll(); return data.approval; } catch (value) { error.value = errorMessage(value); throw value; }
}
async function decide(id: string, decision: "approve" | "reject"): Promise<void> {
  try { await api(`/approvals/${encodeURIComponent(id)}/decision`, { method: "POST", body: { decision } }); await refreshAll(); } catch (value) { error.value = errorMessage(value); }
}
async function revokeExternal(): Promise<void> {
  try {
    const issued = await api<{ delegation: { id: string } }>("/delegations", { method: "POST", body: { agent: "external-demo", scopes: ["invoice.list"], ttlSeconds: 120 } });
    await api(`/delegations/${encodeURIComponent(issued.delegation.id)}`, { method: "DELETE" });
    await api("/external/request", { method: "POST", body: { capability: "invoice.list" } });
    error.value = bilingual("Unexpected: the revoked request was accepted.", "意外：撤销后的请求仍被接受。");
  } catch (value) {
    error.value = errorMessage(value);
    await refreshAll();
  }
}

useAgentState("approval_view", () => ({ signedIn: signedIn.value, pending: pending.value.length, invoices: invoices.value.length, lastAudit: audit.value[0]?.type ?? null }), { description: "Pending approval count, invoice count, and last audit event type" });
useAgentTool({ id: "request_invoice_deletion", desc: bilingual("Create a pending human approval to delete an invoice", "创建待真人批准的发票删除请求"), kind: "danger", params: [{ name: "record", label: "Invoice id", values: ["INV-2041", "INV-2042", "INV-2043"] }], available: () => signedIn.value || bilingual("Sign in first", "请先登录"), run: async (args) => requestDelete(String(args.record)) });
useAgentTool({ id: "refresh_approval_audit", desc: bilingual("Refresh approvals and audit events", "刷新审批与审计事件"), kind: "read", available: () => signedIn.value || bilingual("Sign in first", "请先登录"), run: refreshAll });
onMounted(() => { void refreshAll(); });
</script>

<template>
  <RecipeShell eyebrow="Recipe 12 · Approval and audit" :title="bilingual('A pending decision is visible to the person, not owned by the agent', '待决事项对真人可见，但不归 Agent 所有')" :description="bilingual('An external request can create a pending approval. Approving or rejecting is a page action; the audit trail records the same request and whether the business function ran.', '外部请求可以创建待审批事项。允许或拒绝由页面完成；审计记录同一个请求以及业务函数是否执行。')">
    <template #actions><span class="tag warn">{{ pending.length }} {{ bilingual('pending', '待处理') }}</span><button class="chip" :disabled="!signedIn" @click="requestDelete()">{{ bilingual('Request deletion', '请求删除') }}</button><button class="chip" :disabled="!signedIn" @click="revokeExternal">{{ bilingual('Test revoked external call', '测试撤销后的外部调用') }}</button></template>
    <div class="grid">
      <section class="panel"><div class="panel__head"><div><h2>{{ signedIn ? bilingual('Pending approvals', '待处理审批') : bilingual('Sign in to begin', '登录后开始') }}</h2><p>{{ bilingual('The agent can request; it cannot approve.', 'Agent 可以请求，但不能批准。') }}</p></div></div><div v-if="!signedIn" class="body"><form class="form" @submit.prevent="signIn"><label class="field"><span>{{ bilingual('Email', '邮箱') }}</span><input v-model="email" /></label><label class="field"><span>{{ bilingual('Password', '密码') }}</span><input v-model="password" type="password" /></label><button class="button primary" type="submit">{{ bilingual('Sign in', '登录') }}</button></form></div><div v-else class="body"><div v-if="pending.length === 0" class="empty">{{ bilingual('No pending decisions.', '没有待处理事项。') }}</div><div v-for="item in pending" :key="item.id" class="record" style="margin-bottom: 8px"><div class="record__main"><p class="record__title">{{ item.capability }} · {{ item.record }} <span class="record__id">{{ item.id }}</span></p><p class="record__meta">{{ bilingual('Requested by', '请求方') }} {{ item.requestedBy }} · {{ new Date(item.createdAt).toLocaleTimeString() }}</p></div><div class="record__actions"><button type="button" @click="decide(item.id, 'approve')">{{ bilingual('Approve', '允许') }}</button><button class="danger" type="button" @click="decide(item.id, 'reject')">{{ bilingual('Reject', '拒绝') }}</button></div></div></div></section>
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('Invoices and audit', '发票与审计') }}</h2><p>{{ invoices.length }} {{ bilingual('invoices', '张发票') }} · {{ audit.length }} {{ bilingual('events', '条事件') }}</p></div></div><div class="body"><ul class="records" style="padding: 0; max-height: 190px"><li v-for="invoice in invoices" :key="invoice.id" class="record" v-record="{ data: invoice, label: invoice.id, fields: { customer: invoice.customer, amount: invoice.amount, status: invoice.status } }"><div class="record__main"><p class="record__title">{{ invoice.customer }} <span class="record__id">{{ invoice.id }}</span></p><p class="record__meta">¥{{ invoice.amount.toLocaleString() }} · {{ invoice.status }}</p></div></li></ul><div class="event-log" style="margin-top: 12px"><p v-for="event in audit.slice(0, 12)" :key="event.id">{{ event.at.slice(11, 19) }} · {{ event.type }}</p></div></div></section>
    </div>
    <p v-if="error" class="notice error">{{ error }}</p>
    <AgentDock :title="bilingual('Approval assistant', '审批助手')" :quick="zh ? ['请求删除 INV-2042', '刷新审批记录'] : ['Request deletion of INV-2042', 'Refresh the approval and audit state']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
