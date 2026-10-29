<script setup lang="ts">
import { onMounted, ref } from "vue";
import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import type { copyFor } from "./copy";

const props = defineProps<{
  surface: AgentSurface;
  copy: ReturnType<typeof copyFor>;
}>();

const lastResponse = ref<SurfaceResponse | null>(null);
const notice = ref("");
let requestSequence = 0;

const proof = ref("—");

function nextRequest(method: "describe" | "invoke", extra: Record<string, unknown> = {}) {
  return {
    protocol: SURFACE_PROTOCOL,
    id: `demo-${++requestSequence}`,
    method,
    ...extra,
  };
}

async function send(request: ReturnType<typeof nextRequest>): Promise<SurfaceResponse> {
  const response = await props.surface.handle(request);
  lastResponse.value = response;
  proof.value = JSON.stringify(response, null, 2);
  return response;
}

function outcomeOf(response: SurfaceResponse): string {
  if (!response.ok) return response.error.code;
  if ("error" in response.result) return response.result.error.code;
  return "ok";
}

async function describeSurface(): Promise<void> {
  notice.value = "";
  await send(nextRequest("describe", { input: { limit: 2 } }));
}

async function addThroughProtocol(): Promise<void> {
  notice.value = "";
  const response = await send(
    nextRequest("invoke", { capability: "todo.add", input: { text: props.copy.externalTask } }),
  );
  notice.value = `todo.add → ${outcomeOf(response)}`;
}

async function tryHiddenDelete(): Promise<void> {
  notice.value = "";
  const description = await props.surface.handle(
    nextRequest("describe", { input: { limit: 2 } }),
  );
  if (!description.ok || !("context" in description.result)) {
    lastResponse.value = description;
    proof.value = JSON.stringify(description, null, 2);
    notice.value = description.ok ? "describe → unexpected result" : `describe → ${description.error.code}`;
    return;
  }

  const target = description.result.context.recordIds[0];
  if (!target) return;
  const response = await send(nextRequest("invoke", { capability: `todo.remove@task:${target}` }));
  notice.value = `todo.remove → ${outcomeOf(response)}`;
}

async function requestClear(): Promise<void> {
  notice.value = "";
  const response = await send(nextRequest("invoke", { capability: "todo.clear_completed" }));
  notice.value = outcomeOf(response) === "ok" ? props.copy.approved : `clear_completed → ${outcomeOf(response)}`;
}

onMounted(() => { void describeSurface(); });

defineExpose({ lastResponse });
</script>

<template>
  <aside class="external" aria-labelledby="external-title">
    <div class="external__head">
      <div>
        <p class="eyebrow">{{ copy.panelEyebrow }}</p>
        <h2 id="external-title">{{ copy.panelTitle }}</h2>
      </div>
      <code>0.1</code>
    </div>
    <p class="external__lead">{{ copy.panelLead }}</p>
    <div class="external__actions">
      <button data-testid="surface-describe" type="button" @click="describeSurface">{{ copy.describe }}</button>
      <button data-testid="surface-add" type="button" @click="addThroughProtocol">{{ copy.addExternal }}</button>
      <button data-testid="surface-hidden" type="button" @click="tryHiddenDelete">{{ copy.tryHidden }}</button>
      <button data-testid="surface-clear" type="button" @click="requestClear">{{ copy.requestClear }}</button>
    </div>
    <p v-if="notice" class="notice">{{ notice }}</p>
    <p class="response-label">{{ copy.response }}</p>
    <pre data-testid="surface-response">{{ proof }}</pre>
  </aside>
</template>
