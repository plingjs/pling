<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type { ToolOptions } from "@plingjs/vue";
import type { DemoLocale } from "../copy";

const props = defineProps<{ locale: DemoLocale }>();

const copy = computed(() =>
  props.locale === "zh"
    ? {
        eyebrow: "发布检查",
        heading: "工作区设置",
        lead: "页面错误和人工步骤都应当被明确说明，而不是藏在红字与按钮后面。",
        nameLabel: "工作区名称",
        namePlaceholder: "例如：产品运营",
        nameDesc: "填写工作区名称。名称不能只包含空格。",
        saveLabel: "保存名称",
        saveDesc: "保存当前工作区名称；名称为空时页面会给出可读反馈。",
        saveExpect: "工作区名称已经保存",
        codeLabel: "发布验证码",
        codeHint: "验证码 246810 仅用于演示。这个输入框只由人填写。",
        codePlaceholder: "输入 6 位验证码",
        publishLabel: "发布变更",
        publishDesc: "发布工作区变更。需要本人输入验证码并确认。",
        publishReason: "发布前需要本人确认验证码。",
        publishStepOne: "在验证码输入框中填写 246810。",
        publishStepTwo: "点击“发布变更”完成确认。",
        publishExpect: "工作区变更已经发布",
        errorEmpty: "请先填写工作区名称，名称不能只包含空格。",
        errorCode: "验证码不正确，请检查后重试。",
        saved: (name: string) => `已保存“${name}”。`,
        published: "变更已发布。",
        regionLabel: "工作区发布",
        regionDescription: "保存工作区名称，并由本人输入验证码完成发布。",
        feedbackScope: "发布说明",
      }
    : {
        eyebrow: "Release check",
        heading: "Workspace settings",
        lead: "Page errors and human steps should be explicit, not hidden in red text or button behavior.",
        nameLabel: "Workspace name",
        namePlaceholder: "For example: Product operations",
        nameDesc: "Enter the workspace name. It cannot contain only spaces.",
        saveLabel: "Save name",
        saveDesc: "Save the current workspace name. An empty name produces readable page feedback.",
        saveExpect: "The workspace name is saved",
        codeLabel: "Release verification code",
        codeHint: "The code 246810 is for this demo only. This input is completed only by a person.",
        codePlaceholder: "Enter the 6-digit code",
        publishLabel: "Publish changes",
        publishDesc: "Publish workspace changes. The user must enter a verification code and confirm.",
        publishReason: "The user must confirm the verification code before publishing.",
        publishStepOne: "Enter 246810 in the verification-code field.",
        publishStepTwo: "Select “Publish changes” to complete the confirmation.",
        publishExpect: "The workspace changes are published",
        errorEmpty: "Enter a workspace name. It cannot contain only spaces.",
        errorCode: "The verification code is incorrect. Check it and try again.",
        saved: (name: string) => `Saved “${name}”.`,
        published: "Changes published.",
        regionLabel: "Workspace release",
        regionDescription: "Save the workspace name and let the user enter a code before publishing.",
        feedbackScope: "Release status",
      },
);

const name = ref("");
const code = ref("");
const status = ref<"idle" | "error" | "saved" | "published">("idle");
const feedbackText = ref("");
const feedbackField = ref<string | undefined>();
const published = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
const codeInput = ref<HTMLInputElement | null>(null);
let lastSavedName = "";

const statusLabel = computed(() => {
  if (props.locale === "zh") {
    return { idle: "等待操作", error: "需要修正", saved: "已保存", published: "已发布" }[status.value];
  }
  return { idle: "Ready", error: "Needs attention", saved: "Saved", published: "Published" }[status.value];
});

const feedback = computed(() =>
  feedbackText.value
    ? {
        id: "release_feedback",
        message: feedbackText.value,
        ...(feedbackField.value ? { field: feedbackField.value } : {}),
        severity: "error" as const,
        scope: "release_check",
      }
    : null,
);

function showError(message: string, field: string): void {
  feedbackText.value = message;
  feedbackField.value = field;
  status.value = "error";
  published.value = false;
  void nextTick(() => {
    (field === "workspace_name" ? nameInput.value : codeInput.value)?.focus();
  });
}

function saveName(): void {
  const value = name.value.trim();
  if (!value) {
    showError(copy.value.errorEmpty, "workspace_name");
    return;
  }
  lastSavedName = value;
  feedbackText.value = "";
  feedbackField.value = undefined;
  status.value = "saved";
}

function publishChanges(): void {
  if (code.value.trim() !== "246810") {
    showError(copy.value.errorCode, "verification_code");
    return;
  }
  feedbackText.value = "";
  feedbackField.value = undefined;
  status.value = "published";
  published.value = true;
}

const saveAction = computed<ToolOptions>(() => ({
  id: "save_workspace_name",
  desc: copy.value.saveDesc,
  kind: "write",
  run: saveName,
  expect: {
    desc: copy.value.saveExpect,
    check: () => name.value.trim().length > 0 && lastSavedName === name.value.trim(),
  },
}));

const publishAction = computed<ToolOptions>(() => ({
  id: "publish_changes",
  desc: copy.value.publishDesc,
  kind: "danger",
  handoff: {
    reason: copy.value.publishReason,
    steps: [
      { text: copy.value.publishStepOne, highlight: "verification_code" },
      { text: copy.value.publishStepTwo, highlight: "publish_changes" },
    ],
    expect: {
      desc: copy.value.publishExpect,
      check: () => published.value,
    },
  },
}));

</script>

<template>
  <section
    class="release"
    v-scope="{
      id: 'release_check',
      label: copy.regionLabel,
      description: copy.regionDescription,
      role: 'form',
    }"
  >
    <header class="release__head">
      <div>
        <p class="release__eyebrow">{{ copy.eyebrow }}</p>
        <h2>{{ copy.heading }}</h2>
        <p>{{ copy.lead }}</p>
      </div>
      <span class="release__status" :data-status="status">{{ statusLabel }}</span>
    </header>

    <div class="release__grid">
      <label class="release__field">
        <span>{{ copy.nameLabel }}</span>
        <input
          ref="nameInput"
          v-model="name"
          data-pling-field="workspace_name"
          :aria-describedby="feedbackField === 'workspace_name' ? 'release-status' : undefined"
          :placeholder="copy.namePlaceholder"
          v-tool="{ id: 'workspace_name', action: 'fill', desc: copy.nameDesc }"
        />
      </label>
      <button type="button" class="release__secondary" v-tool="saveAction" @click="saveName">
        {{ copy.saveLabel }}
      </button>
    </div>

    <div class="release__grid">
      <label class="release__field">
        <span>{{ copy.codeLabel }}</span>
        <input
          ref="codeInput"
          v-model="code"
          data-pling-field="verification_code"
          :aria-describedby="feedbackField === 'verification_code' ? 'release-status' : undefined"
          :placeholder="copy.codePlaceholder"
          autocomplete="off"
          v-guide-target="'verification_code'"
        />
        <small>{{ copy.codeHint }}</small>
      </label>
      <button
        type="button"
        class="release__primary"
        data-publish
        v-tool="publishAction"
        @click="publishChanges"
      >
        {{ copy.publishLabel }}
      </button>
    </div>

    <p id="release-status" v-feedback="feedback" class="release__feedback">
      <span v-if="feedback">{{ feedback.message }}</span>
      <span v-else-if="status === 'saved'">{{ copy.saved(name.trim()) }}</span>
      <span v-else-if="status === 'published'">{{ copy.published }}</span>
    </p>

  </section>
</template>
