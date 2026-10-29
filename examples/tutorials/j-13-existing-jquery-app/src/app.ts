import $ from "jquery";
import { createPling, type AgentSetup, type VanillaDock, type VanillaPling } from "@plingjs/vanilla";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale, type DemoTask } from "./copy";

interface Task extends DemoTask {
  id: string;
}

export interface QuickstartOptions {
  locale?: DemoLocale;
  agent?: AgentSetup;
  presence?: boolean;
  onWarn?: (message: string) => void;
}

export interface QuickstartApp {
  pling: VanillaPling;
  dock: VanillaDock;
  tasks: readonly Task[];
  destroy(): void;
}

const MAX_TASKS = 8;

export function mountQuickstart(root: HTMLElement, options: QuickstartOptions = {}): QuickstartApp {
  const locale = options.locale ?? resolveDemoLocale();
  const copy = copyFor(locale);
  document.documentElement.lang = plingLocale(locale);
  document.title = copy.documentTitle;

  $(root).html(`
    <main class="page">
      <section class="todo" data-todo>
        <header class="todo__header">
          <div>
            <p class="todo__eyebrow">${copy.eyebrow}</p>
            <h1>${copy.heading}</h1>
          </div>
          <p class="todo__count" data-count></p>
        </header>
        <form class="composer" data-composer>
          <label class="composer__label" for="new-task">${copy.newTaskLabel}</label>
          <div class="composer__row">
            <input id="new-task" data-new-task autocomplete="off" maxlength="80" placeholder="${copy.placeholder}" />
            <button type="submit" data-submit disabled>${copy.addTask}</button>
          </div>
        </form>
        <ul class="tasks" data-tasks></ul>
        <p class="tasks__empty" data-empty hidden>${copy.empty}</p>
      </section>
    </main>
  `);

  const tasks: Task[] = copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task }));
  const pling = createPling({
    ui: { locale: plingLocale(locale) },
    presence: options.presence ?? true,
    onWarn: options.onWarn ?? ((message) => console.warn(message)),
    agent: options.agent ?? {
      config: {
        systemPrompt: copy.systemPrompt,
        limits: { maxTurns: 100 },
      },
    },
  });

  const todo = root.querySelector<HTMLElement>("[data-todo]");
  const list = $(root).find("[data-tasks]");
  const form = $(root).find<HTMLFormElement>("[data-composer]");
  const input = $(root).find<HTMLInputElement>("[data-new-task]");
  const submit = $(root).find<HTMLButtonElement>("[data-submit]");
  const count = $(root).find("[data-count]");
  const empty = $(root).find("[data-empty]");
  const cleanups: Array<() => void> = [];

  if (!todo) throw new Error("Missing [data-todo] region");

  cleanups.push(pling.scope(todo, {
    id: "todo",
    label: copy.regionLabel,
    description: copy.regionDescription,
    role: "main",
  }));

  cleanups.push(pling.tool(input[0]!, {
    id: "composer_text",
    desc: copy.composerTextDesc,
    action: "fill",
    params: [{ name: "text", label: copy.textParamLabel }],
  }));

  cleanups.push(pling.tool(submit[0]!, {
    id: "composer_submit",
    desc: copy.composerSubmitDesc,
    available: () => input.val()?.toString().trim() ? true : copy.submitReason,
  }));

  function syncSummary(): void {
    count.text(copy.stats(tasks.filter((task) => !task.done).length));
    empty.prop("hidden", tasks.length > 0);
    submit.prop("disabled", !input.val()?.toString().trim() || tasks.length >= MAX_TASKS);
  }

  function mountRow(task: Task): JQuery<HTMLLIElement> {
    const row = $<HTMLLIElement>("<li>").addClass(task.done ? "task is-done" : "task");
    const check = $("<button>").attr("type", "button").addClass("task__check");
    const text = $("<span>").addClass("task__text").text(task.text);
    row.append(check, text);

    const syncRow = (): void => {
      const label = copy.toggleDesc(task.text, task.done);
      row.toggleClass("is-done", task.done);
      check.text(task.done ? "✓" : "").attr("aria-label", label);
    };

    cleanups.push(pling.record(row[0]!, { data: task, label: copy.recordLabel(task.text) }));
    cleanups.push(pling.tool(check[0]!, {
      id: `toggle@${task.id}`,
      desc: copy.toggleDesc(task.text, task.done),
    }));

    check.on("click", () => {
      task.done = !task.done;
      syncRow();
      syncSummary();
    });

    syncRow();
    list.append(row);
    return row;
  }

  function addTask(): void {
    const text = input.val()?.toString().trim();
    if (!text || tasks.length >= MAX_TASKS) return;
    const task: Task = { id: `t${tasks.length + 1}`, text, done: false };
    tasks.unshift(task);
    list.prepend(mountRow(task));
    input.val("");
    syncSummary();
  }

  input.on("input", syncSummary);
  form.on("submit", (event) => {
    event.preventDefault();
    addTask();
  });

  tasks.forEach(mountRow);
  syncSummary();
  const dock = pling.dock({ title: copy.dockTitle, quick: copy.quick });

  return {
    pling,
    dock,
    tasks,
    destroy() {
      for (const cleanup of cleanups.reverse()) cleanup();
      pling.destroy();
      $(root).empty();
    },
  };
}
