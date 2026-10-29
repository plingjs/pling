import Vue, { type CreateElement } from "vue";
import { createPling, type AgentSetup, type Vue2Pling } from "@plingjs/vue2";
import { copyFor, resolveDemoLocale, type DemoLocale, type DemoTask } from "./copy";

interface Task extends DemoTask {
  id: string;
}

export interface DirectiveAppOptions {
  locale?: DemoLocale;
  agent?: AgentSetup;
  presence?: boolean;
  onWarn?: (message: string) => void;
}

export interface DirectiveApp {
  pling: Vue2Pling;
  vm: Vue;
  tasks: readonly Task[];
  destroy(): void;
}

export function mountDirectiveApp(root: HTMLElement, options: DirectiveAppOptions = {}): DirectiveApp {
  const locale = options.locale ?? resolveDemoLocale();
  const copy = copyFor(locale);
  document.title = copy.documentTitle;

  const pling = createPling({
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    presence: options.presence ?? true,
    onWarn: options.onWarn ?? ((message) => console.warn(message)),
    agent: options.agent ?? {
      config: {
        systemPrompt: copy.systemPrompt,
        limits: { maxTurns: 100 },
      },
    },
  });
  Vue.use(pling.plugin);

  const mountNode = document.createElement("div");
  root.replaceChildren(mountNode);

  const vm = new Vue({
    data() {
      return {
        tasks: copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })) as Task[],
        draft: "",
        sequence: copy.seedTasks.length,
      };
    },
    methods: {
      addTask(this: { tasks: Task[]; draft: string; sequence: number }): void {
        const text = this.draft.trim();
        if (!text) return;
        this.tasks.unshift({ id: `t${++this.sequence}`, text, done: false });
        this.draft = "";
      },
      toggle(this: { tasks: Task[] }, id: string): void {
        const task = this.tasks.find((item) => item.id === id);
        if (task) task.done = !task.done;
      },
      remove(this: { tasks: Task[] }, id: string): void {
        const index = this.tasks.findIndex((task) => task.id === id);
        if (index >= 0) this.tasks.splice(index, 1);
      },
    },
    render(this: Record<string, any>, h: CreateElement) {
      const tool = (value: Record<string, unknown>) => ({ name: "tool", value });

      return h("main", { class: "page" }, [
        h("section", {
          class: "todo",
          directives: [{
            name: "scope",
            value: { id: "todo", label: copy.regionLabel, description: copy.regionDescription, role: "main" },
          }],
        }, [
          h("header", { class: "todo__header" }, [
            h("div", [
              h("p", { class: "todo__eyebrow" }, copy.eyebrow),
              h("h1", copy.heading),
            ]),
            h("p", { class: "todo__count" }, copy.stats(this.tasks.filter((task: Task) => !task.done).length)),
          ]),
          h("form", {
            class: "composer",
            on: {
              submit: (event: Event) => {
                event.preventDefault();
                this.addTask();
              },
            },
          }, [
            h("label", { class: "composer__label", attrs: { for: "new-task" } }, copy.newTaskLabel),
            h("div", { class: "composer__row" }, [
              h("input", {
                attrs: {
                  id: "new-task",
                  autocomplete: "off",
                  maxlength: "80",
                  placeholder: copy.placeholder,
                },
                domProps: { value: this.draft },
                directives: [tool({
                  id: "composer_text",
                  desc: copy.composerTextDesc,
                  action: "fill",
                  params: [{ name: "text", label: copy.textParamLabel }],
                })],
                on: { input: (event: Event) => { this.draft = (event.target as HTMLInputElement).value; } },
              }),
              h("button", {
                attrs: { type: "submit", disabled: !this.draft.trim() },
                directives: [tool({
                  id: "composer_submit",
                  desc: copy.composerSubmitDesc,
                  available: () => this.draft.trim() ? true : copy.submitReason,
                })],
              }, copy.addTask),
            ]),
          ]),
          h("ul", {
            class: "tasks",
            directives: [{
              name: "scope",
              value: { id: "todo_list", label: copy.listLabel, description: copy.listDescription, role: "list", parent: "todo" },
            }],
          }, this.tasks.map((task: Task) => h("li", {
            key: task.id,
            class: ["task", { "is-done": task.done }],
            directives: [{ name: "record", value: { data: task, label: copy.recordLabel(task.text) } }],
          }, [
            h("button", {
              class: "task__check",
              attrs: { type: "button", "aria-label": copy.toggleDesc(task.text, task.done) },
              directives: [tool({
                id: `toggle@${task.id}`,
                desc: copy.toggleDesc(task.text, task.done),
                kind: "write",
              })],
              on: { click: () => this.toggle(task.id) },
            }, task.done ? "✓" : ""),
            h("span", { class: "task__text" }, task.text),
            h("button", {
              class: "task__remove",
              attrs: { type: "button", "aria-label": copy.removeDesc(task.text) },
              directives: [tool({
                id: `remove@${task.id}`,
                desc: copy.removeDesc(task.text),
                kind: "danger",
              })],
              on: { click: () => this.remove(task.id) },
            }, "×"),
          ]))),
          this.tasks.length === 0 ? h("p", { class: "tasks__empty" }, copy.empty) : null,
        ]),
      ]);
    },
  }).$mount(mountNode) as Vue;

  return {
    pling,
    vm,
    get tasks() { return (vm as unknown as { tasks: Task[] }).tasks; },
    destroy() {
      vm.$destroy();
      pling.destroy();
      root.replaceChildren();
    },
  };
}
