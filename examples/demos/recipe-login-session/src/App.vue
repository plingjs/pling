<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import { api, errorMessage } from "../../../recipe-shared/api";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Invoice { id: string; customer: string; amount: number; status: string; note: string }
interface User { id: string; email: string; name: string }

const zh = resolveLocale() === "zh";
const email = ref("demo@example.com");
const password = ref("pling-demo");
const user = ref<User | null>(null);
const invoices = ref<Invoice[]>([]);
const expiresAt = ref(0);
const loading = ref(false);
const error = ref("");
const drafts = ref<Record<string, string>>({});
const signedIn = computed(() => user.value !== null);

async function signIn(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const data = await api<{ user: User; expiresAt: number }>("/session/login", {
      method: "POST",
      body: { email: email.value, password: password.value },
    });
    user.value = data.user;
    expiresAt.value = data.expiresAt;
    await refresh();
  } catch (value) {
    user.value = null;
    invoices.value = [];
    error.value = errorMessage(value);
  } finally {
    loading.value = false;
  }
}

async function refresh(options: { quiet?: boolean } = {}): Promise<void> {
  try {
    const data = await api<{ user: User; invoices: Invoice[]; expiresAt: number }>("/session/me");
    user.value = data.user;
    invoices.value = data.invoices;
    expiresAt.value = data.expiresAt;
    error.value = "";
  } catch (value) {
    const hadSession = user.value !== null;
    user.value = null;
    invoices.value = [];
    error.value = options.quiet && !hadSession ? "" : errorMessage(value);
  }
}

async function expire(): Promise<void> {
  await api("/session/expire", { method: "POST" });
  await refresh();
}

async function signOut(): Promise<void> {
  await api("/session/logout", { method: "POST" });
  user.value = null;
  invoices.value = [];
  error.value = "";
}

async function saveNote(record: string, note: string): Promise<Invoice> {
  if (!signedIn.value) throw new Error("Sign in first.");
  const data = await api<{ invoice: Invoice }>("/session/note", {
    method: "POST",
    body: { record, note },
  });
  invoices.value = invoices.value.map((invoice) => (invoice.id === record ? data.invoice : invoice));
  return data.invoice;
}

async function saveDraft(invoice: Invoice): Promise<void> {
  await saveNote(invoice.id, drafts.value[invoice.id] ?? "");
  drafts.value[invoice.id] = "";
}

useAgentState(
  "session_view",
  () => ({
    signedIn: signedIn.value,
    user: user.value?.name ?? null,
    expiresAt: expiresAt.value,
    visibleInvoices: invoices.value.length,
  }),
  { description: "Signed-in user and protected record count; no cookie or password" },
);

useAgentTool({
  id: "refresh_invoices",
  desc: bilingual("Refresh the protected invoice list for the signed-in user", "刷新当前登录用户可见的受保护发票"),
  kind: "read",
  available: () => signedIn.value || bilingual("Sign in before refreshing invoices", "请先登录再刷新发票"),
  run: refresh,
});

useAgentTool({
  id: "add_invoice_note",
  desc: bilingual("Add a follow-up note to one protected invoice", "给一张受保护发票添加跟进备注"),
  kind: "write",
  params: [
    { name: "record", label: "Invoice id", values: ["INV-2041", "INV-2042", "INV-2043"] },
    { name: "note", label: "Follow-up note", maxLength: 500 },
  ],
  available: () => signedIn.value || bilingual("Sign in before changing invoice data", "请先登录再修改发票"),
  run: async (args) => saveNote(String(args.record), String(args.note)),
});

onMounted(() => refresh({ quiet: true }));
</script>

<template>
  <RecipeShell
    eyebrow="Recipe 01 · Identity"
    :title="bilingual('Protected invoices, a real session, and a clean failure path', '受保护发票、真实会话与清楚的失败路径')"
    :description="bilingual('The assistant can only see the invoices that the signed-in browser can see. Expiring or signing out removes the records and actions before the next request.', '助手只能看到已登录浏览器有权访问的发票。会话过期或退出后，记录与动作会在下一次请求前消失。')"
  >
    <template #actions>
      <span class="tag" :class="signedIn ? 'ok' : 'warn'">{{ signedIn ? bilingual('Session active', '会话有效') : bilingual('Signed out', '未登录') }}</span>
      <button v-if="signedIn" class="chip" type="button" @click="expire">{{ bilingual('Expire session', '让会话过期') }}</button>
      <button v-if="signedIn" class="chip" type="button" @click="signOut">{{ bilingual('Sign out', '退出登录') }}</button>
    </template>

    <div class="grid">
      <section class="panel">
        <div class="panel__head"><div><h2>{{ bilingual('Sign in', '登录') }}</h2><p>{{ bilingual('Demo account: demo@example.com / pling-demo', '演示账号：demo@example.com / pling-demo') }}</p></div></div>
        <div class="body">
          <form class="form" @submit.prevent="signIn">
            <label class="field"><span>{{ bilingual('Email', '邮箱') }}</span><input v-model="email" type="email" autocomplete="username" /></label>
            <label class="field"><span>{{ bilingual('Password', '密码') }}</span><input v-model="password" type="password" autocomplete="current-password" /></label>
            <button class="button primary" type="submit" :disabled="loading">{{ loading ? bilingual('Signing in…', '正在登录…') : bilingual('Sign in', '登录') }}</button>
          </form>
          <p v-if="error" class="status error" style="margin-top: 12px">{{ error }}</p>
          <dl v-if="signedIn" class="kv" style="margin-top: 16px">
            <dt>{{ bilingual('User', '用户') }}</dt><dd>{{ user?.name }}</dd>
            <dt>{{ bilingual('Expires', '过期时间') }}</dt><dd>{{ new Date(expiresAt).toLocaleTimeString() }}</dd>
          </dl>
        </div>
      </section>

      <section class="panel" v-scope="{ id: 'invoices', label: bilingual('Protected invoices', '受保护发票'), description: bilingual('Records visible to the signed-in user', '当前登录用户可见的发票'), role: 'list' }">
        <div class="panel__head"><div><h2>{{ bilingual('Protected invoice queue', '受保护发票队列') }}</h2><p>{{ signedIn ? bilingual(`${invoices.length} records visible`, `可见 ${invoices.length} 条记录`) : bilingual('Sign in to request the records', '登录后才会请求记录') }}</p></div></div>
        <ul v-if="signedIn" class="records">
          <li v-for="invoice in invoices" :key="invoice.id" class="record" v-record="{ data: invoice, fields: { customer: invoice.customer, amount: invoice.amount, status: invoice.status, note: invoice.note } }">
            <div class="record__main">
              <p class="record__title">{{ invoice.customer }} <span class="record__id">{{ invoice.id }}</span></p>
              <p class="record__meta">¥{{ invoice.amount.toLocaleString() }} · {{ invoice.status }} · {{ invoice.note || bilingual('No note', '无备注') }}</p>
              <input v-model="drafts[invoice.id]" class="search" style="margin-top: 8px" :placeholder="bilingual('Write a follow-up note', '填写跟进备注')" />
            </div>
            <div class="record__actions">
              <button type="button" :disabled="!drafts[invoice.id]?.trim()" @click="saveDraft(invoice)">{{ bilingual('Save note', '保存备注') }}</button>
            </div>
          </li>
        </ul>
        <p v-else class="notice">{{ bilingual('No protected data is rendered or declared while signed out. Use the account above to create a session.', '未登录时页面不渲染也不声明任何受保护数据。使用左侧账号建立会话。') }}</p>
      </section>
    </div>

    <AgentDock
      :title="bilingual('Invoice assistant', '发票助手')"
      :quick="zh ? ['查看当前发票', '给 INV-2041 添加备注：周五前回电', '刷新发票列表'] : ['Show the current invoices', 'Add a note to INV-2041: call back by Friday', 'Refresh the invoice list']"
      :debug="{ maxCalls: 8 }"
      :model-settings="{ mode: 'byok', persist: 'session' }"
    />
  </RecipeShell>
</template>
