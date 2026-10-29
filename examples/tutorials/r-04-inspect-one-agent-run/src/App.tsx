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
  const remaining = tasks.filter((task) => !task.done).length;

  useEffect(() => {
    document.title = copy.documentTitle;
    document.documentElement.lang = plingLocale(locale);
  }, [copy.documentTitle, locale]);

  function addTask(): void {
    const text = draft.trim();
    if (!text || tasks.length >= MAX_TASKS) return;
    const task = { id: `t${++sequence.current}`, text, done: false };
    setTasks((current) => [task, ...current]);
    setDraft("");
  }

  function toggleTask(id: string): void {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  const todoScope = usePlingScope<HTMLElement>({
    id: "todo",
    label: copy.regionLabel,
    description: copy.regionDescription,
    role: "main",
  });

  const composerRef = usePlingTool<HTMLInputElement>({
    id: "composer_text",
    desc: copy.composerTextDesc,
    action: "fill",
    params: [{ name: "text", label: copy.textParamLabel }],
  });

  const submitRef = usePlingTool<HTMLButtonElement>({
    id: "composer_submit",
    desc: copy.composerSubmitDesc,
    available: () => {
      if (tasks.length >= MAX_TASKS) return copy.submitFullReason;
      return draft.trim() ? true : copy.submitReason;
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
          onSubmit={(event) => {
            event.preventDefault();
            addTask();
          }}
        >
          <label className="composer__label" htmlFor="new-task">{copy.newTaskLabel}</label>
          <div className="composer__row">
            <input
              id="new-task"
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
              maxLength={80}
              placeholder={copy.placeholder}
            />
            <button
              ref={submitRef}
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
    <li ref={rowRef} className={task.done ? "task is-done" : "task"}>
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
