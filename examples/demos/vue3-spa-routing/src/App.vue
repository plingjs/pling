<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { AgentDock } from "@plingjs/vue";
import type { DemoLocale } from "./copy";
import { copyFor } from "./copy";
import type { AccountStore } from "./store";

const props = defineProps<{
  locale: DemoLocale;
  store: AccountStore;
}>();

const copy = computed(() => copyFor(props.locale));
const route = useRoute();
</script>

<template>
  <div class="workspace">
    <header class="topbar">
      <RouterLink class="brand" :to="{ name: 'accounts' }">
        <span class="brand__mark">π</span>
        <span>{{ copy.brand }}</span>
      </RouterLink>
      <nav class="nav" aria-label="Workspace">
        <RouterLink :class="{ 'is-active': route.name === 'accounts' || route.name === 'account-detail' }" :to="{ name: 'accounts' }">
          {{ copy.navList }}
        </RouterLink>
        <RouterLink :class="{ 'is-active': route.name === 'activity' }" :to="{ name: 'activity' }">
          {{ copy.navActivity }}
        </RouterLink>
      </nav>
      <span class="nav__count">{{ copy.open(props.store.openCount.value, props.store.accounts.value.length) }}</span>
    </header>

    <main class="main">
      <RouterView v-slot="{ Component }">
        <component :is="Component" :store="props.store" :locale="props.locale" />
      </RouterView>
    </main>

    <AgentDock
      class="app-sidebar"
      layout="sidebar"
      side="right"
      :title="copy.dockTitle"
      :placeholder="copy.dockPlaceholder"
      :quick="copy.quick"
      default-open
    />
  </div>
</template>

<style scoped>
.workspace {
  --demo-sidebar-width: min(400px, 44vw);
  max-width: 1180px;
  min-height: 100vh;
  margin: 0 auto;
  padding-right: calc(var(--demo-sidebar-width) + 24px);
}
.topbar {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 12px 0 16px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 720;
  text-decoration: none;
}
.brand__mark {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 9px;
  background: #1273cf;
  color: #fff;
  font-size: 17px;
}
.nav {
  display: inline-flex;
  gap: 4px;
}
.nav a {
  padding: 6px 10px;
  border-radius: 8px;
  color: #64748b;
  font-size: 13px;
  text-decoration: none;
}
.nav a.is-active {
  background: #eaf6ff;
  color: #0b6db7;
  font-weight: 650;
}
.nav__count {
  margin-left: auto;
  color: #64748b;
  font-size: 12px;
}
.main {
  padding-bottom: 48px;
}
.app-sidebar {
  --pling-sidebar-width: var(--demo-sidebar-width);
}
@media (max-width: 820px) {
  .workspace {
    padding-right: 0;
  }
  .nav__count {
    display: none;
  }
}
</style>
