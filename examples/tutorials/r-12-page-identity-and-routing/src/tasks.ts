import type { DemoTask, Priority } from "./copy";

export interface Task extends DemoTask {
  id: string;
}

export const MAX_TASKS = 40;

export interface TaskActions {
  addTask: (text: string, priority: Priority) => Task | null;
  toggleTask: (id: string) => void;
  updateTaskText: (id: string, text: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  completeOpenTasks: () => number;
}
