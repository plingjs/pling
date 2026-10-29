import { useEffect, useRef, useState } from "react";
import {
  AgentDock,
  useAgentTool,
  usePlingRecord,
  usePlingScope,
  usePlingTool,
} from "@plingjs/react";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";
import { evaluateRelease, previewConfig } from "./release";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

export interface AppProps {
  locale?: DemoLocale;
}

export function App({ locale = resolveDemoLocale() }: AppProps) {
  const copy = copyFor(locale);
  const [tasks, setTasks] = useState<Task[]>(() => copy.taskTexts.map((text, index) => ({
    id: `t${index + 1}`,
    text,
    done: index === 1,
  })));
  const [draft, setDraft] = useState("");
  const sequence = useRef(copy.taskTexts.length);
  const lastAddedId = useRef<string | null>(null);
  const review = evaluateRelease(previewConfig, locale);
  const openCount = tasks.filter((task) => !task.done).length;

  useEffect(() => {
    document.title = locale === "zh" ? "Pling · React 生产上线" : "Pling · React production release";
    document.documentElement.lang = plingLocale(locale);
  }, [locale]);

  function addTask(value: string): void {
    const text = value.trim();
    if (!text) return;
    const id = `t${++sequence.current}`;
    lastAddedId.current = id;
    setTasks((current) => [{ id, text, done: false }, ...current]);
  }

  function submitDraft(): void {
    if (!draft.trim()) return;
    addTask(draft);
    setDraft("");
  }

  function toggleTask(id: string): void {
    setTasks((current) => current.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task
    ));
  }

  const todoScope = usePlingScope<HTMLElement>({
    id: "todo",
    label: copy.region,
    role: "main",
  });
  const addTaskRef = usePlingTool<HTMLFormElement>({
    id: "add_task",
    desc: copy.addDescription,
    kind: "write",
    params: [{ name: "text", label: copy.addParam, minLength: 1, maxLength: 80 }],
    run: (args: Record<string, unknown>) => addTask(String(args.text)),
    expect: {
      desc: locale === "zh" ? "新待办已经出现在列表中" : "The new task is present in the list",
      check: () =>
        lastAddedId.current !== null &&
        Boolean(document.querySelector(`[data-task-id="${lastAddedId.current}"]`)),
    },
  });

  useAgentTool({
    id: "release_status",
    desc: copy.statusDescription,
    kind: "read",
    run: () => ({
      ready: review.ready,
      failing: review.checks.filter((check) => check.status === "fail").map((check) => check.id),
    }),
  });

  const failed = review.checks.filter((check) => check.status === "fail").length;
  return (
    <main className="page">
      <section className="todo" ref={todoScope}>
        <header className="head">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="lead">{copy.lead}</p>
          </div>
          <span className="counter">{copy.open(openCount)}</span>
        </header>

        <form
          className="composer"
          ref={addTaskRef}
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={80}
            placeholder={copy.newTask}
            aria-label={copy.newTask}
          />
          <button type="submit" disabled={!draft.trim()}>{copy.add}</button>
        </form>

        <ul className="tasks">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} copy={copy} onToggle={toggleTask} />
          ))}
        </ul>
      </section>

      <section className="release" aria-labelledby="release-title" data-pling-ignore>
        <div className="release__head">
          <div>
            <p className="eyebrow">{copy.releaseEyebrow}</p>
            <h2 id="release-title">{review.ready ? copy.ready : copy.blocked}</h2>
          </div>
          <span className={review.ready ? "badge badge--ok" : "badge badge--bad"}>
            {copy.failed(failed)}
          </span>
        </div>
        <ul className="checks">
          {review.checks.map((check) => (
            <li key={check.id} className={`check--${check.status}`}>
              <span className="dot" aria-hidden="true" />
              <div><strong>{check.label}</strong><p>{check.detail}</p></div>
            </li>
          ))}
        </ul>
        <p className="release__note">{copy.note}</p>
      </section>

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
    fields: { text: task.text, status: task.done ? "done" : "open" },
  });
  const toggleRef = usePlingTool<HTMLInputElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggle(task.text, task.done),
  });

  return (
    <li ref={rowRef} className={task.done ? "done" : undefined} data-task-id={task.id}>
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
