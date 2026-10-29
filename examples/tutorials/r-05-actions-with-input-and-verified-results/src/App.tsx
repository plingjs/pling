import { useEffect, useRef, useState } from "react";
import {
  AgentDock,
  usePlingRecord,
  usePlingScope,
  usePlingTool,
} from "@plingjs/react";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale, type DemoTask } from "./copy";

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
  const sequence = useRef(copy.seedTasks.length);
  const lastAddedId = useRef<string | null>(null);
  const remaining = tasks.filter((task) => !task.done).length;

  useEffect(() => {
    document.title = copy.documentTitle;
    document.documentElement.lang = plingLocale(locale);
  }, [copy.documentTitle, locale]);

  function addTask(value: string): Task | null {
    const text = value.trim();
    if (!text || tasks.length >= MAX_TASKS) return null;
    const task = { id: `t${++sequence.current}`, text, done: false };
    setTasks((current) => [task, ...current]);
    return task;
  }

  function submitDraft(): void {
    if (addTask(draft)) setDraft("");
  }

  function toggleTask(id: string): void {
    setTasks((current) => current.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task
    ));
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
      lastAddedId.current = addTask(String(args.text))?.id ?? null;
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

  return (
    <main className="page">
      <section className="todo" ref={todoScope}>
        <header className="todo__header">
          <div>
            <p className="todo__eyebrow">{copy.eyebrow}</p>
            <h1>{copy.heading}</h1>
          </div>
          <p className="todo__count">{copy.stats(remaining)}</p>
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
            <button
              type="submit"
              disabled={!draft.trim() || tasks.length >= MAX_TASKS}
            >
              {copy.addTask}
            </button>
          </div>
        </form>

        <ul className="tasks">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} copy={copy} onToggle={toggleTask} />
          ))}
        </ul>

        {tasks.length === 0 ? <p className="tasks__empty">{copy.empty}</p> : null}
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
      <span className="task__text">{task.text}</span>
    </li>
  );
}
