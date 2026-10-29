import type { Confirm, ConfirmRequest } from "@plingjs/core";
import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import { createPling, type AgentSetup, type VanillaDock, type VanillaPling } from "@plingjs/vanilla";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale, type DemoTask } from "./copy";
import { createTodoSurface } from "./surface";

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
  surface: AgentSurface;
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
        <div class="tasks-wrap">
          <table class="tasks">
            <thead>
              <tr><th scope="col">${copy.taskColumn}</th><th scope="col">${copy.statusColumn}</th><th scope="col">${copy.actionColumn}</th></tr>
            </thead>
            <tbody data-tasks></tbody>
          </table>
        </div>
        <footer class="todo__footer">
          <p class="tasks__empty" data-empty hidden>${copy.empty}</p>
          <button type="button" class="todo__clear" data-clear>${copy.clearDone}</button>
        </footer>
      </section>

      <aside class="external" data-external>
        <p class="external__eyebrow">pling.surface/0.1</p>
        <h2>${copy.externalTitle}</h2>
        <p>${copy.externalDescription}</p>
        <div class="external__actions">
          <button type="button" data-describe>${copy.describeLabel}</button>
          <button type="button" data-add>${copy.addSampleLabel}</button>
          <button type="button" data-surface-clear>${copy.clearLabel}</button>
        </div>
        <pre class="external__output" data-output>${copy.outputEmpty}</pre>
        <section class="approval" data-approval hidden>
          <h3>${copy.approvalTitle}</h3>
          <p>${copy.approvalBody}</p>
          <div>
            <button type="button" data-approve>${copy.approveLabel}</button>
            <button type="button" data-deny>${copy.denyLabel}</button>
          </div>
        </section>
      </aside>
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
  const list = required<HTMLTableSectionElement>(root, "[data-tasks]");
  const form = required<HTMLFormElement>(root, "[data-composer]");
  const input = required<HTMLInputElement>(root, "[data-new-task]");
  const submit = required<HTMLButtonElement>(root, "[data-submit]");
  const count = required<HTMLElement>(root, "[data-count]");
  const empty = required<HTMLElement>(root, "[data-empty]");
  const clearButton = required<HTMLButtonElement>(root, "[data-clear]");
  const output = required<HTMLElement>(root, "[data-output]");
  const approvalPanel = required<HTMLElement>(root, "[data-approval]");
  const approveButton = required<HTMLButtonElement>(root, "[data-approve]");
  const denyButton = required<HTMLButtonElement>(root, "[data-deny]");
  const cleanups: Array<() => void> = [];
  const rowCleanups = new Map<string, Array<() => void>>();
  const rows = new Map<string, HTMLTableRowElement>();
  let pendingApproval: { resolve: (decision: boolean | "always") => void } | null = null;

  const confirm: Confirm = (request: ConfirmRequest) =>
    new Promise((resolve) => {
      pendingApproval?.resolve(false);
      pendingApproval = { resolve };
      approvalPanel.hidden = false;
      approvalPanel.dataset.action = request.id;
    });

  const decide = (decision: boolean): void => {
    pendingApproval?.resolve(decision);
    pendingApproval = null;
    approvalPanel.hidden = true;
    delete approvalPanel.dataset.action;
  };

  approveButton.addEventListener("click", () => decide(true));
  denyButton.addEventListener("click", () => decide(false));

  cleanups.push(pling.scope(todo, {
    id: "todo",
    label: copy.regionLabel,
    description: copy.regionDescription,
    role: "main",
  }));

  cleanups.push(pling.tool(input, {
    id: "composer_text",
    desc: copy.composerTextDesc,
    action: "fill",
    params: [{ name: "text", label: copy.textParamLabel }],
  }));

  cleanups.push(pling.tool(submit, {
    id: "composer_submit",
    desc: copy.composerSubmitDesc,
    available: () => input.value.trim() ? true : copy.submitReason,
  }));

  function syncSummary(): void {
    count.textContent = copy.stats(tasks.filter((task) => !task.done).length);
    empty.hidden = tasks.length > 0;
    submit.disabled = !input.value.trim() || tasks.length >= MAX_TASKS;
    clearButton.disabled = !tasks.some((task) => task.done);
  }

  function mountRow(task: Task): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.className = task.done ? "task is-done" : "task";
    row.innerHTML = `
      <td class="task__text"></td>
      <td class="task__status"></td>
      <td class="task__action"><button type="button" class="task__check" aria-label=""></button></td>
    `;
    const check = required<HTMLButtonElement>(row, ".task__check");
    const text = required<HTMLElement>(row, ".task__text");
    const status = required<HTMLElement>(row, ".task__status");
    text.textContent = task.text;

    const syncRow = (): void => {
      const label = copy.toggleDesc(task.text, task.done);
      row.classList.toggle("is-done", task.done);
      check.textContent = task.done ? "✓" : "";
      check.setAttribute("aria-label", label);
      status.textContent = task.done ? copy.statusDone : copy.statusOpen;
    };

    const local: Array<() => void> = [];
    local.push(pling.record(row, {
      data: task,
      id: task.id,
      label: copy.recordLabel(task.text),
      fields: { text: task.text, done: task.done },
    }));
    local.push(pling.tool(check, {
      id: `toggle@${task.id}`,
      desc: copy.toggleDesc(task.text, task.done),
    }));

    check.addEventListener("click", () => {
      task.done = !task.done;
      syncRow();
      syncSummary();
    });

    rowCleanups.set(task.id, local);
    rows.set(task.id, row);
    syncRow();
    list.append(row);
    return row;
  }

  function removeCompleted(): { removed: number } {
    const completed = tasks.filter((task) => task.done);
    if (completed.length === 0) return { removed: 0 };
    for (const task of completed) {
      for (const cleanup of rowCleanups.get(task.id) ?? []) cleanup();
      rowCleanups.delete(task.id);
      rows.get(task.id)?.remove();
      rows.delete(task.id);
      const index = tasks.findIndex((candidate) => candidate.id === task.id);
      if (index >= 0) tasks.splice(index, 1);
    }
    syncSummary();
    return { removed: completed.length };
  }

  function addTask(text: string): { ok: boolean; task?: Task } {
    const value = text.trim();
    if (!value || tasks.length >= MAX_TASKS) return { ok: false };
    const task: Task = { id: `t${Date.now()}`, text: value, done: false };
    tasks.unshift(task);
    list.prepend(mountRow(task));
    syncSummary();
    return { ok: true, task };
  }

  cleanups.push(pling.action({
    id: "todo.overview",
    desc: "Read the number of open and completed tasks in this queue.",
    kind: "read",
    run: () => ({
      total: tasks.length,
      open: tasks.filter((task) => !task.done).length,
      completed: tasks.filter((task) => task.done).length,
    }),
  }));

  cleanups.push(pling.action({
    id: "todo.add",
    desc: "Add one support task with the supplied text.",
    kind: "write",
    params: [{ name: "text", label: copy.textParamLabel }],
    run: (args) => addTask(String(args.text ?? "")),
  }));

  cleanups.push(pling.tool(clearButton, {
    id: "todo.clear_completed",
    desc: copy.clearDesc,
    kind: "danger",
    confirm: "always",
    available: () => tasks.some((task) => task.done) ? true : "There are no completed tasks to clear.",
    run: () => {
      removeCompleted();
    },
  }));

  clearButton.addEventListener("click", () => {
    removeCompleted();
  });

  input.addEventListener("input", syncSummary);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (addTask(input.value).ok) input.value = "";
    syncSummary();
  });

  tasks.forEach(mountRow);
  syncSummary();

  const { surface } = createTodoSurface(pling.registry, confirm, "tutorial-support-queue");
  let requestSequence = 0;
  const request = (method: "describe" | "invoke", extra: Record<string, unknown> = {}) => ({
    protocol: SURFACE_PROTOCOL,
    id: `console-${++requestSequence}`,
    method,
    ...extra,
  });

  const print = (response: SurfaceResponse): void => {
    output.textContent = JSON.stringify(response, null, 2);
  };

  required<HTMLButtonElement>(root, "[data-describe]").addEventListener("click", async () => {
    print(await surface.handle(request("describe", { input: { limit: 2 } })));
  });
  required<HTMLButtonElement>(root, "[data-add]").addEventListener("click", async () => {
    print(await surface.handle(request("invoke", {
      capability: "todo.add",
      input: { text: copy.sampleTask },
    })));
  });
  required<HTMLButtonElement>(root, "[data-surface-clear]").addEventListener("click", async () => {
    print(await surface.handle(request("invoke", { capability: "todo.clear_completed" })));
  });

  const dock = pling.dock({ title: copy.dockTitle, quick: copy.quick });

  return {
    pling,
    dock,
    surface,
    tasks,
    destroy() {
      pendingApproval?.resolve(false);
      pendingApproval = null;
      for (const cleanup of cleanups.reverse()) cleanup();
      for (const local of rowCleanups.values()) {
        for (const cleanup of local) cleanup();
      }
      pling.destroy();
      root.replaceChildren();
    },
  };
}
