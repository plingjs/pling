<script setup lang="ts">
/**
 * 框架测试用的最小业务替身：一个可滚动列表 + 若干全局动作。
 * 放在 packages/vue 里，让框架测试不依赖任何真实业务页面。
 */
import { ref } from "vue";

defineProps<{ rows: string[] }>();

const approved = ref<Set<string>>(new Set());
const keyword = ref("");

function approve(row: string): void {
  approved.value = new Set([...approved.value, row]);
}
function remove(row: string): void {
  approved.value = new Set([...approved.value]);
  void row;
}
</script>

<template>
  <section class="admin">
    <p class="row">
      <input
        v-model="keyword"
        placeholder="关键词"
        v-tool="[
          { id: 'filter_text', action: 'fill', desc: '输入筛选关键词' },
          { id: 'filter_enter', action: 'press', key: 'Enter', desc: '按回车执行筛选' },
        ]"
      />
      <button type="button" v-tool="{ id: 'filter_submit', desc: '执行筛选' }">筛选</button>
      <button type="button" v-tool="{ id: 'reload', desc: '刷新列表' }">刷新</button>
    </p>

    <div class="table-wrap" v-scope="{ id: 'rows', label: '数据列表' }">
      <table>
        <tbody>
          <tr v-for="row in rows" :key="row" :data-order="row">
            <td>{{ approved.has(row) ? "已通过" : "待审批" }}</td>
            <td class="row">
              <button type="button" @click="approve(row)" v-tool="{ id: `approve@order:${row}`, desc: `审批 ${row}` }">
                审批
              </button>
              <button
                type="button"
                @click="remove(row)"
                v-tool="{ id: `remove@order:${row}`, kind: 'danger', desc: `删除 ${row}` }"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.table-wrap {
  max-height: 340px;
  overflow: auto;
}
.row {
  display: flex;
  gap: 8px;
}
</style>
