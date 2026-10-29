import type { DemoLocale } from "./copy";

export interface Task {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoCounts {
  total: number;
  open: number;
  completed: number;
}

export function createSeedTasks(locale: DemoLocale): Task[] {
  const tasks =
    locale === "zh"
      ? ["检查发布清单", "跟进客户", "预约设计评审"]
      : ["Review the release checklist", "Send the customer follow-up", "Book the design review"];

  return tasks.map((text, index) => ({ id: `t${index + 1}`, text, done: index === 1 }));
}

export function countTasks(tasks: readonly Task[]): TodoCounts {
  const completed = tasks.filter((task) => task.done).length;
  return { total: tasks.length, open: tasks.length - completed, completed };
}
