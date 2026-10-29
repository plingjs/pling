import { randomUUID } from "node:crypto";

const MAX_TODOS = 50;
const MAX_TEXT = 160;

export class TodoError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "TodoError";
    this.code = code;
    this.status = status;
  }
}

/** Per-user in-memory todo store used only by this demo. */
export class TodoStore {
  #byUser = new Map();

  constructor(options = {}) {
    this.seed = options.seed === false ? [] : options.seed ?? ["Review the launch checklist", "Send the customer follow-up", "Book the design review"];
  }

  list(userId) {
    return this.#items(userId).map(clone);
  }

  create(userId, text) {
    const items = this.#items(userId);
    if (items.length >= MAX_TODOS) throw new TodoError("TODO_LIMIT", `The list can hold at most ${MAX_TODOS} items`, 409);
    const value = normalizeText(text);
    const item = { id: `t_${randomUUID().slice(0, 8)}`, text: value, done: false, createdAt: Date.now() };
    items.unshift(item);
    return clone(item);
  }

  toggle(userId, id) {
    const item = findItem(this.#items(userId), id);
    item.done = !item.done;
    return clone(item);
  }

  remove(userId, id) {
    const items = this.#items(userId);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new TodoError("TODO_NOT_FOUND", "Todo not found", 404);
    const [removed] = items.splice(index, 1);
    return clone(removed);
  }

  clearCompleted(userId) {
    const items = this.#items(userId);
    const before = items.length;
    const next = items.filter((item) => !item.done);
    this.#byUser.set(userId, next);
    return { removed: before - next.length, remaining: next.length };
  }

  #items(userId) {
    let items = this.#byUser.get(userId);
    if (!items) {
      items = this.seed.map((text, index) => ({
        id: `t_${index + 1}`,
        text,
        done: index === 1,
        createdAt: Date.now() - (this.seed.length - index) * 1_000,
      }));
      this.#byUser.set(userId, items);
    }
    return items;
  }
}

function normalizeText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new TodoError("TODO_TEXT_REQUIRED", "Todo text cannot be empty", 400);
  if (text.length > MAX_TEXT) throw new TodoError("TODO_TEXT_TOO_LONG", `Todo text must be at most ${MAX_TEXT} characters`, 400);
  return text;
}

function findItem(items, id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new TodoError("TODO_NOT_FOUND", "Todo not found", 404);
  return item;
}

function clone(value) {
  return { ...value };
}
