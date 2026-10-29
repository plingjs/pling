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
        <ul class="tasks" data-tasks></ul>
        <p class="tasks__empty" data-empty hidden>${copy.empty}</p>
        <div class="backdrop" data-dialog hidden>
          <form class="dialog" data-edit-form role="dialog" aria-modal="true" aria-label="${copy.dialogLabel}">
            <h2>${copy.editTitle}</h2>
            <label class="visually-hidden" for="edit-text">${copy.editTextDesc}</label>
            <input id="edit-text" data-edit-text autocomplete="off" maxlength="80" />
            <p class="dialog__status" data-edit-status aria-live="polite"></p>
            <div class="dialog__actions">
              <button type="button" data-edit-cancel>${copy.cancelEdit}</button>
              <button type="submit" data-edit-save disabled>${copy.saveEdit}</button>
            </div>
          </form>
        </div>
      </section>
    </main>
  `;

  const tasks: Task[] = copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task }));
  let sequence = copy.seedTasks.length;
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
  const dialog = required<HTMLElement>(root, "[data-dialog]");
  const editForm = required<HTMLFormElement>(root, "[data-edit-form]");
  const editText = required<HTMLInputElement>(root, "[data-edit-text]");
  const editStatus = required<HTMLElement>(root, "[data-edit-status]");
  const editCancel = required<HTMLButtonElement>(root, "[data-edit-cancel]");
  const editSave = required<HTMLButtonElement>(root, "[data-edit-save]");
  const cleanups: Array<() => void> = [];
  const rows = new Map<string, { element: HTMLLIElement; cleanups: Array<() => void> }>();
  let dialogCleanups: Array<() => void> = [];
  let editingId: string | null = null;
  let lastSaved: { id: string; text: string } | null = null;

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
  }

  function mountRow(task: Task, append = true): HTMLLIElement {
    const row = document.createElement("li");
    row.className = task.done ? "task is-done" : "task";
    row.innerHTML = `
      <button type="button" class="task__check" aria-label=""></button>
      <span class="task__text"></span>
      <button type="button" class="task__edit" aria-label=""></button>
      <button type="button" class="task__remove" aria-label=""></button>
    `;
    const check = required<HTMLButtonElement>(row, ".task__check");
    const text = required<HTMLElement>(row, ".task__text");
    const edit = required<HTMLButtonElement>(row, ".task__edit");
    const remove = required<HTMLButtonElement>(row, ".task__remove");
    text.textContent = task.text;
    edit.textContent = "✎";
    remove.textContent = "×";

    const syncRow = (): void => {
      const label = copy.toggleDesc(task.text, task.done);
      row.classList.toggle("is-done", task.done);
      check.textContent = task.done ? "✓" : "";
      check.setAttribute("aria-label", label);
      remove.setAttribute("aria-label", copy.removeDesc(task.text));
      edit.setAttribute("aria-label", copy.editDesc(task.text));
    };

    const rowCleanups = [pling.record(row, { data: task, label: copy.recordLabel(task.text) }), pling.tool(check, {
      id: `toggle@${task.id}`,
      desc: copy.toggleDesc(task.text, task.done),
    }), pling.tool(edit, {
      id: `edit@${task.id}`,
      desc: copy.editDesc(task.text),
    }), pling.tool(remove, {
      id: `remove@${task.id}`,
      desc: copy.removeDesc(task.text),
      kind: "danger",
    })];
    rows.set(task.id, { element: row, cleanups: rowCleanups });

    check.addEventListener("click", () => {
      task.done = !task.done;
      syncRow();
      syncSummary();
    });

    remove.addEventListener("click", () => removeTask(task.id));
    edit.addEventListener("click", () => openEdit(task));

    syncRow();
    if (append) list.append(row);
    return row;
  }

  function closeDialog(): void {
    for (const cleanup of dialogCleanups.reverse()) cleanup();
    dialogCleanups = [];
    editingId = null;
    dialog.hidden = true;
    editText.disabled = false;
    editCancel.disabled = false;
    editSave.disabled = true;
    editStatus.textContent = "";
  }

  function openEdit(task: Task): void {
    if (editingId) closeDialog();
    editingId = task.id;
    lastSaved = null;
    editText.value = task.text;
    editText.disabled = false;
    editCancel.disabled = false;
    editSave.disabled = true;
    editStatus.textContent = "";
    dialog.hidden = false;

    dialogCleanups = [
      pling.scope(dialog, {
        id: "edit_dialog",
        label: copy.dialogLabel,
        description: copy.editTextDesc,
        role: "dialog",
      }),
      pling.tool(editText, {
        id: "edit_text",
        desc: copy.editTextDesc,
        action: "fill",
        params: [{ name: "text", label: copy.textParamLabel }],
      }),
      pling.tool(editCancel, {
        id: "edit_cancel",
        desc: copy.cancelDesc,
      }),
      pling.tool(editSave, {
        id: "edit_save",
        desc: copy.saveDesc,
        available: () => editText.value.trim() ? true : copy.submitReason,
        expect: {
          desc: copy.saveExpect,
          check: () => {
            const saved = lastSaved;
            return Boolean(
              saved
              && saved.id === task.id
              && editingId === null
              && tasks.some((candidate) => candidate.id === task.id && candidate.text === saved.text),
            );
          },
          timeout: 2_000,
        },
      }),
    ];
    editText.focus();
  }

  async function saveEdit(): Promise<void> {
    const id = editingId;
    const text = editText.value.trim();
    if (!id || !text) return;
    editText.disabled = true;
    editCancel.disabled = true;
    editSave.disabled = true;
    editStatus.textContent = copy.saving;

    await new Promise((resolve) => setTimeout(resolve, 80));

    const task = tasks.find((candidate) => candidate.id === id);
    if (!task) {
      closeDialog();
      return;
    }
    task.text = text;
    lastSaved = { id, text };
    closeDialog();
    replaceRow(task);
    syncSummary();
  }

  function replaceRow(task: Task): void {
    const entry = rows.get(task.id);
    if (!entry) return;
    for (const cleanup of entry.cleanups.reverse()) cleanup();
    rows.delete(task.id);
    const replacement = mountRow(task, false);
    entry.element.replaceWith(replacement);
  }

  function addTask(): void {
    const text = input.value.trim();
    if (!text || tasks.length >= MAX_TASKS) return;
    const task: Task = { id: `t${++sequence}`, text, done: false };
    tasks.unshift(task);
    list.prepend(mountRow(task));
    input.value = "";
    syncSummary();
  }

  function removeTask(id: string): void {
    if (editingId === id) closeDialog();
    const entry = rows.get(id);
    const index = tasks.findIndex((task) => task.id === id);
    if (!entry || index < 0) return;
    for (const cleanup of entry.cleanups.reverse()) cleanup();
    rows.delete(id);
    entry.element.remove();
    tasks.splice(index, 1);
    syncSummary();
  }

  input.addEventListener("input", syncSummary);
  editText.addEventListener("input", () => {
    editSave.disabled = !editText.value.trim();
  });
  editCancel.addEventListener("click", closeDialog);
  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveEdit();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask();
  });

  tasks.forEach((task) => mountRow(task));
  syncSummary();
  const dock = pling.dock({ title: copy.dockTitle, quick: copy.quick });

  return {
    pling,
    dock,
    tasks,
    destroy() {
      closeDialog();
      for (const entry of rows.values()) {
        for (const cleanup of entry.cleanups.reverse()) cleanup();
      }
      rows.clear();
      for (const cleanup of cleanups.reverse()) cleanup();
      pling.destroy();
      root.replaceChildren();
    },
  };
}
