<script setup lang="ts">
import { computed } from "vue";
import type { ExternalApprovalRequest } from "../surface/approval";

const props = defineProps<{ request: ExternalApprovalRequest | null }>();
defineEmits<{ decide: [approved: boolean] }>();

const deadline = computed(() =>
  props.request ? new Date(props.request.expiresAt).toLocaleTimeString(undefined, { hour12: false }) : "",
);
const args = computed(() =>
  props.request && Object.keys(props.request.args).length ? JSON.stringify(props.request.args, null, 2) : "",
);
</script>

<template>
  <aside v-if="request" class="approval" role="alertdialog" aria-modal="true" data-testid="external-approval">
    <div class="approval__head">
      <span class="approval__mark" aria-hidden="true">!</span>
      <div>
        <p class="approval__eyebrow">External Agent · human approval</p>
        <h2>{{ request.description }}</h2>
      </div>
    </div>
    <code class="approval__action">{{ request.id }}</code>
    <pre v-if="args">{{ args }}</pre>
    <p class="approval__note">
      The Agent is waiting and cannot approve its own request. Deny or allow this one operation here. Expires at
      {{ deadline }}.
    </p>
    <div class="approval__actions">
      <button type="button" data-testid="external-deny" @click="$emit('decide', false)">Deny</button>
      <button type="button" class="primary" data-testid="external-allow" @click="$emit('decide', true)">
        Allow once
      </button>
    </div>
  </aside>
</template>

<style scoped>
.approval {
  position: fixed;
  top: 84px;
  right: 24px;
  z-index: 80;
  width: min(410px, calc(100vw - 32px));
  padding: 17px;
  border: 1px solid #fbbf24;
  border-radius: 15px;
  background: #fffbeb;
  box-shadow: 0 20px 60px rgb(15 23 42 / 22%);
}
.approval__head {
  display: flex;
  gap: 11px;
  align-items: flex-start;
}
.approval__mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f59e0b;
  color: #fff;
  font-weight: 800;
}
.approval__eyebrow {
  margin: 0 0 4px;
  color: #92400e;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h2 {
  margin: 0;
  color: #1c1917;
  font-size: 15px;
  line-height: 1.45;
}
.approval__action {
  display: inline-block;
  margin-top: 10px;
  padding: 3px 7px;
  border-radius: 6px;
  background: #fef3c7;
  color: #92400e;
  font-size: 11px;
  word-break: break-all;
}
pre {
  max-height: 130px;
  overflow: auto;
  margin: 10px 0;
  padding: 9px;
  border-radius: 8px;
  background: #fef3c7;
  color: #57534e;
  font-size: 11px;
}
.approval__note {
  margin: 10px 0 14px;
  color: #78716c;
  font-size: 11px;
  line-height: 1.55;
}
.approval__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
button {
  padding: 7px 12px;
  border: 1px solid #d6d3d1;
  border-radius: 8px;
  background: #fff;
  color: #44403c;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
button.primary {
  border-color: #b45309;
  background: #b45309;
  color: #fff;
}
@media (max-width: 640px) {
  .approval {
    top: auto;
    right: 12px;
    bottom: 12px;
  }
}
</style>
