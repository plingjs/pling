<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import { api, errorMessage } from "../../../recipe-shared/api";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Upload { id: string; name: string; size: number; type: string; state: "queued" | "processing" | "ready" | "failed" | "cancelled"; progress: number; error: string | null; createdAt: string }

const zh = resolveLocale() === "zh";
const uploads = ref<Upload[]>([]);
const busy = ref(false);
const error = ref("");
let timer: ReturnType<typeof setInterval> | null = null;
const activeJobs = computed(() => uploads.value.filter((job) => job.state === "queued" || job.state === "processing"));

async function refresh(): Promise<void> {
  try {
    const data = await api<{ uploads: Upload[] }>("/uploads");
    uploads.value = data.uploads;
  } catch (value) {
    error.value = errorMessage(value);
  }
}

async function choose(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  busy.value = true;
  error.value = "";
  try {
    await api<{ upload: Upload }>("/uploads", {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream", "x-file-name": file.name },
      body: await file.arrayBuffer(),
    });
    await refresh();
  } catch (value) {
    error.value = errorMessage(value);
  } finally {
    input.value = "";
    busy.value = false;
  }
}

async function cancel(id: string): Promise<void> {
  await api(`/uploads/${encodeURIComponent(id)}`, { method: "DELETE" });
  await refresh();
}

async function retry(id: string): Promise<void> {
  await api(`/uploads/${encodeURIComponent(id)}/retry`, { method: "POST" });
  await refresh();
}

function stateLabel(state: Upload["state"]): string {
  return bilingual({ queued: "Queued", processing: "Processing", ready: "Ready", failed: "Failed", cancelled: "Cancelled" }[state], { queued: "排队中", processing: "处理中", ready: "就绪", failed: "失败", cancelled: "已取消" }[state]);
}

useAgentState("upload_view", () => ({
  total: uploads.value.length,
  active: activeJobs.value.length,
  ready: uploads.value.filter((job) => job.state === "ready").length,
  failed: uploads.value.filter((job) => job.state === "failed").length,
  jobs: uploads.value.slice(0, 6).map((job) => ({ id: job.id, state: job.state, progress: job.progress })),
}), { description: "Upload job states and progress; file bytes and names are not repeated in page state" });

useAgentTool({
  id: "refresh_upload_jobs",
  desc: bilingual("Refresh upload processing states", "刷新上传处理状态"),
  kind: "read",
  run: refresh,
});

onMounted(() => {
  void refresh();
  timer = setInterval(() => { if (activeJobs.value.length > 0) void refresh(); }, 800);
});
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <RecipeShell eyebrow="Recipe 06 · Long-running work" :title="bilingual('Starting work is not the same as finishing it', '启动任务不等于任务完成')" :description="bilingual('Upload bytes, watch a server-side job advance, cancel it, and retry a failure. The page reports the job state instead of waiting forever inside one action.', '上传字节、观察服务端任务推进、取消任务，并重试失败。页面报告任务状态，而不是在一个动作里无限等待。')">
    <div class="grid">
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('Upload a document', '上传文档') }}</h2><p>{{ bilingual('Try a filename containing “virus” to exercise the failure path.', '文件名包含 “virus” 可触发失败路径。') }}</p></div></div><div class="body"><label class="upload-drop"><span><strong>{{ busy ? bilingual('Uploading…', '上传中…') : bilingual('Choose a file', '选择文件') }}</strong><br /><small>{{ bilingual('Bytes go to the local upload service; the model receives job metadata only.', '字节发送到本地上传服务；模型只收到任务元数据。') }}</small></span><input type="file" :disabled="busy" @change="choose" /></label><p v-if="error" class="status error" style="margin: 12px 0 0">{{ error }}</p></div></section>
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('Job states', '任务状态') }}</h2><p>{{ activeJobs.length }} {{ bilingual('active', '进行中') }}</p></div></div><div class="body"><div class="metric-grid"><div class="metric"><span>{{ bilingual('Total', '总数') }}</span><strong>{{ uploads.length }}</strong></div><div class="metric"><span>{{ bilingual('Ready', '就绪') }}</span><strong>{{ uploads.filter((job) => job.state === 'ready').length }}</strong></div><div class="metric"><span>{{ bilingual('Failed', '失败') }}</span><strong>{{ uploads.filter((job) => job.state === 'failed').length }}</strong></div></div></div></section>
    </div>
    <section class="panel" style="margin-top: 16px" v-scope="{ id: 'upload_jobs', label: bilingual('Upload jobs', '上传任务'), role: 'list' }">
      <div class="panel__head"><div><h2>{{ bilingual('Processing queue', '处理队列') }}</h2><p>{{ bilingual('Cancellation is allowed only while a job is active.', '只有进行中的任务可以取消。') }}</p></div></div>
      <ul v-if="uploads.length" class="records">
        <li v-for="job in uploads" :key="job.id" class="record" v-record="{ data: job, label: job.name, fields: { state: job.state, progress: job.progress, error: job.error } }">
          <div class="record__main"><p class="record__title">{{ job.name }} <span class="record__id">{{ job.id }}</span></p><p class="record__meta">{{ stateLabel(job.state) }} · {{ job.progress }}% · {{ Math.ceil(job.size / 1024) }} KB</p><div class="progress" style="margin-top: 8px"><span :style="{ width: `${job.progress}%` }" /></div><p v-if="job.error" class="status error" style="margin-top: 6px">{{ job.error }}</p></div>
          <div class="record__actions"><button v-if="job.state === 'processing' || job.state === 'queued'" type="button" v-tool="{ id: `cancel@${job.id}`, desc: bilingual(`Cancel upload job ${job.id}`, `取消上传任务 ${job.id}`), kind: 'write' }" @click="cancel(job.id)">{{ bilingual('Cancel', '取消') }}</button><button v-if="job.state === 'failed' || job.state === 'cancelled'" type="button" v-tool="{ id: `retry@${job.id}`, desc: bilingual(`Retry upload job ${job.id}`, `重试上传任务 ${job.id}`), kind: 'write' }" @click="retry(job.id)">{{ bilingual('Retry', '重试') }}</button></div>
        </li>
      </ul>
      <p v-else class="empty">{{ bilingual('Upload a file to start the first job.', '上传文件以创建第一个任务。') }}</p>
    </section>
    <AgentDock :title="bilingual('Upload assistant', '上传助手')" :quick="zh ? ['现在有哪些任务在处理？', '取消当前正在处理的任务'] : ['Which jobs are running?', 'Cancel the active job']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
