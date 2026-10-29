export interface Task {
  id: string;
  text: string;
  done: boolean;
}

export const MAX_TASKS = 8;

export function createSeedTasks(locale: "en" | "zh"): Task[] {
  const tasks =
    locale === "zh"
      ? ["检查发布清单", "跟进客户", "预约设计评审"]
      : ["Review the release checklist", "Send the customer follow-up", "Book the design review"];

  return tasks.map((text, index) => ({ id: `t${index + 1}`, text, done: index === 1 }));
}

export function addTask(tasks: Task[], text: string, id: string): Task[] | null {
  const value = text.trim();
  if (!value || tasks.length >= MAX_TASKS) return null;
  return [{ id, text: value, done: false }, ...tasks];
}

export function toggleTask(tasks: Task[], id: string): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}

export function countTasks(tasks: Task[]): { total: number; open: number; completed: number } {
  const completed = tasks.filter((task) => task.done).length;
  return { total: tasks.length, open: tasks.length - completed, completed };
}
