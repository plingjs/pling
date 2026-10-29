<script setup lang="ts">
import { ref } from "vue";
import { AgentDock, useAgentState, useAgentTool, usePling } from "@plingjs/vue";
import { createExecutor, createPolicy } from "@plingjs/core";
import { defaultSettle } from "@plingjs/agent";
import { createSurface, SURFACE_PROTOCOL, type SurfaceResponse } from "@plingjs/surface";
import RecipeShell from "../../../recipe-shared/RecipeShell.vue";
import { bilingual, resolveLocale } from "../../../recipe-shared/locale";

interface Article { id: string; title: string; author: string; status: "draft" | "approved" | "archived"; comment: string }

const zh = resolveLocale() === "zh";
const pling = usePling();
const articles = ref<Article[]>([
  { id: "ART-81", title: "Quarterly billing changes", author: "Finance", status: "draft", comment: "" },
  { id: "ART-82", title: "New supplier checklist", author: "Procurement", status: "draft", comment: "" },
  { id: "ART-83", title: "Security review summary", author: "Security", status: "draft", comment: "" },
  { id: "ART-84", title: "Support hours update", author: "Operations", status: "approved", comment: "" },
]);
const response = ref<SurfaceResponse | null>(null);
const error = ref("");

function approve(id: string): Article {
  const article = articles.value.find((item) => item.id === id);
  if (!article) throw new Error("Article not found.");
  article.status = "approved";
  return { ...article };
}
function comment(id: string, text: string): Article {
  const article = articles.value.find((item) => item.id === id);
  if (!article) throw new Error("Article not found.");
  article.comment = text.slice(0, 300);
  return { ...article };
}

const executor = createExecutor({ registry: pling.registry, policy: createPolicy(async () => true), settle: defaultSettle });
const surface = createSurface({
  registry: pling.registry,
  execute: (id, args) => executor.execute(id, args),
  app: "recipe-article-surface",
  expose: ["article_list", "article_approve@", "article_comment@"],
  recordLimit: 4,
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  replay: true,
  onAudit: () => {},
});

async function describe(): Promise<void> {
  try {
    const value = await surface.handle({ protocol: SURFACE_PROTOCOL, id: crypto.randomUUID(), method: "describe" });
    response.value = value;
    error.value = "";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

async function invoke(capability: string, input?: Record<string, unknown>): Promise<void> {
  try {
    response.value = await surface.handle({ protocol: SURFACE_PROTOCOL, id: crypto.randomUUID(), method: "invoke", capability, ...(input ? { input } : {}) });
    error.value = "";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

useAgentState("article_view", () => ({
  drafts: articles.value.filter((item) => item.status === "draft").length,
  approved: articles.value.filter((item) => item.status === "approved").length,
  externallyExposed: ["article_list", "article_approve@", "article_comment@"],
}), { description: "Article counts and the exact capabilities exposed to external clients" });

useAgentTool({ id: "article_list", desc: bilingual("List article records and their status", "列出文章记录与状态"), kind: "read", run: () => ({ articles: articles.value }) });
useAgentTool({
  id: "article_approve",
  desc: bilingual("Approve one article", "通过一篇文章"),
  kind: "write",
  params: [{ name: "record", label: "Article id", values: ["ART-81", "ART-82", "ART-83", "ART-84"] }],
  run: async (args) => approve(String(args.record)),
});
useAgentTool({
  id: "article_comment",
  desc: bilingual("Add a review comment to one article", "给一篇文章添加审核备注"),
  kind: "write",
  params: [{ name: "record", label: "Article id" }, { name: "text", label: "Review comment", maxLength: 300 }],
  run: async (args) => comment(String(args.record), String(args.text)),
});
useAgentTool({ id: "article_delete", desc: bilingual("Delete an article; deliberately absent from the external allowlist", "删除文章；刻意不在外部白名单中"), kind: "danger", params: [{ name: "record", label: "Article id" }], run: async (args) => { articles.value = articles.value.filter((item) => item.id !== String(args.record)); return { deleted: args.record }; } });
</script>

<template>
  <RecipeShell eyebrow="Recipe 09 · External surface" :title="bilingual('Three named capabilities, no generic DOM escape hatch', '三个具名能力，没有通用 DOM 逃逸口')" :description="bilingual('The page assistant can do more than the external client. The surface protocol exposes only list, approve, and comment; delete exists in the page but is rejected outside.', '页面内助手能做的事多于外部客户端。能力面只暴露列表、通过与备注；删除虽然存在于页面，却会被外部调用拒绝。')">
    <div class="grid">
      <section class="panel" v-scope="{ id: 'articles', label: bilingual('Articles', '文章'), role: 'list' }">
        <div class="panel__head"><div><h2>{{ bilingual('Editorial queue', '编辑队列') }}</h2><p>{{ articles.length }} {{ bilingual('records', '条记录') }}</p></div></div>
        <ul class="records">
          <li v-for="article in articles" :key="article.id" class="record" v-record="{ data: article, label: article.title, fields: { author: article.author, status: article.status, comment: article.comment } }"><div class="record__main"><p class="record__title">{{ article.title }} <span class="record__id">{{ article.id }}</span></p><p class="record__meta">{{ article.author }} · {{ article.status }} · {{ article.comment || bilingual('No comment', '无备注') }}</p></div><div class="record__actions"><button v-if="article.status === 'draft'" type="button" v-tool="{ id: `approve@${article.id}`, desc: bilingual(`Approve ${article.id}`, `通过 ${article.id}`), kind: 'write' }" @click="approve(article.id)">{{ bilingual('Approve', '通过') }}</button></div></li>
        </ul>
      </section>
      <section class="panel"><div class="panel__head"><div><h2>{{ bilingual('External client', '外部客户端') }}</h2><p>{{ bilingual('Calls the same protocol surface an MCP facade would use.', '调用与 MCP facade 相同的协议能力面。') }}</p></div></div><div class="body"><div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px"><button class="button" @click="describe">describe</button><button class="button" @click="invoke('article_list')">article_list</button><button class="button" @click="invoke('article_approve', { record: 'ART-81' })">approve ART-81</button><button class="button" @click="invoke('article_comment', { record: 'ART-82', text: 'Needs legal review' })">comment ART-82</button><button class="button danger" @click="invoke('article_delete', { record: 'ART-84' })">delete ART-84</button></div><pre v-if="response" class="code-box">{{ JSON.stringify(response, null, 2) }}</pre><p v-else class="hint">{{ bilingual('Start with describe, then invoke one of the returned capabilities.', '先调用 describe，再调用返回清单里的能力。') }}</p><p v-if="error" class="status error">{{ error }}</p></div></section>
    </div>
    <AgentDock :title="bilingual('Page assistant', '页面助手')" :quick="zh ? ['通过 ART-81 并写备注：可以发布', '列出当前文章'] : ['Approve ART-81 and add the note “Ready to publish”', 'List the current articles']" :debug="{ maxCalls: 8 }" :model-settings="{ mode: 'byok', persist: 'session' }" />
  </RecipeShell>
</template>
