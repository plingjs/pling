import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AgentDock, usePling } from "@plingjs/react";
import {
  copyFor,
  plingLocale,
  resolveDemoLocale,
  type DemoLocale,
  type Priority,
} from "./copy";
import { AppRoutes, pageIdentityFor } from "./router";
import { MAX_TASKS, type Task } from "./tasks";

export interface AppProps {
  locale?: DemoLocale;
}

export function App({ locale = resolveDemoLocale() }: AppProps) {
  const copy = copyFor(locale);
  const pling = usePling();
  const location = useLocation();
  const [tasks, setTasks] = useState<Task[]>(() =>
    copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })),
  );
  const tasksRef = useRef(tasks);
  const sequence = useRef(copy.seedTasks.length);
  tasksRef.current = tasks;

  useEffect(() => {
    const page = pageIdentityFor(location.pathname, location.search, copy);
    document.documentElement.lang = plingLocale(locale);
    document.title = page.title ?? copy.documentTitle;
    pling.registry.setPage(page);
  }, [copy, locale, location.pathname, location.search, pling]);

  function addTask(text: string, priority: Priority): Task | null {
    const value = text.trim();
    const current = tasksRef.current;
    if (!value || current.length >= MAX_TASKS) return null;
    const task: Task = {
      id: `t${++sequence.current}`,
      text: value,
      done: false,
      priority,
    };
    const next = [task, ...current];
    tasksRef.current = next;
    setTasks(next);
    return task;
  }

  function toggleTask(id: string): void {
    const next = tasksRef.current.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    tasksRef.current = next;
    setTasks(next);
  }

  function updateTaskText(id: string, text: string): void {
    const next = tasksRef.current.map((task) =>
      task.id === id ? { ...task, text } : task
    );
    tasksRef.current = next;
    setTasks(next);
  }

  function removeTask(id: string): void {
    const next = tasksRef.current.filter((task) => task.id !== id);
    tasksRef.current = next;
    setTasks(next);
  }

  function clearCompleted(): void {
    const next = tasksRef.current.filter((task) => !task.done);
    tasksRef.current = next;
    setTasks(next);
  }

  function completeOpenTasks(): number {
    const current = tasksRef.current;
    const open = current.filter((task) => !task.done).length;
    const next = current.map((task) => task.done ? task : { ...task, done: true });
    tasksRef.current = next;
    setTasks(next);
    return open;
  }

  return (
    <main className="page">
      <AppRoutes
        tasks={tasks}
        copy={copy}
        addTask={addTask}
        toggleTask={toggleTask}
        updateTaskText={updateTaskText}
        removeTask={removeTask}
        clearCompleted={clearCompleted}
        completeOpenTasks={completeOpenTasks}
      />
      <AgentDock
        title={copy.dockTitle}
        quick={copy.quick}
        debug={{ maxCalls: 8 }}
      />
    </main>
  );
}
