import { createPling, type AgentSetup, type ToolOptions, type VanillaDock, type VanillaPling } from "@plingjs/vanilla";
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

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const MAX_TASKS = 8;

export function mountQuickstart(root: HTMLElement, options: QuickstartOptions = {}): QuickstartApp {
  const locale = options.locale ?? resolveDemoLocale();
  const copy = copyFor(locale);
  document.documentElement.lang = plingLocale(locale);
  document.title = copy.documentTitle;

  root.innerHTML = `
    <main class="page">
      <section class="todo" data-todo data-agent-scope="todo" data-agent-label="${copy.regionLabel}" data-agent-description="${copy.regionDescription}" data-agent-role="main">
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
            <input id="new-task" data-new-task autocomplete="off" maxlength="80" placeholder="${copy.placeholder}"
              data-agent-tool="composer_text" data-agent-desc="${copy.composerTextDesc}" data-agent-action="fill"
              data-agent-params='[{"name":"text","label":"${copy.textParamLabel}"}]' />
            <button type="submit" data-submit disabled data-agent-tool="composer_submit" data-agent-desc="${copy.composerSubmitDesc}">${copy.addTask}</button>
          </div>
        </form>
        <ul class="tasks" data-tasks></ul>
        <p class="tasks__empty" data-empty hidden>${copy.empty}</p>
      </section>
    </main>
  `;

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

  const todo = required<HTMLElement>(root, "[data-todo]");
  const list = required<HTMLUListElement>(root, "[data-tasks]");
  const form = required<HTMLFormElement>(root, "[data-composer]");
  const input = required<HTMLInputElement>(root, "[data-new-task]");
  const submit = required<HTMLButtonElement>(root, "[data-submit]");
  const count = required<HTMLElement>(root, "[data-count]");
  const empty = required<HTMLElement>(root, "[data-empty]");
  const cleanups: Array<() => void> = [];

  const availability: Record<string, NonNullable<ToolOptions["available"]>> = {
    composer_submit: () => input.value.trim() ? true : copy.submitReason,
  };

  cleanups.push(pling.scope(todo, {
    id: todo.dataset.agentScope ?? "todo",
    label: todo.dataset.agentLabel,
    description: todo.dataset.agentDescription,
    role: "main",
  }));

  function bindDataTools(rootNode: ParentNode): void {
    for (const element of rootNode.querySelectorAll<HTMLElement>("[data-agent-tool]")) {
      const id = element.dataset.agentTool?.trim();
      const desc = element.dataset.agentDesc?.trim();
      if (!id || !desc) continue;
      const action = element.dataset.agentAction as ToolOptions["action"] | undefined;
      const kind = element.dataset.agentKind as ToolOptions["kind"] | undefined;
      const rawParams = element.dataset.agentParams;
      const params = rawParams ? JSON.parse(rawParams) as NonNullable<ToolOptions["params"]> : undefined;
      const available = availability[id];
      cleanups.push(pling.tool(element, {
        id,
        desc,
        ...(action ? { action } : {}),
        ...(kind ? { kind } : {}),
        ...(params ? { params } : {}),
        ...(available ? { available } : {}),
      }));
    }
  }

  bindDataTools(root);

  function syncSummary(): void {
    count.textContent = copy.stats(tasks.filter((task) => !task.done).length);
    empty.hidden = tasks.length > 0;
    submit.disabled = !input.value.trim() || tasks.length >= MAX_TASKS;
  }

  function mountRow(task: Task): HTMLLIElement {
    const row = document.createElement("li");
    row.className = task.done ? "task is-done" : "task";
    row.innerHTML = `
      <button type="button" class="task__check" aria-label=""></button>
      <span class="task__text"></span>
    `;
    const check = required<HTMLButtonElement>(row, ".task__check");
    const text = required<HTMLElement>(row, ".task__text");
    text.textContent = task.text;
    check.dataset.agentTool = `toggle@${task.id}`;
    check.dataset.agentDesc = copy.toggleDesc(task.text, task.done);
    check.dataset.agentKind = "write";

    const syncRow = (): void => {
      const label = copy.toggleDesc(task.text, task.done);
      row.classList.toggle("is-done", task.done);
      check.textContent = task.done ? "✓" : "";
      check.setAttribute("aria-label", label);
    };

    cleanups.push(pling.record(row, { data: task, label: copy.recordLabel(task.text) }));
    check.addEventListener("click", () => {
      task.done = !task.done;
      syncRow();
      syncSummary();
    });

    syncRow();
    list.append(row);
    bindDataTools(row);
    return row;
  }

  function addTask(): void {
    const text = input.value.trim();
    if (!text || tasks.length >= MAX_TASKS) return;
    const task: Task = { id: `t${tasks.length + 1}`, text, done: false };
    tasks.unshift(task);
    list.prepend(mountRow(task));
    input.value = "";
    syncSummary();
  }

  input.addEventListener("input", syncSummary);
  form.addEventListener("submit", (event) => {
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
      root.replaceChildren();
    },
  };
}
