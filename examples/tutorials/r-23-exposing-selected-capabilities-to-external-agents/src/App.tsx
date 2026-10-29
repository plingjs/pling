import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AgentDock,
  useAgentTool,
  usePling,
  usePlingRecord,
  usePlingScope,
  usePlingTool,
} from "@plingjs/react";
import type { AgentSurface } from "@plingjs/surface";
import { createApproval } from "./approval";
import { copyFor, resolveDemoLocale, type DemoLocale } from "./copy";
import { ExternalConsole } from "./ExternalConsole";
import { createTodoSurface } from "./surface";
import { addTask, countTasks, createSeedTasks, removeTask, toggleTask, type Task } from "./todo";

export interface AppHandle {
  surface: AgentSurface;
}

export interface AppProps {
  locale?: DemoLocale;
}

export const App = forwardRef<AppHandle, AppProps>(function App(
  { locale = resolveDemoLocale() },
  ref,
) {
  const copy = copyFor(locale);
  const pling = usePling();
  const approval = useMemo(createApproval, []);
  const pending = useSyncExternalStore(approval.subscribe, approval.current, approval.current);
  const { surface } = useMemo(
    () => createTodoSurface(pling.registry, approval.confirm),
    [approval, pling.registry],
  );
  const [tasks, setTasks] = useState<Task[]>(() => createSeedTasks(locale));
  const [draft, setDraft] = useState("");
  const [sequence, setSequence] = useState(3);
  const counts = countTasks(tasks);

  useImperativeHandle(ref, () => ({ surface }));

  function add(text: string): void {
    const nextId = `t${sequence + 1}`;
    const next = addTask(tasks, text, nextId);
    if (!next) return;
    setTasks(next);
    setSequence((value) => value + 1);
  }

  function submitDraft(): void {
    if (!draft.trim()) return;
    add(draft);
    setDraft("");
  }

  function toggle(id: string): void {
    setTasks((current) => toggleTask(current, id));
  }

  function remove(id: string): void {
    setTasks((current) => removeTask(current, id));
  }

  function clearCompleted(): void {
    setTasks((current) => current.filter((task) => !task.done));
  }

  const todoScope = usePlingScope<HTMLElement>({
    id: "todo",
    label: copy.region,
    description: copy.regionDescription,
    role: "main",
  });

  useAgentTool({
    id: "todo.overview",
    desc: copy.overview,
    kind: "read",
    run: () => ({
      ...counts,
      records: tasks.map((task) => ({ id: task.id, text: task.text, done: task.done })),
    }),
  });
  useAgentTool({
    id: "todo.add",
    desc: copy.addDescription,
    kind: "write",
    params: [{ name: "text", label: copy.taskLabel, minLength: 1, maxLength: 80 }],
    run: (args: Record<string, unknown>) => add(String(args.text)),
  });

  return (
    <main className="page">
      <section className="weekly" ref={todoScope}>
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
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={copy.newTask}
            aria-label={copy.newTask}
            maxLength={80}
          />
          <button type="submit" disabled={!draft.trim()}>{copy.add}</button>
        </form>

        <ul className="tasks">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} copy={copy} onToggle={toggle} onRemove={remove} />
          ))}
        </ul>

        <div className="footer">
          <ClearButton copy={copy} onClear={clearCompleted} />
          <span>{copy.completed(counts.completed)}</span>
        </div>
      </section>

      <ExternalConsole surface={surface} copy={copy} />

      {pending ? (
        <aside className="approval" role="alertdialog" aria-modal="true" data-testid="approval">
          <p className="eyebrow">{copy.approvalEyebrow}</p>
          <h3>{pending.description}</h3>
          <code>{pending.id}</code>
          <p>{copy.approvalHint}</p>
          <div className="approval__actions">
            <button type="button" data-testid="approval-deny" onClick={() => approval.decide(false)}>{copy.deny}</button>
            <button type="button" className="primary" data-testid="approval-allow" onClick={() => approval.decide(true)}>{copy.allow}</button>
          </div>
        </aside>
      ) : null}

      <AgentDock title={copy.dockTitle} quick={[...copy.quick]} debug={{ maxCalls: 8 }} />
    </main>
  );
});

function TaskRow({ task, copy, onToggle, onRemove }: {
  task: Task;
  copy: ReturnType<typeof copyFor>;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const rowRef = usePlingRecord<HTMLLIElement>({
    data: task,
    fields: { text: task.text, status: task.done ? "completed" : "open" },
  });
  const toggleRef = usePlingTool<HTMLInputElement>({
    id: `todo.toggle@task:${task.id}`,
    desc: copy.toggle(task.text, task.done),
    kind: "write",
  });
  const removeRef = usePlingTool<HTMLButtonElement>({
    id: `todo.remove@task:${task.id}`,
    desc: copy.remove(task.text),
    kind: "danger",
    confirm: "always",
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
      <button ref={removeRef} type="button" className="remove" onClick={() => onRemove(task.id)}>×</button>
    </li>
  );
}

function ClearButton({ copy, onClear }: {
  copy: ReturnType<typeof copyFor>;
  onClear: () => void;
}) {
  const ref = usePlingTool<HTMLButtonElement>({
    id: "todo.clear_completed",
    desc: copy.clearDescription,
    kind: "danger",
    confirm: "always",
  });
  return <button ref={ref} type="button" onClick={onClear}>{copy.clear}</button>;
}
