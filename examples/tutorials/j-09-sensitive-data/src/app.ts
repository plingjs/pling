import { sensitive } from "@plingjs/core";
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
  readonly lastCall: string | null;
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
          <button type="button" class="todo__assistant" data-assistant-open aria-expanded="false">${copy.openAssistant}</button>
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
              <tr><th scope="col">${copy.taskColumn}</th><th scope="col">${copy.statusColumn}</th><th scope="col">${copy.contactColumn}</th><th scope="col">${copy.actionColumn}</th></tr>
            </thead>
            <tbody data-tasks></tbody>
          </table>
        </div>
        <div class="todo__footer">
          <p class="todo__status" data-call-status aria-live="polite"></p>
          <button type="button" class="todo__clear" data-clear>${copy.clearDone}</button>
        </div>
        <p class="tasks__empty" data-empty hidden>${copy.empty}</p>
      </section>
    </main>
  `;

  const tasks: Task[] = copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task }));
  let lastCall: string | null = null;
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
  const callStatus = required<HTMLElement>(root, "[data-call-status]");
  const clearButton = required<HTMLButtonElement>(root, "[data-clear]");
  const assistantButton = required<HTMLButtonElement>(root, "[data-assistant-open]");
  const cleanups: Array<() => void> = [];
  const rowCleanups = new Map<string, Array<() => void>>();
  const rows = new Map<string, HTMLTableRowElement>();

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

  cleanups.push(pling.tool(clearButton, {
    id: "clear_completed",
    desc: copy.clearDesc,
    kind: "danger",
    confirm: "always",
    available: () => tasks.some((task) => task.done) ? true : "There are no completed tasks to clear.",
    run: () => removeCompleted(),
  }));

  function syncSummary(): void {
    count.textContent = copy.stats(tasks.filter((task) => !task.done).length);
    empty.hidden = tasks.length > 0;
    submit.disabled = !input.value.trim() || tasks.length >= MAX_TASKS;
  }

  function removeRow(task: Task): void {
    for (const cleanup of rowCleanups.get(task.id)?.reverse() ?? []) cleanup();
    rowCleanups.delete(task.id);
    rows.get(task.id)?.remove();
    rows.delete(task.id);
  }

  function removeCompleted(): void {
    for (const task of tasks.filter((candidate) => candidate.done)) removeRow(task);
    for (let index = tasks.length - 1; index >= 0; index -= 1) {
      if (tasks[index]?.done) tasks.splice(index, 1);
    }
    syncSummary();
  }

  function mountRow(task: Task): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.className = task.done ? "task is-done" : "task";
    row.dataset.taskId = task.id;
    row.innerHTML = `
      <td class="task__text"></td>
      <td class="task__status"></td>
      <td class="task__account"></td>
      <td class="task__actions">
        <button type="button" class="task__call" aria-label=""></button>
        <button type="button" class="task__check" aria-label=""></button>
      </td>
    `;
    const call = required<HTMLButtonElement>(row, ".task__call");
    const check = required<HTMLButtonElement>(row, ".task__check");
    const text = required<HTMLElement>(row, ".task__text");
    const status = required<HTMLElement>(row, ".task__status");
    const account = required<HTMLElement>(row, ".task__account");
    text.textContent = task.text;
    account.textContent = String(task.account).replace(/^(.{3}).*(.{4})$/, "$1****-$2");
    call.textContent = copy.callLabel;

    const syncRow = (): void => {
      const label = copy.toggleDesc(task.text, task.done);
      row.classList.toggle("is-done", task.done);
      check.textContent = task.done ? "✓" : "";
      check.setAttribute("aria-label", label);
      status.textContent = task.done ? copy.statusDone : copy.statusOpen;
      call.setAttribute("aria-label", copy.callDesc(task.text));
    };

    const local: Array<() => void> = [];
    local.push(pling.record(row, {
      data: task,
      id: task.id,
      label: copy.recordLabel(task.text),
      fields: {
        text: task.text,
        done: task.done,
        phone: sensitive(task.phone, "token"),
        account: sensitive(task.account, {
          mode: "masked",
          mask: (value) => String(value).replace(/^(.{3}).*(.{4})$/, "$1****-$2"),
        }),
        internalNote: sensitive(task.internalNote),
      },
    }));
    local.push(pling.tool(call, {
      id: `call@${task.id}`,
      desc: copy.callDesc(task.text),
      kind: "read",
      params: [{ name: "phone", label: copy.phoneParamLabel }],
      run: (args: Record<string, unknown>) => {
        lastCall = String(args.phone);
        callStatus.textContent = copy.called(lastCall.slice(-4));
      },
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

  function addTask(): void {
    const text = input.value.trim();
    if (!text || tasks.length >= MAX_TASKS) return;
    const task: Task = {
      id: `t${tasks.length + 1}`,
      text,
      done: false,
      phone: "",
      account: "",
      internalNote: "",
    };
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
  const dock = pling.dock({
    title: copy.dockTitle,
    placeholder: copy.placeholder,
    emptyHint: copy.regionDescription,
    quick: copy.quick,
    onOpenChange: (open) => assistantButton.setAttribute("aria-expanded", String(open)),
  });
  assistantButton.addEventListener("click", () => dock.toggle());

  return {
    pling,
    dock,
    tasks,
    get lastCall() {
      return lastCall;
    },
    destroy() {
      for (const local of rowCleanups.values()) for (const cleanup of local.reverse()) cleanup();
      for (const cleanup of cleanups.reverse()) cleanup();
      pling.destroy();
      root.replaceChildren();
    },
  };
}
