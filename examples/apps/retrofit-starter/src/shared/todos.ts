export type TodoFilter = "all" | "open" | "completed";

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export const MAX_TODOS = 8;

export function createSeedTodos(locale: "en" | "zh"): Todo[] {
  return locale === "zh"
    ? [
        { id: "t1", text: "整理周五演示的讲稿", done: false },
        { id: "t2", text: "回复客户的跟进邮件", done: true },
        { id: "t3", text: "确认发布清单", done: false },
        { id: "t4", text: "给设计评审留出时间", done: false },
      ]
    : [
        { id: "t1", text: "Shape Friday's demo narrative", done: false },
        { id: "t2", text: "Reply to the customer follow-up", done: true },
        { id: "t3", text: "Confirm the release checklist", done: false },
        { id: "t4", text: "Hold time for the design review", done: false },
      ];
}

export function countTodos(todos: readonly Todo[]): { total: number; open: number; completed: number } {
  const completed = todos.filter((todo) => todo.done).length;
  return { total: todos.length, open: todos.length - completed, completed };
}

export function visibleTodos(todos: readonly Todo[], filter: TodoFilter): Todo[] {
  if (filter === "open") return todos.filter((todo) => !todo.done);
  if (filter === "completed") return todos.filter((todo) => todo.done);
  return [...todos];
}

export function nextTodoId(todos: readonly Todo[]): string {
  const highest = todos.reduce((value, todo) => Math.max(value, Number(todo.id.replace(/\D/g, "")) || 0), 0);
  return `t${highest + 1}`;
}

export function addTodo(todos: readonly Todo[], text: string): Todo[] {
  const value = text.trim();
  if (!value || todos.length >= MAX_TODOS) return [...todos];
  return [...todos, { id: nextTodoId(todos), text: value, done: false }];
}

export function toggleTodo(todos: readonly Todo[], id: string): Todo[] {
  return todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
}

export function updateTodo(todos: readonly Todo[], id: string, text: string): Todo[] {
  const value = text.trim();
  if (!value) return [...todos];
  return todos.map((todo) => (todo.id === id ? { ...todo, text: value } : todo));
}

export function removeTodo(todos: readonly Todo[], id: string): Todo[] {
  return todos.filter((todo) => todo.id !== id);
}

export function clearCompleted(todos: readonly Todo[]): Todo[] {
  return todos.filter((todo) => !todo.done);
}
