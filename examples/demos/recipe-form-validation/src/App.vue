<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface CreatedInvoice { id: string; customer: string; email: string; amount: number; dueDate: string }

const zh = resolveLocale() === "zh";
const customer = ref("");
const email = ref("");
const amount = ref("");
const dueDate = ref("");
const submitting = ref(false);
const fieldErrors = ref<Record<string, string>>({});
const serverError = ref("");
const lastInvoice = ref<CreatedInvoice | null>(null);
let sequence = 2042;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const errors = computed(() => {
  const next: Record<string, string> = {};
  if (customer.value.trim().length < 2) next.customer = bilingual("Enter at least two characters.", "至少输入两个字符。");
  if (!emailPattern.test(email.value.trim())) next.email = bilingual("Enter a valid email address.", "请输入有效邮箱。");
  if (!Number.isFinite(Number(amount.value)) || Number(amount.value) <= 0) next.amount = bilingual("Amount must be greater than zero.", "金额必须大于零。");
  if (!dueDate.value) next.dueDate = bilingual("Choose a due date.", "请选择到期日。");
  return next;
});

function setField(name: "customer" | "email" | "amount" | "dueDate", value: string): void {
  if (name === "customer") customer.value = value;
  if (name === "email") email.value = value;
  if (name === "amount") amount.value = value;
  if (name === "dueDate") dueDate.value = value;
  fieldErrors.value = { ...fieldErrors.value, [name]: "" };
}

async function submitForm(): Promise<CreatedInvoice> {
  fieldErrors.value = Object.fromEntries(Object.entries(errors.value));
  serverError.value = "";
  if (Object.keys(errors.value).length > 0) throw new Error(bilingual("The form still has invalid fields.", "表单仍有无效字段。"));
  if (customer.value.trim().toLowerCase() === "blocked co") {
    fieldErrors.value = { customer: bilingual("This customer is blocked by the billing policy.", "该客户被账务策略阻止。") };
    throw new Error(bilingual("Billing policy rejected the customer.", "账务策略拒绝了该客户。"));
  }
  submitting.value = true;
  await new Promise((resolve) => setTimeout(resolve, 360));
  const invoice = { id: `INV-${++sequence}`, customer: customer.value.trim(), email: email.value.trim(), amount: Number(amount.value), dueDate: dueDate.value };
  lastInvoice.value = invoice;
  customer.value = "";
  email.value = "";
  amount.value = "";
  dueDate.value = "";
  submitting.value = false;
  return invoice;
}

async function submitSafely(): Promise<void> {
  try { await submitForm(); } catch (error) { serverError.value = error instanceof Error ? error.message : String(error); }
}

useAgentState("invoice_form", () => ({
  dirty: Boolean(customer.value || email.value || amount.value || dueDate.value),
  submitting: submitting.value,
  invalidFields: Object.keys(errors.value),
  lastCreated: lastInvoice.value?.id ?? null,
  serverError: serverError.value || null,
}), { description: "Invoice form status; values and secrets are not repeated in page state" });

useAgentTool({
  id: "fill_invoice_form",
  desc: bilingual("Fill the invoice form with validated business fields", "用经过校验的业务字段填写发票表单"),
  kind: "write",
  params: [
    { name: "customer", label: "Customer name", minLength: 2, maxLength: 80 },
    { name: "email", label: "Billing email", pattern: emailPattern },
    { name: "amount", label: "Amount in yuan", minLength: 1, maxLength: 12 },
    { name: "dueDate", label: "Due date, YYYY-MM-DD", pattern: /^\d{4}-\d{2}-\d{2}$/ },
  ],
  available: () => !submitting.value || bilingual("The form is already submitting", "表单正在提交"),
  run: async (args) => {
    setField("customer", String(args.customer));
    setField("email", String(args.email));
    setField("amount", String(args.amount));
    setField("dueDate", String(args.dueDate));
    return { filled: true, valid: Object.keys(errors.value).length === 0 };
  },
});

useAgentTool({
  id: "submit_invoice",
  desc: bilingual("Submit the invoice form; field validation remains in the application", "提交发票表单；字段校验仍由应用完成"),
  kind: "write",
  available: () => !submitting.value || bilingual("The form is already submitting", "表单正在提交"),
  run: submitForm,
  expect: { desc: bilingual("A new invoice id is visible", "页面出现新发票编号"), check: () => lastInvoice.value !== null },
});
</script>

<template>
  <RecipeShell eyebrow="Recipe 03 · Forms" :title="bilingual('The model may fill the form; the application still decides whether it is valid', '模型可以填表，但是否有效仍由应用决定')" :description="bilingual('Errors survive at both layers: parameter checks reject malformed input, and a business rule rejects a blocked customer before a receipt is created.', '错误保留在两层：参数检查拒绝畸形输入，业务规则在生成回执前拒绝被阻止的客户。')">
    <div class="grid">
      <section class="panel">
        <div class="panel__head"><div><h2>{{ bilingual('Create invoice', '创建发票') }}</h2><p>{{ bilingual('Try “Blocked Co” to see a server-side policy failure.', '可用 “Blocked Co” 观察服务端策略失败。') }}</p></div></div>
        <div class="body">
          <form class="form" @submit.prevent="submitSafely">
            <label class="field"><span>{{ bilingual('Customer', '客户') }}</span><input v-model="customer" v-tool="{ id: 'invoice_customer', action: 'fill', desc: bilingual('Customer name for the invoice', '发票客户名称') }" :aria-invalid="Boolean(fieldErrors.customer)" /><small v-if="fieldErrors.customer" class="status error">{{ fieldErrors.customer }}</small></label>
            <label class="field"><span>{{ bilingual('Billing email', '账务邮箱') }}</span><input v-model="email" type="email" /><small v-if="fieldErrors.email" class="status error">{{ fieldErrors.email }}</small></label>
            <label class="field"><span>{{ bilingual('Amount', '金额') }}</span><input v-model="amount" inputmode="decimal" /><small v-if="fieldErrors.amount" class="status error">{{ fieldErrors.amount }}</small></label>
            <label class="field"><span>{{ bilingual('Due date', '到期日') }}</span><input v-model="dueDate" type="date" /><small v-if="fieldErrors.dueDate" class="status error">{{ fieldErrors.dueDate }}</small></label>
            <div class="form__footer"><span class="status" :class="{ error: serverError }">{{ serverError || (submitting ? bilingual('Submitting…', '提交中…') : '') }}</span><button class="button primary" type="submit" :disabled="submitting">{{ bilingual('Create invoice', '创建发票') }}</button></div>
          </form>
        </div>
      </section>
      <section class="panel">
        <div class="panel__head"><div><h2>{{ bilingual('Last accepted result', '最近一次受理结果') }}</h2><p>{{ lastInvoice ? bilingual('The form cleared only after the result was created.', '结果生成后表单才清空。') : bilingual('No invoice has been accepted yet.', '尚未受理发票。') }}</p></div></div>
        <div class="body">
          <dl v-if="lastInvoice" class="kv"><dt>{{ bilingual('Invoice', '发票') }}</dt><dd>{{ lastInvoice.id }}</dd><dt>{{ bilingual('Customer', '客户') }}</dt><dd>{{ lastInvoice.customer }}</dd><dt>{{ bilingual('Amount', '金额') }}</dt><dd>¥{{ lastInvoice.amount.toLocaleString() }}</dd><dt>{{ bilingual('Due', '到期') }}</dt><dd>{{ lastInvoice.dueDate }}</dd></dl>
          <pre v-else class="code-box">{{ bilingual('The receipt appears here after a valid submit.', '有效提交后，回执会出现在这里。') }}</pre>
        </div>
      </section>
    </div>
    <AgentDock :title="bilingual('Invoice assistant', '发票助手')" :quick="zh ? ['创建一张 Northwind 的 4800 元发票，月底到期', '尝试用 Blocked Co 创建发票'] : ['Create a ¥4,800 invoice for Northwind due at month end', 'Try to create an invoice for Blocked Co']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
