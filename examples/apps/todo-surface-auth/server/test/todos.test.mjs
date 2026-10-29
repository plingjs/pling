import assert from "node:assert/strict";
import test from "node:test";
import { TodoError, TodoStore } from "../todos.mjs";

test("keeps Todo lists isolated per user", () => {
  const todos = new TodoStore();
  const first = todos.list("u1");
  const second = todos.list("u2");

  assert.deepEqual(first.map((todo) => todo.id), ["t_1", "t_2", "t_3"]);
  todos.create("u1", "Only for u1");
  assert.equal(todos.list("u1").length, 4);
  assert.equal(todos.list("u2").length, 3);
  assert.deepEqual(second, todos.list("u2"));
});

test("creates newest first and supports toggle, remove, and clear", () => {
  const todos = new TodoStore({ seed: ["one", "two"] });
  const created = todos.create("u1", "  three  ");
  assert.equal(created.text, "three");
  assert.equal(todos.list("u1")[0].id, created.id);

  assert.equal(todos.toggle("u1", created.id).done, true);
  assert.deepEqual(todos.clearCompleted("u1"), { removed: 2, remaining: 1 });
  assert.deepEqual(todos.list("u1").map((todo) => todo.text), ["one"]);

  const removed = todos.remove("u1", "t_1");
  assert.equal(removed.text, "one");
  assert.throws(
    () => todos.remove("u1", "t_1"),
    (error) => error instanceof TodoError && error.code === "TODO_NOT_FOUND",
  );
});

test("validates text and enforces the list limit", () => {
  const todos = new TodoStore({ seed: false });
  assert.throws(() => todos.create("u1", "   "), (error) => error instanceof TodoError && error.code === "TODO_TEXT_REQUIRED");
  assert.throws(
    () => todos.create("u1", "x".repeat(161)),
    (error) => error instanceof TodoError && error.code === "TODO_TEXT_TOO_LONG",
  );

  for (let index = 0; index < 50; index += 1) todos.create("u1", `task ${index}`);
  assert.throws(
    () => todos.create("u1", "one too many"),
    (error) => error instanceof TodoError && error.code === "TODO_LIMIT" && error.status === 409,
  );
});
