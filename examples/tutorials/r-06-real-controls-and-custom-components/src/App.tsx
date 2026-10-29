import { useEffect, useMemo, useRef, useState } from "react";
import {
  AgentDock,
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

const MAX_TASKS = 8;

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
  const sequence = useRef(copy.seedTasks.length);
  const lastAddedId = useRef<string | null>(null);

  const remaining = tasks.filter((task) => !task.done).length;
  const completed = tasks.length - remaining;

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

  function applySearch(): void {
    setAppliedSearch(searchDraft.trim());
  }

  function clearCompleted(): void {
    setTasks((current) => current.filter((task) => !task.done));
  }

  const todoScope = usePlingScope<HTMLElement>({
    id: "todo",
    label: copy.regionLabel,
    description: copy.regionDescription,
    role: "main",
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
    available: () => tasks.length < MAX_TASKS ? true : copy.addTaskFullReason,
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
  });
  const searchEnterRef = usePlingTool<HTMLDivElement>({
    id: "search_enter",
    desc: copy.searchEnterDesc,
    kind: "write",
    action: "press",
    key: "Enter",
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

  return (
    <main className="page">
      <section className="todo" ref={todoScope}>
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
          ref={addTaskRef}
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

        <ul className="tasks">
          {visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              copy={copy}
              onToggle={toggleTask}
            />
          ))}
        </ul>

        {visibleTasks.length === 0 ? (
          <p className="tasks__empty">{copy.empty}</p>
        ) : null}

        <footer className="todo__footer">
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
    </main>
  );
}

function TaskRow({ task, copy, onToggle }: {
  task: Task;
  copy: ReturnType<typeof copyFor>;
  onToggle: (id: string) => void;
}) {
  const rowRef = usePlingRecord<HTMLLIElement>({
    data: task,
    fields: {
      text: task.text,
      status: task.done ? copy.completedLabel : copy.openLabel,
      priority: copy.priorities[task.priority],
    },
  });
  const toggleRef = usePlingTool<HTMLButtonElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text, task.done),
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
    </li>
  );
}
