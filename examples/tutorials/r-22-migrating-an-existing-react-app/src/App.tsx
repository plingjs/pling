import { useEffect, useRef, useState } from "react";
import {
  AgentDock,
  usePlingRecord,
  usePlingScope,
  usePlingState,
  usePlingTool,
} from "@plingjs/react";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";
import {
  addTask,
  countTasks,
  createSeedTasks,
  MAX_TASKS,
  toggleTask,
  type Task,
} from "./todo";

export interface AppProps {
  locale?: DemoLocale;
}

export function App({ locale = resolveDemoLocale() }: AppProps) {
  const copy = copyFor(locale);
  const [tasks, setTasks] = useState<Task[]>(() => createSeedTasks(locale));
  const [draft, setDraft] = useState("");
  const sequence = useRef(3);
  const lastAddedId = useRef<string | null>(null);
  const counts = countTasks(tasks);

  useEffect(() => {
    document.title = locale === "zh" ? "在存量 React 应用中接入 Pling" : "Migrating an existing React app · Pling";
    document.documentElement.lang = plingLocale(locale);
  }, [locale]);

  usePlingState(
    "todo_migration",
    () => ({ ...counts, visibleIds: tasks.map((task) => task.id) }),
    { description: copy.stateDescription },
  );

  function submitDraft(): string | null {
    const next = addTask(tasks, draft, `t${++sequence.current}`);
    if (!next) return null;
    lastAddedId.current = next[0]?.id ?? null;
    setTasks(next);
    setDraft("");
    return lastAddedId.current;
  }

  const todoScope = usePlingScope<HTMLElement>({
    id: "todo",
    label: copy.region,
    description: copy.regionDescription,
    role: "main",
  });
  const draftRef = usePlingTool<HTMLInputElement>({
    id: "draft_text",
    desc: copy.draftDescription,
    kind: "write",
  });
  const submitRef = usePlingTool<HTMLFormElement>({
    id: "submit_task",
    desc: copy.submitDescription,
    kind: "write",
    available: () => tasks.length < MAX_TASKS ? true : copy.listFull(MAX_TASKS),
    run: () => { submitDraft(); },
    expect: {
      desc: copy.addExpect,
      check: () =>
        lastAddedId.current !== null &&
        tasks.some((task) => task.id === lastAddedId.current),
    },
  });

  function toggle(id: string): void {
    setTasks((current) => toggleTask(current, id));
  }

  function exportCsv(): void {
    const csv = tasks.map((task) => `${task.id},${task.text},${task.done}`).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "todos.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <section className="workspace" ref={todoScope}>
        <header className="head">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="lead">{copy.lead}</p>
          </div>
          <span className="counter">{copy.counter(counts.open)}</span>
        </header>

        <form
          className="composer"
          ref={submitRef}
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <input
            ref={draftRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={copy.newTask}
            aria-label={copy.newTask}
            maxLength={80}
          />
          <button type="submit" disabled={!draft.trim() || tasks.length >= MAX_TASKS}>
            {copy.add}
          </button>
        </form>

        <ul className="tasks">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} copy={copy} onToggle={toggle} />
          ))}
        </ul>

        <footer className="manual">
          <button type="button" data-pling-ignore onClick={exportCsv}>{copy.export}</button>
          <p>{copy.exportNote}</p>
        </footer>
      </section>

      <aside className="ledger" aria-labelledby="ledger-title">
        <p className="eyebrow">{copy.migration}</p>
        <h2 id="ledger-title">{copy.migrationTitle}</h2>
        <p>{copy.migrationLead}</p>
        <ol>
          {copy.steps.map(([title, detail], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{title}</strong><p>{detail}</p></div>
            </li>
          ))}
        </ol>
      </aside>

      <AgentDock title={copy.dockTitle} quick={[...copy.quick]} debug={{ maxCalls: 8 }} />
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
    fields: { text: task.text, status: task.done ? "completed" : "open" },
  });
  const toggleRef = usePlingTool<HTMLInputElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggle(task.text, task.done),
    kind: "write",
  });

  return (
    <li ref={rowRef} className={task.done ? "done" : undefined}>
      <label>
        <input
          ref={toggleRef}
          type="checkbox"
          checked={task.done}
          onChange={() => onToggle(task.id)}
        />
        <span>{task.text}</span>
      </label>
    </li>
  );
}
