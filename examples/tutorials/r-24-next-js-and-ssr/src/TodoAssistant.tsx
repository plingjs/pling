import { AgentDock, useAgentTool, usePlingState } from "@plingjs/react";
import { copyFor, type DemoLocale } from "./copy";
import type { Task, TodoCounts } from "./todo";

export interface TodoAssistantProps {
  locale: DemoLocale;
  tasks: readonly Task[];
  counts: TodoCounts;
  onAdd(text: string): void;
  onToggle(id: string): void;
  onClear(): void;
}

export function TodoAssistant({ locale, tasks, counts, onAdd, onToggle, onClear }: TodoAssistantProps) {
  const copy = copyFor(locale);

  usePlingState("todo_ssr", () => ({ ...counts }), { description: copy.overview });

  useAgentTool({
    id: "todo.overview",
    desc: copy.overview,
    kind: "read",
    run: () => ({
      ...counts,
      records: tasks.map((task) => ({ id: task.id, text: task.text, done: task.done })),
    }),
  });

  useAgentTool({
    id: "todo.add",
    desc: copy.addDescription,
    kind: "write",
    params: [{ name: "text", label: copy.taskLabel, minLength: 1, maxLength: 80 }],
    run: (args) => onAdd(String(args.text)),
  });

  useAgentTool({
    id: "todo.toggle",
    desc: "Toggle one task by id.",
    kind: "write",
    params: [{ name: "id", label: "Task id", minLength: 1 }],
    run: (args) => onToggle(String(args.id)),
  });

  useAgentTool({
    id: "todo.clear_completed",
    desc: copy.clearDescription,
    kind: "danger",
    confirm: "always",
    run: () => onClear(),
  });

  return <AgentDock title={copy.dockTitle} quick={[...copy.quick]} debug={{ maxCalls: 8 }} />;
}
