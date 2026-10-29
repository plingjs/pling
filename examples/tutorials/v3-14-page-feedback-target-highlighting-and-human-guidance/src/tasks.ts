import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { DemoCopy, Priority } from "./copy";

export type Filter = "all" | "active" | "completed";

export interface Task {
  id: string;
  text: string;
  done: boolean;
  priority: Priority;
}

export interface TaskStore {
  tasks: Ref<Task[]>;
  remaining: ComputedRef<number>;
  completed: ComputedRef<number>;
  findTask: (id: string) => Task | undefined;
  addTask: (text: string, priority: Priority) => Task | null;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  completeOpenTasks: () => number;
}

export const MAX_TASKS = 40;

export function createTaskStore(initialCopy: DemoCopy): TaskStore {
  const tasks = ref<Task[]>(
    initialCopy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })),
  );
  let sequence = initialCopy.seedTasks.length;

  const remaining = computed(() => tasks.value.filter((task) => !task.done).length);
  const completed = computed(() => tasks.value.length - remaining.value);

  function findTask(id: string): Task | undefined {
    return tasks.value.find((task) => task.id === id);
  }

  function addTask(text: string, priority: Priority): Task | null {
    const value = text.trim();
    if (!value || tasks.value.length >= MAX_TASKS) return null;
    const task = { id: `t${++sequence}`, text: value, done: false, priority };
    tasks.value.unshift(task);
    return task;
  }

  function toggleTask(id: string): void {
    const task = findTask(id);
    if (task) task.done = !task.done;
  }

  function removeTask(id: string): void {
    tasks.value = tasks.value.filter((task) => task.id !== id);
  }

  function clearCompleted(): void {
    tasks.value = tasks.value.filter((task) => !task.done);
  }

  function completeOpenTasks(): number {
    const openTasks = tasks.value.filter((task) => !task.done);
    for (const task of openTasks) task.done = true;
    return openTasks.length;
  }

  return {
    tasks,
    remaining,
    completed,
    findTask,
    addTask,
    toggleTask,
    removeTask,
    clearCompleted,
    completeOpenTasks,
  };
}
