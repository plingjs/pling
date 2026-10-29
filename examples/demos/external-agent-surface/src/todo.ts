import type { DemoLocale, Priority } from "./copy";

export interface Task {
  id: string;
  text: string;
  done: boolean;
  priority: Priority;
}

export const MAX_TASKS = 24;

export function createSeedTasks(locale: DemoLocale): Task[] {
  const texts =
    locale === "zh"
      ? ["检查发布清单", "跟进外部 Agent 接入", "预约设计评审", "整理客户反馈"]
      : ["Review the release checklist", "Follow up on the external agent", "Book the design review", "Summarize customer feedback"];
  const priorities: Priority[] = ["today", "soon", "later", "soon"];
  return texts.map((text, index) => ({
    id: `t${index + 1}`,
    text,
    done: index === 3,
    priority: priorities[index] ?? "soon",
  }));
}

export function addTask(tasks: Task[], text: string, priority: Priority, id: string): Task[] | null {
  const value = text.trim();
  if (!value || tasks.length >= MAX_TASKS) return null;
  return [{ id, text: value, done: false, priority }, ...tasks];
}

export function updateTask(tasks: Task[], id: string, text: string): Task[] {
  const value = text.trim();
  if (!value) return tasks;
  return tasks.map((task) => (task.id === id ? { ...task, text: value } : task));
}

export function toggleTask(tasks: Task[], id: string): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}

export function removeTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id);
}

export function countTasks(tasks: Task[]): { total: number; open: number; completed: number } {
  const completed = tasks.filter((task) => task.done).length;
  return { total: tasks.length, open: tasks.length - completed, completed };
}
