import { useEffect, useState } from "react";
import { TodoAssistant } from "./TodoAssistant";
import { copyFor, plingLocale, type DemoLocale } from "./copy";
import { countTasks, createSeedTasks, type Task } from "./todo";

export interface AppProps {
  locale: DemoLocale;
}

export function App({ locale }: AppProps) {
  const copy = copyFor(locale);
  const [tasks, setTasks] = useState<Task[]>(() => createSeedTasks(locale));
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);
  const counts = countTasks(tasks);

  useEffect(() => {
    document.documentElement.lang = plingLocale(locale);
    document.title = locale === "zh" ? "Next.js 与服务端渲染 · Pling" : "Next.js and SSR · Pling";
    setMounted(true);
  }, [locale]);

  function add(text: string): void {
    const value = text.trim();
    if (!value) return;
    const next: Task = { id: `t${Date.now()}`, text: value, done: false };
    setTasks((current) => [next, ...current]);
  }

  function toggle(id: string): void {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  }

  function clearCompleted(): void {
    setTasks((current) => current.filter((task) => !task.done));
  }

  function submitDraft(): void {
    if (!draft.trim()) return;
    add(draft);
    setDraft("");
  }

  return (
    <main className="page">
      <section className="todo">
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
            <li key={task.id} className={task.done ? "done" : undefined}>
              <label>
                <input type="checkbox" checked={task.done} onChange={() => toggle(task.id)} />
                <span>{task.text}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="footer">
          <button type="button" onClick={clearCompleted}>{copy.clear}</button>
          <span>{copy.completed(counts.completed)}</span>
        </div>
      </section>

      <p className="client-note">{copy.clientNote}</p>
      {mounted ? (
        <TodoAssistant
          locale={locale}
          tasks={tasks}
          counts={counts}
          onAdd={add}
          onToggle={toggle}
          onClear={clearCompleted}
        />
      ) : null}
    </main>
  );
}
