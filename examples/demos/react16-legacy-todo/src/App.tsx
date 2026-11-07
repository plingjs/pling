import * as React from "react";
import {
  AgentDock,
  PlingRecord,
  PlingScope,
  PlingState,
  PlingTool,
} from "@plingjs/react/legacy";
import { copyFor, initialTodos, type DemoLocale, type TodoItem } from "./copy";

interface AppProps {
  locale: DemoLocale;
  quick: readonly string[];
}

type TodoFilter = "all" | "open" | "completed";

interface AppState {
  todos: TodoItem[];
  draft: string;
  filter: TodoFilter;
  editingId: string | null;
  editDraft: string;
  sidebarOpen: boolean;
}

const DOCK_DEBUG = { maxCalls: 8 } as const;

export class App extends React.Component<AppProps, AppState> {
  private nextId: number;

  constructor(props: AppProps) {
    super(props);
    const todos = initialTodos(props.locale);
    this.nextId = todos.length;
    this.state = {
      todos,
      draft: "",
      filter: "all",
      editingId: null,
      editDraft: "",
      sidebarOpen: true,
    };
  }

  private readonly changeDraft = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ draft: event.target.value });
  };

  private readonly changeEditDraft = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ editDraft: event.target.value });
  };

  private readonly submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    this.addTodo();
  };

  private readonly addTodo = (): void => {
    const text = this.state.draft.trim();
    if (!text) return;
    const id = `t${++this.nextId}`;
    this.setState((state) => ({
      todos: [...state.todos, { id, text, done: false }],
      draft: "",
    }));
  };

  private readonly toggleTodo = (id: string): void => {
    this.setState((state) => ({
      todos: state.todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
    }));
  };

  private readonly removeTodo = (id: string): void => {
    this.setState((state) => ({ todos: state.todos.filter((todo) => todo.id !== id) }));
  };

  private readonly startEdit = (todo: TodoItem): void => {
    this.setState({ editingId: todo.id, editDraft: todo.text });
  };

  private readonly saveEdit = (id: string): void => {
    const text = this.state.editDraft.trim();
    if (!text) return;
    this.setState((state) => ({
      todos: state.todos.map((todo) => (todo.id === id ? { ...todo, text } : todo)),
      editingId: null,
      editDraft: "",
    }));
  };

  private readonly cancelEdit = (): void => {
    this.setState({ editingId: null, editDraft: "" });
  };

  private readonly editKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, id: string): void => {
    if (event.key === "Enter") this.saveEdit(id);
    if (event.key === "Escape") this.cancelEdit();
  };

  private readonly setFilter = (filter: TodoFilter): void => {
    this.setState({ filter });
  };

  private readonly clearCompleted = (): void => {
    this.setState((state) => ({
      todos: state.todos.filter((todo) => !todo.done),
      filter: state.filter === "completed" ? "all" : state.filter,
    }));
  };

  private readonly setSidebarOpen = (sidebarOpen: boolean): void => {
    this.setState({ sidebarOpen });
  };

  private visibleTodos(): TodoItem[] {
    const { filter, todos } = this.state;
    if (filter === "open") return todos.filter((todo) => !todo.done);
    if (filter === "completed") return todos.filter((todo) => todo.done);
    return todos;
  }

  private summary(): Record<string, unknown> {
    const { todos, filter } = this.state;
    const completed = todos.filter((todo) => todo.done).length;
    return {
      total: todos.length,
      open: todos.length - completed,
      completed,
      filter,
    };
  }

  render(): React.ReactNode {
    const copy = copyFor(this.props.locale);
    const visible = this.visibleTodos();
    const completed = this.state.todos.length - this.state.todos.filter((todo) => !todo.done).length;
    const filters = [
      { id: "all" as const, label: copy.filterAll, desc: copy.filterAllDesc },
      { id: "open" as const, label: copy.filterOpen, desc: copy.filterOpenDesc },
      { id: "completed" as const, label: copy.filterCompleted, desc: copy.filterCompletedDesc },
    ];

    return (
      <main className={`legacy-todo${this.state.sidebarOpen ? "" : " is-sidebar-closed"}`}>
        <section className="todo-card" aria-labelledby="todo-title">
          <header className="todo-head">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1 id="todo-title">{copy.title}</h1>
              <p className="subtitle">{copy.subtitle}</p>
            </div>
            <span className="version-chip">react@16.3.0</span>
          </header>

          <PlingState name="summary" source={() => this.summary()} description={copy.stateDescription} />

          <form className="composer" onSubmit={this.submit}>
            <label htmlFor="todo-input">{copy.newItem}</label>
            <div className="composer__row">
              <PlingTool options={{ id: "todo_text", action: "fill", desc: copy.textDesc }}>
                {(ref) => (
                  <input
                    id="todo-input"
                    ref={ref}
                    type="text"
                    autoComplete="off"
                    placeholder={copy.placeholder}
                    value={this.state.draft}
                    onChange={this.changeDraft}
                  />
                )}
              </PlingTool>
              <PlingTool options={{ id: "add_todo", desc: copy.addDesc }}>
                {(ref) => (
                  <button id="add-todo" ref={ref} type="submit" disabled={!this.state.draft.trim()}>
                    {copy.add}
                  </button>
                )}
              </PlingTool>
            </div>
          </form>

          <div className="filters" role="group" aria-label={copy.filterLabel}>
            {filters.map((filter) => (
                <PlingTool key={filter.id} options={{ id: `filter_${filter.id}`, kind: "read", desc: filter.desc }}>
                  {(ref) => (
                    <button
                      ref={ref}
                      type="button"
                      className={this.state.filter === filter.id ? "is-active" : undefined}
                      onClick={() => this.setFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  )}
                </PlingTool>
            ))}
          </div>

          <PlingScope options={{ id: "todos", label: copy.scopeLabel, description: copy.scopeDescription, role: "list" }}>
            {(scopeRef) => (
              <ul id="todo-list" ref={scopeRef} className="todo-list">
                {visible.map((todo) => (
                  <PlingRecord
                    key={todo.id}
                    value={{ id: todo.id, label: todo.text, fields: { text: todo.text, done: todo.done } }}
                  >
                    {(rowRef) => (
                      <li ref={rowRef} className={`todo-row${todo.done ? " is-done" : ""}`}>
                        {this.state.editingId === todo.id ? (
                          <React.Fragment>
                            <PlingTool options={{ id: `edit_text@${todo.id}`, action: "fill", desc: copy.editTextDesc(todo.text) }}>
                              {(ref) => (
                                <input
                                  ref={ref}
                                  className="edit-input"
                                  value={this.state.editDraft}
                                  aria-label={copy.editTextDesc(todo.text)}
                                  onChange={this.changeEditDraft}
                                  onKeyDown={(event) => this.editKeyDown(event, todo.id)}
                                />
                              )}
                            </PlingTool>
                            <span className="row-actions">
                              <PlingTool options={{ id: `save_edit@${todo.id}`, kind: "write", desc: copy.saveEditDesc(todo.text) }}>
                                {(ref) => (
                                  <button ref={ref} type="button" className="save" disabled={!this.state.editDraft.trim()} onClick={() => this.saveEdit(todo.id)}>
                                    {copy.saveEdit}
                                  </button>
                                )}
                              </PlingTool>
                              <button type="button" className="remove" onClick={this.cancelEdit}>{copy.cancelEdit}</button>
                            </span>
                          </React.Fragment>
                        ) : (
                          <React.Fragment>
                            <PlingTool options={{ id: `toggle@${todo.id}`, desc: copy.toggleDesc(todo.text, todo.done) }}>
                              {(ref) => (
                                <label className="todo-check">
                                  <input ref={ref} type="checkbox" checked={todo.done} onChange={() => this.toggleTodo(todo.id)} />
                                  <span>{todo.text}</span>
                                </label>
                              )}
                            </PlingTool>
                            <span className="row-actions">
                              <PlingTool options={{ id: `edit@${todo.id}`, kind: "read", desc: copy.editDesc(todo.text) }}>
                                {(ref) => <button ref={ref} type="button" className="edit" onClick={() => this.startEdit(todo)}>{copy.edit}</button>}
                              </PlingTool>
                              <PlingTool options={{ id: `remove@${todo.id}`, kind: "write", desc: copy.removeDesc(todo.text) }}>
                                {(ref) => <button ref={ref} type="button" className="remove" onClick={() => this.removeTodo(todo.id)}>{copy.remove}</button>}
                              </PlingTool>
                            </span>
                          </React.Fragment>
                        )}
                      </li>
                    )}
                  </PlingRecord>
                ))}
              </ul>
            )}
          </PlingScope>

          {visible.length === 0 ? (
            <p className="empty">{this.state.todos.length === 0 ? copy.empty : copy.emptyFiltered}</p>
          ) : null}

          <footer className="todo-footer">
            <span>{copy.openTotal(this.state.todos.length - completed, this.state.todos.length)}</span>
            <PlingTool options={{ id: "clear_completed", kind: "danger", desc: copy.clearCompletedDesc }}>
              {(ref) => (
                <button ref={ref} type="button" className="clear" disabled={completed === 0} onClick={this.clearCompleted}>
                  {copy.clearCompleted(completed)}
                </button>
              )}
            </PlingTool>
          </footer>
        </section>

        <AgentDock
          layout="sidebar"
          side="right"
          className="todo-sidebar"
          defaultOpen
          title={copy.dockTitle}
          placeholder={copy.dockPlaceholder}
          quick={this.props.quick}
          debug={DOCK_DEBUG}
          modelSettings="readonly"
          onOpenChange={this.setSidebarOpen}
        />
      </main>
    );
  }
}
