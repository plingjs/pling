<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { DEMO_EXAMPLES } from "virtual:pling-demo-data";

interface DemoCopy {
  eyebrow: string;
  title: string;
  summary: string;
}

interface FlagshipCard extends DemoCopy {
  id: string;
  meta: string;
  liveHref: string;
  detailHref: string;
}

const { lang } = useData();
const isZh = computed(() => lang.value.startsWith("zh"));
const localePrefix = computed(() => (isZh.value ? "/zh" : ""));
const props = withDefaults(defineProps<{ group?: "flagship" | "recipes" }>(), { group: "flagship" });

const COPY: Record<string, { en: DemoCopy; zh: DemoCopy }> = {
  quickstart: {
    en: {
      eyebrow: "Start here",
      title: "Example 01: Todo",
      summary: "A normal Vue todo page with filters, editing, completion, and cleanup. Ask the assistant to do the work instead of watching a scripted recording.",
    },
    zh: {
      eyebrow: "从这里开始",
      title: "案例01：待办事项",
      summary: "一个普通 Vue Todo 页面，包含筛选、编辑、完成与清理。直接让助手完成任务，而不是看一段预录演示。",
    },
  },
  orders: {
    en: {
      eyebrow: "Operations",
      title: "Example 02: Order workspace",
      summary: "A real model operating a business queue with filters, order details, editable follow-up notes, record-aware actions, and a confirmation gate.",
    },
    zh: {
      eyebrow: "业务操作",
      title: "案例02：订单工作台",
      summary: "让真实模型操作业务队列，包含筛选、订单详情、可编辑回访备注、记录级动作与确认闸门。",
    },
  },
};

function copyFor(example: (typeof DEMO_EXAMPLES)[number]): DemoCopy {
  const fixed = COPY[example.id]?.[isZh.value ? "zh" : "en"];
  if (fixed) return fixed;
  return {
    eyebrow: (isZh.value ? example.eyebrowZh : undefined) ?? example.eyebrow,
    title: (isZh.value ? example.titleZh : undefined) ?? example.title,
    summary: (isZh.value ? example.summaryZh : undefined) ?? example.summary,
  };
}

function hrefFor(example: (typeof DEMO_EXAMPLES)[number]): string {
  return `${localePrefix.value}/examples/${example.id}`;
}

function liveHrefFor(example: (typeof DEMO_EXAMPLES)[number]): string {
  return `${example.url}${isZh.value ? "?lang=zh" : ""}`;
}

const cards = computed<FlagshipCard[]>(() => {
  const all = DEMO_EXAMPLES.map((example) => {
    const copy = copyFor(example);
    return {
      id: example.id,
      ...copy,
      meta: isZh.value
        ? `${example.stats.files} 个文件 · ${example.stats.declared} 行动作声明`
        : `${example.stats.files} files · ${example.stats.declared} declared lines`,
      liveHref: liveHrefFor(example),
      detailHref: hrefFor(example),
    };
  });
  const ordered = ["quickstart", "orders", "vue3-spa-routing", "multi-page-continuity", "external-agent-surface"];
  if (props.group === "recipes") {
    return all
      .filter((card) => card.id.startsWith("recipe-"))
      .sort((left, right) => {
        const leftRank = Number(left.title.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
        const rightRank = Number(right.title.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
        return leftRank - rightRank || left.id.localeCompare(right.id);
      });
  }
  return ordered
    .map((id) => all.find((card) => card.id === id))
    .filter((card): card is FlagshipCard => Boolean(card))
    .concat(all.filter((card) => !ordered.includes(card.id) && !card.id.startsWith("recipe-")));
});
</script>

<template>
  <div class="demo-gallery">
    <article v-for="card in cards" :key="card.id" class="demo-gallery__card">
      <span class="demo-gallery__eyebrow">{{ card.eyebrow }}</span>
      <h2>{{ card.title }}</h2>
      <p>{{ card.summary }}</p>
      <span class="demo-gallery__meta">{{ card.meta }}</span>
      <span class="demo-gallery__actions">
        <a class="demo-gallery__live" :href="card.liveHref" target="_blank" rel="noopener noreferrer">
          {{ isZh ? "打开在线案例" : "Open live example" }} <span aria-hidden="true">↗</span>
        </a>
        <a class="demo-gallery__open" :href="card.detailHref">
          {{ isZh ? "源码与说明" : "Source & guide" }} <span aria-hidden="true">→</span>
        </a>
      </span>
    </article>
  </div>
</template>

<style scoped>
.demo-gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 26px 0 36px;
}
.demo-gallery__card {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  padding: 22px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 15px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition:
    border-color 150ms ease,
    transform 150ms ease,
    box-shadow 150ms ease;
}
.demo-gallery__card:hover {
  border-color: var(--vp-c-brand-2);
  box-shadow: 0 14px 34px rgb(46 157 247 / 12%);
  transform: translateY(-2px);
}
.demo-gallery__eyebrow {
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.demo-gallery h2 {
  margin: 8px 0 0;
  border: 0;
  padding: 0;
  font-size: 24px;
}
.demo-gallery p {
  margin: 8px 0 18px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.55;
}
.demo-gallery__meta {
  margin-top: auto;
  color: var(--vp-c-text-3);
  font-size: 11px;
}
.demo-gallery__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  margin-top: 12px;
}
.demo-gallery__live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
  font-size: 12px;
  font-weight: 650;
  text-decoration: none;
}
.demo-gallery__live:hover {
  background: var(--vp-c-brand-2);
  color: var(--vp-c-white);
}
.demo-gallery__open {
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 650;
  text-decoration: none;
}
.demo-gallery__open:hover {
  color: var(--vp-c-brand-2);
}
@media (max-width: 720px) {
  .demo-gallery {
    grid-template-columns: 1fr;
  }
}
</style>
