import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AgentDock,
  useAgentTool,
  usePlingRecord,
  usePlingScope,
  usePlingTool,
} from "@plingjs/react";
import { BulkMenu } from "./components/BulkMenu";
import { SearchBox } from "./components/SearchBox";
import { TaskFilters, type TaskFilter } from "./components/TaskFilters";
import {
  copyFor,
  plingLocale,
  resolveDemoLocale,
  type DemoLocale,
  type DemoTask,
  type Priority,
} from "./copy";
import { mergeRefs } from "./refs";

interface Task extends DemoTask {
  id: string;
}

const MAX_TASKS = 40;

export interface AppProps {
  locale?: DemoLocale;
}

export function App({ locale = resolveDemoLocale() }: AppProps) {
  const copy = copyFor(locale);
  const [tasks, setTasks] = useState<Task[]>(() =>
    copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })),
  );
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState<Priority>("soon");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const sequence = useRef(copy.seedTasks.length);
  const lastAddedId = useRef<string | null>(null);
  const lastSavedEdit = useRef<{ id: string; text: string } | null>(null);
  const editInput = useRef<HTMLInputElement | null>(null);
  const tasksRef = useRef(tasks);
  const editingIdRef = useRef<string | null>(editingId);
  tasksRef.current = tasks;
  editingIdRef.current = editingId;

  const remaining = tasks.filter((task) => !task.done).length;
  const completed = tasks.length - remaining;
  const editingTask = tasks.find((task) => task.id === editingId) ?? null;

  const visibleTasks = useMemo(() => {
    const needle = appliedSearch.toLocaleLowerCase();
    return tasks.filter((task) => {
      if (filter === "active" && task.done) return false;
      if (filter === "completed" && !task.done) return false;
      return needle === "" || task.text.toLocaleLowerCase().includes(needle);
    });
  }, [appliedSearch, filter, tasks]);

  useEffect(() => {
    document.title = copy.documentTitle;
    document.documentElement.lang = plingLocale(locale);
  }, [copy.documentTitle, locale]);

  useEffect(() => {
    if (!editingId) return;
    editInput.current?.focus();
    editInput.current?.select();
  }, [editingId]);

  function addTask(value: string, nextPriority: Priority): Task | null {
    const text = value.trim();
    if (!text || tasks.length >= MAX_TASKS) return null;
    const task = {
      id: `t${++sequence.current}`,
      text,
      done: false,
      priority: nextPriority,
    };
    setTasks((current) => [task, ...current]);
    return task;
  }

  function submitDraft(): void {
    if (addTask(draft, priority)) setDraft("");
  }

  function toggleTask(id: string): void {
    setTasks((current) => current.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task
    ));
  }

  function removeTask(id: string): void {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  function applySearch(): void {
    setAppliedSearch(searchDraft.trim());
  }

  function clearCompleted(): void {
    setTasks((current) => current.filter((task) => !task.done));
  }

  function completeOpenTasks(): number {
    const current = tasksRef.current;
    const openTasks = current.filter((task) => !task.done);
    const next = current.map((task) =>
      task.done ? task : { ...task, done: true }
    );
    tasksRef.current = next;
    setTasks(next);
    return openTasks.length;
  }

  function openEdit(id: string): void {
    const task = tasksRef.current.find((item) => item.id === id);
    if (!task) return;
    editingIdRef.current = id;
    setEditingId(id);
    setEditText(task.text);
  }

  function saveEdit(): void {
    const id = editingIdRef.current;
    const value = editText.trim();
    if (!id || !value) return;
    const current = tasksRef.current;
    if (!current.some((task) => task.id === id)) return;
    const next = current.map((task) =>
      task.id === id ? { ...task, text: value } : task
    );
    tasksRef.current = next;
    setTasks(next);
    lastSavedEdit.current = { id, text: value };
    editingIdRef.current = null;
    setEditingId(null);
    setEditText("");
  }

  function cancelEdit(): void {
    editingIdRef.current = null;
    setEditingId(null);
    setEditText("");
  }

  const todoScope = usePlingScope<HTMLElement>({
    id: "todo",
    label: copy.todoRegionLabel,
    description: copy.todoRegionDescription,
    role: "main",
  });
  const composerScope = usePlingScope<HTMLFormElement>({
    id: "composer",
    label: copy.composerRegionLabel,
    description: copy.composerRegionDescription,
    role: "form",
  });
  const taskListScope = usePlingScope<HTMLUListElement>({
    id: "task_list",
    label: copy.listRegionLabel,
    description: copy.listRegionDescription,
    role: "list",
  });
  const viewControlsScope = usePlingScope<HTMLElement>({
    id: "view_controls",
    label: copy.controlsRegionLabel,
    description: copy.controlsRegionDescription,
    role: "toolbar",
  });
  const editDialogScope = usePlingScope<HTMLDivElement>({
    id: "edit_dialog",
    label: copy.editDialogLabel,
    description: copy.editDialogDescription,
    role: "dialog",
    parent: "todo",
  });

  const addTaskRef = usePlingTool<HTMLFormElement>({
    id: "add_task",
    desc: copy.addTaskDesc,
    kind: "write",
    params: [{
      name: "text",
      label: copy.addTaskParamLabel,
      minLength: 1,
      maxLength: 80,
      pattern: /\S/,
    }],
    available: () =>
      tasks.length < MAX_TASKS ? true : copy.addTaskFullReason(MAX_TASKS),
    run: (args: Record<string, unknown>) => {
      lastAddedId.current = addTask(String(args.text), priority)?.id ?? null;
    },
    expect: {
      desc: copy.addTaskExpect,
      check: () =>
        lastAddedId.current !== null &&
        Boolean(document.querySelector(
          `[data-task-id="${lastAddedId.current}"]`,
        )),
    },
  });

  const priorityRef = usePlingTool<HTMLSelectElement>({
    id: "select_priority",
    desc: copy.selectPriorityDesc,
    kind: "write",
    action: "select",
    params: [{
      name: "value",
      label: copy.selectPriorityParamLabel,
      values: ["today", "soon", "later"],
    }],
  });

  const searchTextRef = usePlingTool<HTMLDivElement>({
    id: "search_text",
    desc: copy.searchTextDesc,
    kind: "write",
    action: "fill",
    scope: "view_controls",
  });
  const searchEnterRef = usePlingTool<HTMLDivElement>({
    id: "search_enter",
    desc: copy.searchEnterDesc,
    kind: "write",
    action: "press",
    key: "Enter",
    scope: "view_controls",
  });
  const searchRef = useMemo(
    () => mergeRefs(searchTextRef, searchEnterRef),
    [searchEnterRef, searchTextRef],
  );

  const showAllRef = usePlingTool<HTMLDivElement>({
    id: "show_all_tasks",
    desc: copy.showAllDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="all"]',
  });
  const showOpenRef = usePlingTool<HTMLDivElement>({
    id: "show_open_tasks",
    desc: copy.showOpenDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="active"]',
  });
  const showCompletedRef = usePlingTool<HTMLDivElement>({
    id: "show_completed_tasks",
    desc: copy.showCompletedDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="completed"]',
  });
  const filtersRef = useMemo(
    () => mergeRefs(showAllRef, showOpenRef, showCompletedRef),
    [showAllRef, showCompletedRef, showOpenRef],
  );

  const openBulkMenuRef = usePlingTool<HTMLDivElement>({
    id: "open_bulk_menu",
    desc: copy.openBulkMenuDesc,
    kind: "read",
    action: "hover",
    fidelity: "high",
  });
  const clearCompletedRef = usePlingTool<HTMLButtonElement>({
    id: "clear_completed",
    desc: copy.clearCompletedDesc,
    kind: "danger",
  });

  const editTextRef = usePlingTool<HTMLInputElement>({
    id: "edit_note",
    desc: copy.editTextDesc,
    kind: "write",
    action: "fill",
    scope: "edit_dialog",
  });
  const editSaveRef = usePlingTool<HTMLButtonElement>({
    id: "edit_save",
    desc: copy.editSaveDesc,
    kind: "write",
    scope: "edit_dialog",
    run: saveEdit,
    expect: {
      desc: copy.editSaveExpect,
      check: () => {
        const saved = lastSavedEdit.current;
        return saved !== null &&
          editingIdRef.current === null &&
          tasksRef.current.some(
            (task) => task.id === saved.id && task.text === saved.text,
          );
      },
    },
  });
  const editCancelRef = usePlingTool<HTMLButtonElement>({
    id: "edit_cancel",
    desc: copy.editCancelDesc,
    kind: "read",
    scope: "edit_dialog",
  });

  useAgentTool({
    id: "complete_open_tasks",
    desc: copy.completeOpenDesc,
    kind: "write",
    available: () =>
      editingIdRef.current !== null
        ? copy.editOpenBlocked
        : tasksRef.current.some((task) => !task.done)
          ? true
          : copy.completeOpenNone,
    run: () => ({ completed: completeOpenTasks() }),
    expect: {
      desc: copy.completeOpenExpect,
      check: () => tasksRef.current.every((task) => task.done),
    },
  });

  return (
    <main className="page">
      <section
        className="todo"
        ref={todoScope}
        inert={editingTask ? true : undefined}
        aria-hidden={editingTask ? "true" : undefined}
      >
        <header className="todo__header">
          <div>
            <p className="todo__eyebrow">{copy.eyebrow}</p>
            <h1>{copy.heading}</h1>
          </div>
          <p className="todo__count">
            {copy.stats(remaining, completed)}
            {appliedSearch ? ` · “${appliedSearch}”` : null}
          </p>
        </header>

        <form
          className="composer"
          ref={mergeRefs(composerScope, addTaskRef)}
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <label className="composer__label" htmlFor="new-task">{copy.newTaskLabel}</label>
          <div className="composer__row">
            <input
              id="new-task"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
              maxLength={80}
              placeholder={copy.placeholder}
            />
            <select
              id="task-priority"
              ref={priorityRef}
              value={priority}
              aria-label={copy.priorityAria}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="today">{copy.priorities.today}</option>
              <option value="soon">{copy.priorities.soon}</option>
              <option value="later">{copy.priorities.later}</option>
            </select>
            <button
              type="submit"
              disabled={!draft.trim() || tasks.length >= MAX_TASKS}
            >
              {copy.addTask}
            </button>
          </div>
        </form>

        <SearchBox
          ref={searchRef}
          value={searchDraft}
          label={copy.searchLabel}
          placeholder={copy.searchPlaceholder}
          onChange={setSearchDraft}
          onSearch={applySearch}
        />

        <ul
          className="tasks"
          ref={taskListScope}
          tabIndex={0}
          aria-label={copy.listRegionLabel}
        >
          {visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              copy={copy}
              onToggle={toggleTask}
              onEdit={openEdit}
              onRemove={removeTask}
            />
          ))}
        </ul>

        {visibleTasks.length === 0 ? (
          <p className="tasks__empty">{copy.empty}</p>
        ) : null}

        <footer className="todo__footer" ref={viewControlsScope}>
          <TaskFilters
            ref={filtersRef}
            value={filter}
            groupLabel={copy.filterGroupLabel}
            labels={copy.filters}
            onChange={setFilter}
          />
          <BulkMenu
            ref={openBulkMenuRef}
            label={copy.bulkLabel}
            clearLabel={copy.clearCompletedLabel(completed)}
            clearRef={clearCompletedRef}
            completed={completed}
            onClear={clearCompleted}
          />
        </footer>
      </section>

      <AgentDock
        title={copy.dockTitle}
        quick={copy.quick}
        debug={{ maxCalls: 8 }}
      />

      {editingTask && typeof document !== "undefined" ? createPortal(
        <div
          className="overlay"
          ref={editDialogScope}
          onClick={(event) => {
            if (event.target === event.currentTarget) cancelEdit();
          }}
        >
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-title"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              cancelEdit();
            }}
          >
            <h2 id="edit-task-title">{copy.editDialogTitle(editingTask.text)}</h2>
            <label className="dialog__label" htmlFor="edit-task-text">
              {copy.editTextLabel}
            </label>
            <input
              id="edit-task-text"
              ref={mergeRefs(editTextRef, editInput)}
              value={editText}
              maxLength={80}
              autoComplete="off"
              placeholder={copy.editTextPlaceholder}
              onChange={(event) => setEditText(event.target.value)}
            />
            <div className="dialog__actions">
              <button
                className="dialog__cancel"
                type="button"
                ref={editCancelRef}
                onClick={cancelEdit}
              >
                {copy.editCancel}
              </button>
              <button
                className="dialog__save"
                type="button"
                ref={editSaveRef}
                disabled={!editText.trim()}
                onClick={saveEdit}
              >
                {copy.editSave}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </main>
  );
}

function TaskRow({
  task,
  copy,
  onToggle,
  onEdit,
  onRemove,
}: {
  task: Task;
  copy: ReturnType<typeof copyFor>;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const rowRef = usePlingRecord<HTMLLIElement>({
    data: task,
    fields: {
      text: task.text,
      status: task.done ? "completed" : "open",
      priority: copy.priorities[task.priority],
    },
  });
  const toggleRef = usePlingTool<HTMLButtonElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text, task.done),
  });
  const editRef = usePlingTool<HTMLButtonElement>({
    id: `edit@${task.id}`,
    desc: copy.editTaskDesc(task.text),
    kind: "read",
  });
  const removeRef = usePlingTool<HTMLButtonElement>({
    id: `remove@${task.id}`,
    desc: copy.removeDesc(task.text),
    kind: "danger",
  });

  return (
    <li
      ref={rowRef}
      className={task.done ? "task is-done" : "task"}
      data-task-id={task.id}
    >
      <button
        ref={toggleRef}
        type="button"
        className="task__check"
        aria-label={copy.toggleDesc(task.text, task.done)}
        onClick={() => onToggle(task.id)}
      >
        {task.done ? "✓" : ""}
      </button>
      <span className="task__body">
        <span className="task__text">{task.text}</span>
        <span className={`task__priority priority--${task.priority}`}>
          {copy.priorities[task.priority]}
        </span>
      </span>
      <span className="task__actions">
        <button
          ref={editRef}
          type="button"
          className="task__edit"
          aria-label={copy.editTaskAria(task.text)}
          onClick={() => onEdit(task.id)}
        >
          ✎
        </button>
        <button
          ref={removeRef}
          type="button"
          className="task__remove"
          aria-label={copy.deleteTaskAria(task.text)}
          onClick={() => onRemove(task.id)}
        >
          ×
        </button>
      </span>
    </li>
  );
}
