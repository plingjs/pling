import { describe, expect, it } from "vitest";
import {
  MAX_TODOS,
  addTodo,
  clearCompleted,
  countTodos,
  createSeedTodos,
  removeTodo,
  toggleTodo,
  updateTodo,
  visibleTodos,
} from "../src/shared/todos";

describe("Daylist business operations", () => {
  it("filters from the same source list without copying state", () => {
    const tasks = createSeedTodos("en");
    expect(visibleTodos(tasks, "open").every((task) => !task.done)).toBe(true);
    expect(visibleTodos(tasks, "completed").every((task) => task.done)).toBe(true);
    expect(visibleTodos(tasks, "all")).toHaveLength(tasks.length);
  });

  it("adds, toggles, edits, removes, and clears tasks", () => {
    let tasks = createSeedTodos("en");
    tasks = addTodo(tasks, "Write the handoff note");
    const added = tasks.at(-1)!;
    expect(added.text).toBe("Write the handoff note");

    tasks = toggleTodo(tasks, added.id);
    expect(tasks.find((task) => task.id === added.id)?.done).toBe(true);

    tasks = updateTodo(tasks, added.id, "Write the release handoff");
    expect(tasks.find((task) => task.id === added.id)?.text).toBe("Write the release handoff");

    const beforeRemove = tasks.length;
    tasks = removeTodo(tasks, added.id);
    expect(tasks).toHaveLength(beforeRemove - 1);

    tasks = clearCompleted(tasks);
    expect(tasks.every((task) => !task.done)).toBe(true);
  });

  it("keeps the list within its stated capacity", () => {
    let tasks = createSeedTodos("en");
    while (tasks.length < MAX_TODOS) tasks = addTodo(tasks, `Task ${tasks.length + 1}`);
    const full = addTodo(tasks, "One too many");
    expect(full).toHaveLength(MAX_TODOS);
    expect(countTodos(full).total).toBe(MAX_TODOS);
  });
});
