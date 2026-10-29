<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Approver { id: string; name: string; role: string }

const zh = resolveLocale() === "zh";
const step = ref(0);
const company = ref("");
const industry = ref("");
const industries = ref<string[]>([]);
const loadingIndustries = ref(true);
const contact = ref("");
const email = ref("");
const approvers = ref<Approver[]>([
  { id: "a1", name: "Rui Wang", role: "Finance" },
  { id: "a2", name: "Mina Zhou", role: "Procurement" },
  { id: "a3", name: "Leo Park", role: "Security" },
]);
const message = ref("");
const submitted = ref(false);

const stepErrors = computed(() => {
  if (step.value === 0) {
    if (company.value.trim().length < 2) return bilingual("Enter the legal company name.", "请输入公司法定名称。");
    if (!industry.value) return bilingual("Choose an industry after the options load.", "选项加载后请选择行业。");
  }
  if (step.value === 1) {
    if (!contact.value.trim()) return bilingual("Enter a contact name.", "请输入联系人。");
    if (!/^\S+@\S+\.\S+$/.test(email.value)) return bilingual("Enter a valid contact email.", "请输入有效联系邮箱。");
  }
  return "";
});

function next(): void {
  if (stepErrors.value) throw new Error(stepErrors.value);
  step.value = Math.min(2, step.value + 1);
  submitted.value = false;
}
function back(): void { step.value = Math.max(0, step.value - 1); }
function move(index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= approvers.value.length) return;
  const nextList = [...approvers.value];
  const [item] = nextList.splice(index, 1);
  if (item) nextList.splice(target, 0, item);
  approvers.value = nextList;
}
function submit(): void { submitted.value = true; message.value = bilingual("Application sent for approval.", "申请已提交审批。"); }

useAgentState("wizard_view", () => ({
  step: step.value,
  industriesLoaded: !loadingIndustries.value,
  companyFilled: Boolean(company.value),
  industry: industry.value || null,
  contactFilled: Boolean(contact.value),
  approvers: approvers.value.map((item) => `${item.role}:${item.name}`),
  submitted: submitted.value,
}), { description: "Current wizard step, available choices, approver order, and submit state" });

useAgentTool({
  id: "wizard_fill_company",
  desc: bilingual("Fill the supplier company details on step one", "在第一步填写供应商公司信息"),
  kind: "write",
  params: [{ name: "company", label: "Company name", minLength: 2 }, { name: "industry", label: "Industry label" }],
  available: () => step.value === 0 || bilingual("Return to the company step first", "请先回到公司信息步骤"),
  run: async (args) => {
    company.value = String(args.company);
    industry.value = String(args.industry);
    return { filled: true };
  },
});

useAgentTool({
  id: "wizard_advance",
  desc: bilingual("Advance the supplier wizard after the current step is valid", "当前步骤有效后推进供应商向导"),
  kind: "write",
  available: () => !submitted.value || bilingual("The application was already submitted", "申请已经提交"),
  run: next,
});

onMounted(() => {
  setTimeout(() => {
    industries.value = ["Logistics", "Manufacturing", "Software", "Professional services"];
    loadingIndustries.value = false;
  }, 650);
});
</script>

<template>
  <RecipeShell eyebrow="Recipe 04 · Multi-step flow" :title="bilingual('Each step declares only the capabilities that exist now', '每一步只声明此刻真实存在的能力')" :description="bilingual('The wizard changes from company details to contact details to review. Earlier controls and actions disappear rather than staying available behind a hidden panel.', '向导从公司信息切到联系人再到复核。旧控件与动作会消失，而不是藏在不可见面板里继续可调用。')">
    <section class="panel">
      <div class="panel__head"><div><h2>{{ bilingual('Supplier onboarding', '供应商入驻') }}</h2><p>{{ stepErrors || bilingual('The current step is valid.', '当前步骤有效。') }}</p></div><span class="tag" :class="submitted ? 'ok' : ''">{{ submitted ? bilingual('Submitted', '已提交') : `Step ${step + 1}` }}</span></div>
      <div class="body">
        <ol class="steps"><li :class="{ 'is-active': step === 0, 'is-done': step > 0 }">01 · {{ bilingual('Company', '公司') }}</li><li :class="{ 'is-active': step === 1, 'is-done': step > 1 }">02 · {{ bilingual('Contact', '联系人') }}</li><li :class="{ 'is-active': step === 2 }">03 · {{ bilingual('Review', '复核') }}</li></ol>

        <div v-if="step === 0" class="form">
          <label class="field"><span>{{ bilingual('Legal company name', '公司法定名称') }}</span><input v-model="company" v-tool="{ id: 'wizard_company', action: 'fill', desc: bilingual('Supplier legal company name', '供应商公司法定名称') }" /></label>
          <label class="field"><span>{{ bilingual('Industry', '行业') }}</span><select v-model="industry" :disabled="loadingIndustries"><option value="">{{ loadingIndustries ? bilingual('Loading options…', '选项加载中…') : bilingual('Choose an industry', '请选择行业') }}</option><option v-for="item in industries" :key="item" :value="item">{{ item }}</option></select></label>
        </div>
        <div v-else-if="step === 1" class="form">
          <label class="field"><span>{{ bilingual('Contact name', '联系人') }}</span><input v-model="contact" /></label>
          <label class="field"><span>{{ bilingual('Contact email', '联系邮箱') }}</span><input v-model="email" type="email" /></label>
        </div>
        <div v-else class="split">
          <div class="form">
            <dl class="kv"><dt>{{ bilingual('Company', '公司') }}</dt><dd>{{ company }}</dd><dt>{{ bilingual('Industry', '行业') }}</dt><dd>{{ industry }}</dd><dt>{{ bilingual('Contact', '联系人') }}</dt><dd>{{ contact }} · {{ email }}</dd></dl>
          </div>
          <div>
            <p class="label" style="margin: 0 0 8px">{{ bilingual('Approval chain', '审批链') }}</p>
            <ul class="records" style="padding: 0; max-height: none" v-scope="{ id: 'approvals', label: bilingual('Approval chain', '审批链'), role: 'list' }">
              <li v-for="(person, index) in approvers" :key="person.id" class="record" v-record="{ data: person, fields: { role: person.role } }"><div class="record__main"><p class="record__title">{{ index + 1 }}. {{ person.name }}</p><p class="record__meta">{{ person.role }}</p></div><div class="record__actions"><button type="button" :disabled="index === 0" @click="move(index, -1)">↑</button><button type="button" :disabled="index === approvers.length - 1" @click="move(index, 1)">↓</button></div></li>
            </ul>
          </div>
        </div>

        <div class="form__footer" style="margin-top: 16px">
          <span class="status">{{ message }}</span>
          <span style="display: flex; gap: 8px"><button class="button" type="button" :disabled="step === 0" @click="back">{{ bilingual('Back', '上一步') }}</button><button v-if="step < 2" class="button primary" type="button" @click="next">{{ bilingual('Continue', '继续') }}</button><button v-else class="button primary" type="button" :disabled="submitted" @click="submit">{{ bilingual('Submit for review', '提交审核') }}</button></span>
        </div>
      </div>
    </section>
    <AgentDock :title="bilingual('Onboarding assistant', '入驻助手')" :quick="zh ? ['帮我完成供应商入驻', '把财务审批放到第一位'] : ['Complete the supplier onboarding for me', 'Put Finance first in the approval chain']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
