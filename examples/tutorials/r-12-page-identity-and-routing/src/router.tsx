import type { PageView } from "@plingjs/core";
import { matchPath, Navigate, Route, Routes } from "react-router-dom";
import type { DemoCopy } from "./copy";
import { TaskDetailPage } from "./components/TaskDetailPage";
import { TaskListPage } from "./components/TaskListPage";
import type { Task, TaskActions } from "./tasks";

export const ROUTE_NAMES = {
  tasks: "tasks",
  taskDetail: "task-detail",
  notFound: "not-found",
} as const;

type RouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES];

const ALLOWED_QUERY_KEYS = new Set(["from"]);
const ALLOWED_QUERY_VALUES: Record<string, ReadonlySet<string>> = {
  from: new Set([ROUTE_NAMES.tasks, ROUTE_NAMES.taskDetail]),
};

/** The only URL data this tutorial sends to a model provider. */
export function visibleQuery(search: string): Record<string, string> | undefined {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const key of ALLOWED_QUERY_KEYS) {
    const value = params.get(key);
    if (value && ALLOWED_QUERY_VALUES[key]?.has(value)) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function pageIdentityFor(
  pathname: string,
  search: string,
  copy: DemoCopy,
): PageView {
  const detail = matchPath({ path: "/tasks/:id", end: true }, pathname);
  const name: RouteName = detail
    ? ROUTE_NAMES.taskDetail
    : pathname === "/tasks"
      ? ROUTE_NAMES.tasks
      : ROUTE_NAMES.notFound;
  const query = visibleQuery(search);
  return {
    path: pathname,
    title: copy.pageTitle(name),
    name,
    ...(detail?.params.id ? { params: { id: detail.params.id } } : {}),
    ...(query ? { query } : {}),
  };
}

export interface AppRoutesProps extends TaskActions {
  tasks: Task[];
  copy: DemoCopy;
}

export function AppRoutes({ tasks, copy, ...actions }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/tasks" replace />} />
      <Route
        path="/tasks"
        element={<TaskListPage tasks={tasks} copy={copy} {...actions} />}
      />
      <Route
        path="/tasks/:id"
        element={<TaskDetailPage tasks={tasks} copy={copy} onToggleTask={actions.toggleTask} />}
      />
      <Route path="*" element={<TaskDetailPage tasks={tasks} copy={copy} onToggleTask={actions.toggleTask} />} />
    </Routes>
  );
}
