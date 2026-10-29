<script setup lang="ts">
import { ref } from "vue";
import { AgentDock, useAgentState } from "@plingjs/vue";
import { createExecutor, createPolicy, createRegistry } from "@plingjs/core";
import { createSurface, SURFACE_PROTOCOL, type SurfaceResponse } from "@plingjs/surface";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Result { name: string; expected: string; actual: string; ok: boolean; ms: number }

const zh = resolveLocale() === "zh";
const results = ref<Result[]>([]);
const running = ref(false);

function createFixture() {
  const registry = createRegistry();
  registry.setPage({ path: "/conformance", title: "Surface conformance fixture" });
  registry.bind({ descriptor: { id: "item.list", primitive: "call", description: "List fixture items", kind: "read" }, isAvailable: () => true, run: async () => ({ ids: ["item-1", "item-2"] }) });
  registry.bind({ descriptor: { id: "item.add", primitive: "call", description: "Add one fixture item", kind: "write", params: { type: "object", properties: { title: { type: "string", description: "Title" } }, required: ["title"], additionalProperties: false } }, isAvailable: () => true, run: async (args) => ({ added: args.title }) });
  for (const id of ["item-1", "item-2"]) {
    registry.declareRecord({ id, label: `Fixture ${id}`, fields: { state: "ready" } });
    registry.bind({ descriptor: { id: `item.remove@item:${id}`, primitive: "click", description: `Remove ${id}`, kind: "danger", confirm: "always" }, isAvailable: () => true, run: async () => ({ removed: id }) });
  }
  registry.bind({ descriptor: { id: "item.unavailable", primitive: "call", description: "Always unavailable", kind: "write" }, isAvailable: () => false, run: async () => ({ impossible: true }) });
  const executor = createExecutor({ registry, policy: createPolicy(async () => true) });
  const surface = createSurface({ registry, execute: (id, args) => executor.execute(id, args), app: "conformance-fixture", expose: ["item.list", "item.add", "item.remove@item"], replay: true, recordLimit: 2 });
  return surface;
}

function codeOf(response: SurfaceResponse): string {
  if (response.ok) return "OK";
  return response.error.code;
}

async function runSuite(): Promise<void> {
  running.value = true;
  const surface = createFixture();
  const request = (value: unknown) => surface.handle(value);
  const duplicate = `dup-${crypto.randomUUID()}`;
  const vectors: Array<{ name: string; expected: string; run: () => Promise<SurfaceResponse> }> = [
    { name: "describe", expected: "OK", run: () => request({ protocol: SURFACE_PROTOCOL, id: crypto.randomUUID(), method: "describe" }) },
    { name: "wrong protocol", expected: "PROTOCOL_VERSION_UNSUPPORTED", run: () => request({ protocol: "surface/9", id: crypto.randomUUID(), method: "describe" }) },
    { name: "unsupported method", expected: "METHOD_NOT_SUPPORTED", run: () => request({ protocol: SURFACE_PROTOCOL, id: crypto.randomUUID(), method: "destroy" }) },
    { name: "missing id", expected: "INVALID_REQUEST", run: () => request({ protocol: SURFACE_PROTOCOL, method: "describe" }) },
    { name: "unexposed capability", expected: "CAPABILITY_NOT_EXPOSED", run: () => request({ protocol: SURFACE_PROTOCOL, id: crypto.randomUUID(), method: "invoke", capability: "item.unavailable" }) },
    { name: "missing required field", expected: "BUSINESS_ERROR", run: () => request({ protocol: SURFACE_PROTOCOL, id: crypto.randomUUID(), method: "invoke", capability: "item.add", input: {} }) },
    { name: "invalid folded record", expected: "INVALID_REQUEST", run: () => request({ protocol: SURFACE_PROTOCOL, id: crypto.randomUUID(), method: "invoke", capability: "item.remove@item", input: { record: "item-404" } }) },
    { name: "folded record success", expected: "OK", run: () => request({ protocol: SURFACE_PROTOCOL, id: crypto.randomUUID(), method: "invoke", capability: "item.remove@item", input: { record: "item-1" } }) },
    { name: "replay request id", expected: "REPLAY_DETECTED", run: () => request({ protocol: SURFACE_PROTOCOL, id: duplicate, method: "invoke", capability: "item.list" }).then(() => request({ protocol: SURFACE_PROTOCOL, id: duplicate, method: "invoke", capability: "item.list" })) },
  ];
  const next: Result[] = [];
  for (const vector of vectors) {
    const started = performance.now();
    const response = await vector.run();
    let actual = codeOf(response);
    if (response.ok && vector.expected === "BUSINESS_ERROR") actual = "BUSINESS_ERROR";
    next.push({ name: vector.name, expected: vector.expected, actual, ok: actual === vector.expected, ms: Math.round(performance.now() - started) });
  }
  results.value = next;
  running.value = false;
}

useAgentState("conformance_view", () => ({ passed: results.value.filter((item) => item.ok).length, total: results.value.length, complete: results.value.length > 0 }), { description: "Protocol vector pass count; click Run suite to take a fresh fixture snapshot" });
</script>

<template>
  <RecipeShell eyebrow="Recipe 14 · Conformance" :title="bilingual('Prove the boundary with vectors, not a screenshot', '用请求向量证明边界，而不是用截图')" :description="bilingual('A fresh fixture and nine request vectors expose protocol version, method, record identity, parameter, exposure, and replay behaviour. Each rejection is checked before business code can run.', '一个全新夹具与九组请求向量覆盖协议版本、方法、记录身份、参数、暴露范围与重放行为。每个拒绝都在业务代码执行之前检查。')">
    <template #actions><span class="tag" :class="results.length && results.every((item) => item.ok) ? 'ok' : ''">{{ results.filter((item) => item.ok).length }} / {{ results.length || 9 }} {{ bilingual('passed', '通过') }}</span><button class="button primary" v-tool="{ id: 'run_conformance_suite', desc: bilingual('Run the local Surface conformance vectors', '运行本地 Surface 一致性向量'), run: runSuite }" :disabled="running" @click="runSuite">{{ running ? bilingual('Running…', '运行中…') : bilingual('Run suite', '运行向量') }}</button></template>
    <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('Request vectors', '请求向量') }}</h2><p>{{ bilingual('Expected codes are compared with actual protocol responses.', '预期错误码与实际协议响应逐项比较。') }}</p></div><span class="tag">{{ SURFACE_PROTOCOL }}</span></div><div class="body"><div v-if="!results.length" class="empty">{{ bilingual('Run the suite to create a fresh fixture.', '运行向量以创建全新夹具。') }}</div><div v-else class="event-log" style="max-height: 390px"><p v-for="item in results" :key="item.name"><span :class="item.ok ? 'status ok' : 'status error'">{{ item.ok ? 'PASS' : 'FAIL' }}</span> · {{ item.name }} · {{ item.actual }} · {{ item.ms }}ms</p></div></div></section>
    <div class="grid equal" style="margin-top: 16px"><section class="panel"><div class="panel__head"><div><h2>{{ bilingual('What this establishes', '这个面板证明了什么') }}</h2></div></div><div class="body"><ul class="status" style="margin: 0; padding-left: 18px; line-height: 1.8"><li>{{ bilingual('Unsupported protocol and methods fail before execution.', '不支持的协议与方法在执行前失败。') }}</li><li>{{ bilingual('A folded record id must belong to the current fixture.', '折叠记录 id 必须属于当前夹具。') }}</li><li>{{ bilingual('An unexposed capability cannot be reached by guessing its id.', '未暴露能力不能通过猜 id 调用。') }}</li><li>{{ bilingual('A repeated request id is rejected when replay protection is on.', '开启防重放时，重复 request id 会被拒绝。') }}</li></ul></div></section><section class="panel"><div class="panel__head"><div><h2>{{ bilingual('What remains outside', '仍未覆盖的部分') }}</h2></div></div><div class="body"><p class="hint">{{ bilingual('This panel does not certify transport, SSO, multi-tenant identity, browser matrix, or another independent implementation. Report it as “passes these repository vectors under this fixture”, not “Pling certified”.', '该面板不认证传输、SSO、多租户身份、浏览器矩阵或另一套独立实现。应表述为“在当前夹具下通过这些仓库向量”，而不是“获得 Pling 认证”。') }}</p></div></section></div>
    <AgentDock :title="bilingual('Conformance assistant', '一致性助手')" :quick="zh ? ['运行协议向量并告诉我哪项失败', '解释 CAPABILITY_NOT_EXPOSED'] : ['Run the protocol vectors and tell me which one failed', 'Explain CAPABILITY_NOT_EXPOSED']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
