<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { copyFor, type DemoLocale } from "../copy";
import type { AccountStore } from "../store";

const props = defineProps<{
  store: AccountStore;
  locale: DemoLocale;
}>();

const router = useRouter();
const copy = computed(() => copyFor(props.locale));

function back(): void {
  void router.push({ name: "accounts", query: props.locale === "zh" ? { lang: "zh" } : {} });
}
</script>

<template>
  <section class="activity" v-scope="{ id: 'activity_log', label: copy.activityTitle, description: copy.activityLead, role: 'page' }">
    <header>
      <p class="eyebrow">{{ copy.activityEyebrow }}</p>
      <h1>{{ copy.activityTitle }}</h1>
      <p class="lead">{{ copy.activityLead }}</p>
    </header>

    <button type="button" class="back" v-tool="{ id: 'activity_back_to_accounts', kind: 'read', desc: copy.activityBackDesc }" @click="back">← {{ copy.activityBack }}</button>

    <ol v-if="store.activities.value.length > 0" class="timeline">
      <li v-for="item in store.activities.value" :key="item.id" v-record="{ data: item, label: item.at, fields: { at: item.at, event: item.text } }">
        <time>{{ item.at }}</time>
        <span>{{ item.text }}</span>
      </li>
    </ol>
    <p v-else class="empty">{{ copy.activityEmpty }}</p>
  </section>
</template>

<style scoped>
.activity {
  padding: 22px;
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 44px rgb(15 23 42 / 7%);
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
}
.lead {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
}
.back {
  margin: 18px 0;
  padding: 0;
  border: 0;
  background: none;
  color: #0b6db7;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.timeline {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.timeline li {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  background: #fbfdff;
}
time {
  color: #64748b;
  font-size: 12px;
}
.timeline span {
  color: #1e293b;
  font-size: 13px;
}
.empty {
  color: #94a3b8;
  text-align: center;
}
@media (max-width: 640px) {
  .timeline li {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
