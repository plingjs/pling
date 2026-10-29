<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AgentConfig } from "@plingjs/agent";
import { usePling } from "../directive";
import {
  validateUserModelSettings,
  type ModelSettingsPersistence,
  type UserModelSettings,
} from "../model-settings";

const props = defineProps<{
  mode: "readonly" | "byok";
  persist: ModelSettingsPersistence;
  config: AgentConfig;
  user?: UserModelSettings | null;
  running?: boolean;
}>();

const emit = defineEmits<{ save: [settings: UserModelSettings]; reset: [] }>();

const pi = usePling();
const t = pi.ui.t;

const baseUrl = ref("");
const modelName = ref("");
const apiKey = ref("");
const error = ref<"base_url" | "model" | "api_key" | null>(null);

function seed(): void {
  baseUrl.value = props.user?.baseUrl || props.config.baseUrl;
  modelName.value = props.user?.model || props.config.model;
  apiKey.value = props.user?.apiKey || "";
  error.value = null;
}

watch([() => props.config, () => props.user], seed, { immediate: true });

const canInheritKey = computed(() => {
  const source = props.user ?? props.config;
  return source.baseUrl.trim() === baseUrl.value.trim() && Boolean(source.apiKey);
});

const keyConfigured = computed(() => Boolean(apiKey.value.trim()) || canInheritKey.value);

const storageHint = computed(() =>
  props.persist === "session" ? t("modelSettings.storage.session") : t("modelSettings.storage.memory"),
);

const errorText = computed(() => {
  if (!error.value) return "";
  if (error.value === "base_url") return t("modelSettings.error.baseUrl");
  if (error.value === "model") return t("modelSettings.error.model");
  return t("modelSettings.error.apiKey");
});

function submit(): void {
  if (props.running) return;
  const source = props.user ?? props.config;
  const next: UserModelSettings = {
    baseUrl: baseUrl.value.trim(),
    model: modelName.value.trim(),
    apiKey: apiKey.value.trim() || (canInheritKey.value ? source.apiKey.trim() : ""),
  };
  error.value = validateUserModelSettings(next);
  if (error.value) return;
  emit("save", next);
}

function reset(): void {
  if (props.running) return;
  emit("reset");
}
</script>

<template>
  <section class="model-settings" data-testid="pling-model-settings">
    <header class="model-settings__head">
      <h3>{{ t("modelSettings.title") }}</h3>
      <span>{{ mode === "readonly" ? t("modelSettings.readonly") : t("modelSettings.byok") }}</span>
    </header>

    <template v-if="mode === 'readonly'">
      <p class="model-settings__note">{{ t("modelSettings.readonlyHint") }}</p>
      <dl class="model-settings__facts">
        <dt>{{ t("modelSettings.baseUrl") }}</dt>
        <dd><code>{{ config.baseUrl || t("dock.model.unconfigured") }}</code></dd>
        <dt>{{ t("modelSettings.model") }}</dt>
        <dd><code>{{ config.model || t("dock.model.unconfigured") }}</code></dd>
        <dt>{{ t("modelSettings.apiKey") }}</dt>
        <dd>{{ t("modelSettings.managed") }}</dd>
      </dl>
    </template>

    <form v-else class="model-settings__form" @submit.prevent="submit">
      <label>
        <span>{{ t("modelSettings.baseUrl") }}</span>
        <input
          v-model="baseUrl"
          data-testid="pling-model-base-url"
          type="text"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://provider.example.com/v1"
          :disabled="running"
          @input="error = null"
        />
      </label>

      <label>
        <span>{{ t("modelSettings.model") }}</span>
        <input
          v-model="modelName"
          data-testid="pling-model-name"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="model-name"
          :disabled="running"
          @input="error = null"
        />
      </label>

      <label>
        <span>{{ t("modelSettings.apiKey") }}</span>
        <input
          v-model="apiKey"
          data-testid="pling-model-api-key"
          type="password"
          autocomplete="new-password"
          spellcheck="false"
          :placeholder="keyConfigured ? t('modelSettings.apiKeyConfigured') : 'sk-…'"
          :disabled="running"
          @input="error = null"
        />
      </label>

      <p v-if="errorText" class="model-settings__error" role="alert">{{ errorText }}</p>
      <p v-if="running" class="model-settings__error">{{ t("modelSettings.running") }}</p>

      <div class="model-settings__actions">
        <button type="submit" class="model-settings__save" :disabled="running">
          {{ t("modelSettings.save") }}
        </button>
        <button type="button" class="model-settings__reset" :disabled="running" @click="reset">
          {{ t("modelSettings.reset") }}
        </button>
      </div>

      <p class="model-settings__note">{{ t("modelSettings.securityHint") }}</p>
      <p class="model-settings__note">{{ storageHint }}</p>
    </form>
  </section>
</template>

<style>
.model-settings {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 10px;
  padding: 6px 4px 12px;
}
.model-settings__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.model-settings__head h3 {
  margin: 0;
  color: var(--pling-color-text, #0f172a);
  font-size: 13px;
}
.model-settings__head span {
  color: var(--pling-color-text-muted, #64748b);
  font-size: 11px;
}
.model-settings__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.model-settings__form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--pling-color-text-muted, #475569);
  font-size: 12px;
}
.model-settings__form input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--pling-color-border, #cbd5e1);
  border-radius: var(--pling-radius-md, 8px);
  background: var(--pling-color-surface, #fff);
  color: var(--pling-color-text, #0f172a);
  font: inherit;
  font-size: 12px;
}
.model-settings__form input:focus {
  border-color: var(--pling-color-primary, #2e9df7);
  outline: 2px solid var(--pling-color-primary-soft, #eaf6ff);
}
.model-settings__form input:disabled {
  opacity: 0.65;
}
.model-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
}
.model-settings__actions button {
  padding: 7px 11px;
  border-radius: 999px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.model-settings__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.model-settings__save {
  border: 1px solid var(--pling-color-primary, #2e9df7);
  background: var(--pling-color-primary, #2e9df7);
  color: var(--pling-color-on-primary, #fff);
}
.model-settings__reset {
  border: 1px solid var(--pling-color-border, #cbd5e1);
  background: transparent;
  color: var(--pling-color-text-muted, #475569);
}
.model-settings__note,
.model-settings__error {
  margin: 0;
  color: var(--pling-color-text-muted, #64748b);
  font-size: 11px;
  line-height: 1.5;
}
.model-settings__error {
  color: var(--pling-color-danger, #b91c1c);
}
.model-settings__facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 12px;
  margin: 0;
  font-size: 12px;
}
.model-settings__facts dt {
  color: var(--pling-color-text-muted, #64748b);
}
.model-settings__facts dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.model-settings__facts code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}
</style>
