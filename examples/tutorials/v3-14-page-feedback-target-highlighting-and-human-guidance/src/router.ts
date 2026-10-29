import type { RouteRecordRaw } from "vue-router";
import TaskDetailPage from "./components/TaskDetailPage.vue";
import TaskListPage from "./components/TaskListPage.vue";

export const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/tasks" },
  {
    path: "/tasks",
    name: "tasks",
    component: TaskListPage,
  },
  {
    path: "/tasks/:id",
    name: "task-detail",
    component: TaskDetailPage,
  },
];
