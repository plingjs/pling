<template>
  <section v-scope="{ id: 'page', label: '订单后台', role: 'page', description: '订单管理主页面' }">
    <div v-scope="{ id: 'toolbar', label: '筛选与工具栏', role: 'toolbar', description: '搜索与导出' }">
      <button type="button" v-tool="{ id: 'confirm_filter', desc: '确认当前筛选条件' }">确认</button>
    </div>

    <div v-scope="{ id: 'list', label: '订单列表', role: 'list', description: '每行一张订单' }">
      <button type="button" v-tool="{ id: 'remove_order', desc: '删除这一条' }">删除</button>
    </div>
  </section>

  <div v-scope="{ id: 'dialog', label: '编辑订单弹窗', role: 'dialog', description: '修改备注', parent: 'page' }">
    <button type="button" v-tool="{ id: 'confirm_save', desc: '确认并保存备注' }">确认</button>
  </div>
</template>
