import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AgentDock, usePling } from "@plingjs/react";
import { PublishPanel } from "./components/PublishPanel";
import {
  copyFor,
  plingLocale,
  resolveDemoLocale,
  type DemoLocale,
  type Priority,
} from "./copy";
import { AppRoutes, pageIdentityFor } from "./router";
import { MAX_TASKS, type Task } from "./tasks";

export interface AppProps {
  locale?: DemoLocale;
}

export function App({ locale = resolveDemoLocale() }: AppProps) {
  const copy = copyFor(locale);
  const pling = usePling();
  const location = useLocation();
  const [tasks, setTasks] = useState<Task[]>(() =>
    copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })),
  );
  const tasksRef = useRef(tasks);
  const sequence = useRef(copy.seedTasks.length);
  const [layout, setLayout] = useState<"dock" | "sidebar">("dock");
  const [side, setSide] = useState<"right" | "left">("right");
  const [launcherPlacement, setLauncherPlacement] = useState<"bottom" | "center">("bottom");
  tasksRef.current = tasks;

  useEffect(() => {
    const page = pageIdentityFor(location.pathname, location.search, copy);
    document.documentElement.lang = plingLocale(locale);
    document.title = page.title ?? copy.documentTitle;
    pling.registry.setPage(page);
  }, [copy, locale, location.pathname, location.search, pling]);

  function addTask(text: string, priority: Priority): Task | null {
    const value = text.trim();
    const current = tasksRef.current;
    if (!value || current.length >= MAX_TASKS) return null;
    const task: Task = {
      id: `t${++sequence.current}`,
      text: value,
      done: false,
      priority,
    };
    const next = [task, ...current];
    tasksRef.current = next;
    setTasks(next);
    return task;
  }

  function toggleTask(id: string): void {
    const next = tasksRef.current.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    tasksRef.current = next;
    setTasks(next);
  }

  function updateTaskText(id: string, text: string): void {
    const next = tasksRef.current.map((task) =>
      task.id === id ? { ...task, text } : task
    );
    tasksRef.current = next;
    setTasks(next);
  }

  function removeTask(id: string): void {
    const next = tasksRef.current.filter((task) => task.id !== id);
    tasksRef.current = next;
    setTasks(next);
  }

  function clearCompleted(): void {
    const next = tasksRef.current.filter((task) => !task.done);
    tasksRef.current = next;
    setTasks(next);
  }

  function completeOpenTasks(): number {
    const current = tasksRef.current;
    const open = current.filter((task) => !task.done).length;
    const next = current.map((task) => task.done ? task : { ...task, done: true });
    tasksRef.current = next;
    setTasks(next);
    return open;
  }

  function askFromPage(): void {
    void pling.ask(copy.pageQuestion).catch(() => undefined);
  }

  return (
    <main className="page">
      <PublishPanel locale={locale} />

      <section className="surface-settings" aria-labelledby="surface-settings-title">
        <div className="surface-settings__intro">
          <p className="surface-settings__eyebrow">{copy.surfaceEyebrow}</p>
          <h2 id="surface-settings-title">{copy.surfaceHeading}</h2>
          <p className="surface-settings__description">{copy.surfaceDescription}</p>
        </div>

        <div className="surface-settings__controls">
          <fieldset>
            <legend>{copy.layoutLabel}</legend>
            <label>
              <input
                type="radio"
                name="surface-layout"
                value="dock"
                checked={layout === "dock"}
                onChange={() => setLayout("dock")}
              />
              {copy.layoutDock}
            </label>
            <label>
              <input
                type="radio"
                name="surface-layout"
                value="sidebar"
                checked={layout === "sidebar"}
                onChange={() => setLayout("sidebar")}
              />
              {copy.layoutSidebar}
            </label>
          </fieldset>

          {layout === "sidebar" ? (
            <>
              <fieldset>
                <legend>{copy.sideLabel}</legend>
                <label>
                  <input
                    type="radio"
                    name="surface-side"
                    value="right"
                    checked={side === "right"}
                    onChange={() => setSide("right")}
                  />
                  {copy.sideRight}
                </label>
                <label>
                  <input
                    type="radio"
                    name="surface-side"
                    value="left"
                    checked={side === "left"}
                    onChange={() => setSide("left")}
                  />
                  {copy.sideLeft}
                </label>
              </fieldset>

              <fieldset>
                <legend>{copy.launcherPlacementLabel}</legend>
                <label>
                  <input
                    type="radio"
                    name="surface-launcher"
                    value="bottom"
                    checked={launcherPlacement === "bottom"}
                    onChange={() => setLauncherPlacement("bottom")}
                  />
                  {copy.launcherBottom}
                </label>
                <label>
                  <input
                    type="radio"
                    name="surface-launcher"
                    value="center"
                    checked={launcherPlacement === "center"}
                    onChange={() => setLauncherPlacement("center")}
                  />
                  {copy.launcherCenter}
                </label>
              </fieldset>
            </>
          ) : null}
        </div>

        <div className="surface-settings__tasks" aria-label={copy.taskEntryLabel}>
          <button
            type="button"
            className="smart-action"
            data-task-entry="summarize"
            onClick={() => void pling.ask(copy.openTasksPrompt).catch(() => undefined)}
          >
            {copy.openTasksTask}
          </button>
          <button
            type="button"
            className="smart-action"
            data-task-entry="ask"
            onClick={askFromPage}
          >
            {copy.pageQuestionTask}
          </button>
        </div>
      </section>

      <AppRoutes
        tasks={tasks}
        copy={copy}
        addTask={addTask}
        toggleTask={toggleTask}
        updateTaskText={updateTaskText}
        removeTask={removeTask}
        clearCompleted={clearCompleted}
        completeOpenTasks={completeOpenTasks}
      />
      <AgentDock
        title={copy.dockTitle}
        quick={copy.quick}
        debug={{ maxCalls: 8 }}
        layout={layout}
        side={side}
        launcherPlacement={launcherPlacement}
        launcherLabel={copy.launcherText}
        surfaceId="dock"
      />
    </main>
  );
}
