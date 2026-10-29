<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAgentState } from "@plingjs/vue";
import { copyFor, riskLabel, statusLabel, type DemoLocale, type RiskFilter } from "../copy";
import type { AccountStore } from "../store";

const props = defineProps<{
  store: AccountStore;
  locale: DemoLocale;
}>();

const router = useRouter();
const copy = computed(() => copyFor(props.locale));
const search = ref("");
const risk = ref<RiskFilter>("all");
const visible = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase();
  return props.store.accounts.value.filter((account) => {
    const matchesRisk = risk.value === "all" || account.risk === risk.value;
    const matchesSearch =
      !needle ||
      [account.name, account.owner, account.segment, account.note].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      );
    return matchesRisk && matchesSearch;
  });
});

useAgentState(
  "account_list_view",
  () => ({
    risk: risk.value,
    search: search.value,
    matched: visible.value.length,
    total: props.store.accounts.value.length,
    open: props.store.openCount.value,
    highRisk: props.store.highRiskCount.value,
  }),
  { description: copy.value.stateDescription },
);

function setRisk(value: RiskFilter): void {
  risk.value = value;
}

function reset(): void {
  risk.value = "all";
  search.value = "";
}

function open(accountId: string): void {
  void router.push({
    name: "account-detail",
    params: { id: accountId },
    query: props.locale === "zh" ? { lang: "zh" } : {},
  });
}
</script>

<template>
  <section class="panel" aria-labelledby="accounts-title">
    <header class="panel__head">
      <div>
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h1 id="accounts-title">{{ copy.title }}</h1>
        <p class="lead">{{ copy.lead }}</p>
      </div>
      <span class="badge">{{ copy.shown(visible.length, store.accounts.value.length) }}</span>
    </header>

    <label class="search">
      <span>{{ copy.searchLabel }}</span>
      <input
        id="account-search"
        v-model="search"
        type="search"
        :placeholder="copy.searchPlaceholder"
        v-tool="{ id: 'search_accounts', action: 'fill', desc: copy.searchPlaceholder }"
      />
    </label>

    <div class="filters" role="group" :aria-label="copy.filters">
      <button type="button" :class="{ 'is-active': risk === 'all' }" v-tool="{ id: 'filter_accounts_all', kind: 'read', desc: copy.all }" @click="setRisk('all')">{{ copy.all }}</button>
      <button type="button" :class="{ 'is-active': risk === 'high' }" v-tool="{ id: 'filter_accounts_high', kind: 'read', desc: copy.high }" @click="setRisk('high')">{{ copy.high }}</button>
      <button type="button" :class="{ 'is-active': risk === 'medium' }" v-tool="{ id: 'filter_accounts_medium', kind: 'read', desc: copy.medium }" @click="setRisk('medium')">{{ copy.medium }}</button>
      <button type="button" :class="{ 'is-active': risk === 'low' }" v-tool="{ id: 'filter_accounts_low', kind: 'read', desc: copy.low }" @click="setRisk('low')">{{ copy.low }}</button>
      <button type="button" class="filters__reset" :disabled="risk === 'all' && search.trim() === ''" v-tool="{ id: 'reset_account_filters', kind: 'read', desc: copy.reset }" @click="reset">{{ copy.reset }}</button>
    </div>

    <div
      class="account-list"
      v-scope="{ id: 'account_list', label: copy.navList, description: copy.lead, role: 'list' }"
    >
      <article
        v-for="account in visible"
        :key="account.id"
        class="account"
        :class="[`risk-${account.risk}`, `status-${account.status}`]"
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
        <div class="account__identity">
          <div>
            <strong>{{ account.name }}</strong>
            <span>{{ account.segment }} · {{ account.owner }}</span>
          </div>
          <span class="pill">{{ riskLabel(locale, account.risk) }}</span>
          <span class="pill pill--status">{{ statusLabel(locale, account.status) }}</span>
        </div>
        <p class="account__note">{{ account.note || "—" }}</p>
        <div class="account__meta">
          <span>{{ copy.revenue }} ¥{{ account.revenue.toLocaleString("en-US") }}</span>
          <span>{{ copy.lastContact }} {{ account.lastContact }}</span>
        </div>
        <button
          type="button"
          class="account__open"
          v-tool="{ id: `open_account@${account.id}`, kind: 'read', desc: copy.openAccountDesc(account.name) }"
          @click="open(account.id)"
        >
          {{ copy.openAccount }} →
        </button>
      </article>
    </div>
    <p v-if="visible.length === 0" class="empty">{{ copy.empty }}</p>
  </section>
</template>

<style scoped>
.panel {
  padding: 22px;
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 44px rgb(15 23 42 / 7%);
}
.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.eyebrow {
  margin: 0 0 4px;
  color: #2e9df7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: 25px;
  letter-spacing: -0.025em;
}
.lead {
  max-width: 620px;
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
.badge {
  padding: 5px 9px;
  border: 1px solid #b9defb;
  border-radius: 999px;
  background: #f1f9ff;
  color: #0b6db7;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}
.search {
  display: grid;
  gap: 6px;
  margin: 20px 0 12px;
  color: #475569;
  font-size: 12px;
  font-weight: 650;
}
.search input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  color: #0f172a;
  font: inherit;
  font-size: 14px;
  font-weight: 400;
}
.search input:focus {
  border-color: #2e9df7;
  outline: 3px solid rgb(46 157 247 / 16%);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.filters button {
  padding: 5px 9px;
  border: 1px solid #dbe6f2;
  border-radius: 999px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}
.filters button.is-active {
  border-color: #a7d6fb;
  background: #eaf6ff;
  color: #0b6db7;
  font-weight: 650;
}
.filters .filters__reset {
  margin-left: auto;
  border-color: transparent;
  background: transparent;
  color: #0b6db7;
}
.filters button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}
.account-list {
  display: grid;
  gap: 9px;
}
.account {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(170px, 0.9fr) auto;
  gap: 12px 18px;
  align-items: center;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #cbd5e1;
  border-radius: 12px;
}
.account.risk-high {
  border-left-color: #f97316;
}
.account.risk-medium {
  border-left-color: #eab308;
}
.account.risk-low {
  border-left-color: #22c55e;
}
.account__identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}
.account__identity > div {
  display: grid;
  gap: 2px;
  min-width: 130px;
  margin-right: 4px;
}
.account__identity strong {
  font-size: 15px;
}
.account__identity span {
  color: #64748b;
  font-size: 12px;
}
.pill {
  padding: 3px 7px;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 11px;
}
.pill--status {
  background: #f1f5f9;
  color: #475569;
}
.account__note {
  margin: 0;
  overflow: hidden;
  color: #475569;
  font-size: 13px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: #64748b;
  font-size: 11px;
}
.account__open {
  grid-column: 3;
  grid-row: 1 / span 2;
  padding: 6px 9px;
  border: 0;
  border-radius: 8px;
  background: #f1f9ff;
  color: #0b6db7;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.account__open:hover {
  background: #e2f2ff;
}
.empty {
  margin: 18px 0 0;
  color: #94a3b8;
  text-align: center;
}
@media (max-width: 720px) {
  .panel__head {
    flex-direction: column;
  }
  .account {
    grid-template-columns: 1fr;
  }
  .account__open {
    grid-column: auto;
    grid-row: auto;
    justify-self: start;
  }
}
</style>
