<script setup lang="ts">
import { ref } from "vue";
import { AgentDock, useAgentState } from "@plingjs/vue";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

type Persist = "off" | "readonly" | "memory" | "session";

const zh = resolveLocale() === "zh";
const persist = ref<Exclude<Persist, "off" | "readonly">>("session");
const events = ref<string[]>([]);
const dock = ref<InstanceType<typeof AgentDock> | null>(null);
const endpoint = import.meta.env.VITE_AGENT_BASE_URL || "/api/agent/v1";
const model = import.meta.env.VITE_AGENT_MODEL || "provider-default";
const started = ref(false);

function recordEvent(type: string): void {
  events.value.unshift(`${new Date().toLocaleTimeString()} · ${type}`);
  if (events.value.length > 8) events.value.length = 8;
}

async function tryRequest(): Promise<void> {
  started.value = true;
  recordEvent(bilingual("request handed to the page runtime", "请求已交给页面运行时"));
  await dock.value?.send(bilingual("Summarize the current page in one sentence.", "用一句话概述当前页面。"));
  recordEvent(bilingual("request returned", "请求已返回"));
}

useAgentState("model_setting_view", () => ({
  endpoint,
  model,
  builtInSettings: true,
  persistence: persist.value,
  keyVisibleToPageState: false,
  started: started.value,
}), { description: "Model endpoint name, persistence policy, and whether a request has started; never the API key" });
</script>

<template>
  <RecipeShell eyebrow="Recipe 13 · BYOK" :title="bilingual('A model connection is runtime configuration, not page content', '模型连接是运行时配置，不是页面内容')" :description="bilingual('The built-in Activity settings accept a base URL, model, and key. The key is held by the runtime and is never added to records, page state, or model messages.', '内置 Activity 设置接受 base URL、模型与密钥。密钥只由运行时持有，不会进入记录、页面状态或模型消息。')">
    <template #actions><span class="tag" :class="started ? 'ok' : ''">{{ bilingual('session storage', '会话存储') }}</span><button class="button primary" type="button" v-tool="{ id: 'ask_with_current_model', desc: bilingual('Ask the current page assistant to summarize this page', '让当前页面助手概述本页'), kind: 'read', run: tryRequest }" @click="tryRequest">{{ bilingual('Open assistant and send', '打开助手并发送') }}</button></template>
    <div class="grid">
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('Connection policy', '连接策略') }}</h2><p>{{ bilingual('Choose how the demonstration keeps a key between requests.', '选择示例如何在请求之间保留密钥。') }}</p></div></div><div class="body"><div class="tabs" style="margin-bottom: 12px"><button :class="{ 'is-active': persist === 'memory' }" @click="persist = 'memory'">memory</button><button :class="{ 'is-active': persist === 'session' }" @click="persist = 'session'">session</button></div><dl class="kv"><dt>baseUrl</dt><dd>{{ endpoint }}</dd><dt>model</dt><dd>{{ model }}</dd><dt>mode</dt><dd>byok</dd><dt>persist</dt><dd>{{ persist }}</dd></dl><div class="notice" style="margin: 14px 0 0">{{ bilingual('The built-in settings panel is available from Activity. With session persistence, a page refresh keeps the key in sessionStorage for this tab. Production hosts may prefer a same-origin gateway so the browser receives no provider key at all.', '内置设置面板位于 Activity。使用 session 时，刷新页面仍会从当前标签页的 sessionStorage 保留密钥。生产宿主更适合同源网关，让浏览器完全拿不到供应商密钥。') }}</div></div></section>
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('What is exposed', '暴露了什么') }}</h2><p>{{ bilingual('Configuration status is readable; the secret is not.', '配置状态可读，秘密不可读。') }}</p></div></div><div class="body"><dl class="kv"><dt>{{ bilingual('Page state', '页面状态') }}</dt><dd>{{ bilingual('endpoint, model, persistence, started', '地址、模型、持久策略、是否已发起') }}</dd><dt>{{ bilingual('Model messages', '模型消息') }}</dt><dd>{{ bilingual('normal task text and page context only', '仅普通任务文本与页面上下文') }}</dd><dt>{{ bilingual('Key', '密钥') }}</dt><dd>{{ bilingual('held by the runtime; never serialized', '由运行时持有，永不序列化') }}</dd></dl><pre class="code-box" style="margin-top: 12px">{{ JSON.stringify({ provider: { baseUrl: endpoint, model }, persistence: persist, key: "[not exposed]" }, null, 2) }}</pre></div></section>
    </div>
    <section class="panel" style="margin-top: 16px"><div class="panel__head"><div><h2>{{ bilingual('Runtime events', '运行时事件') }}</h2><p>{{ bilingual('Open Activity to inspect the real request messages and tool calls.', '打开 Activity 查看真实请求消息与工具调用。') }}</p></div></div><div class="body"><div v-if="events.length" class="event-log"><p v-for="event in events" :key="event">{{ event }}</p></div><p v-else class="empty">{{ bilingual('Send a request after configuring a model.', '配置模型后发送一条请求。') }}</p></div></section>
    <AgentDock ref="dock" :title="bilingual('Page assistant', '页面助手')" :quick="zh ? ['用一句话概述页面', '现在使用的是什么模型？'] : ['Summarize this page in one sentence', 'Which model is configured?']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist }" @event="recordEvent('session.event')" />
  </RecipeShell>
</template>
