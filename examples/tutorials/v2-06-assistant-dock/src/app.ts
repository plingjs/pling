import Vue, { type CreateElement } from "vue";
import { createPling, type AgentSetup, type VanillaDock, type Vue2Pling } from "@plingjs/vue2";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale, type DemoTask } from "./copy";

interface Task extends DemoTask {
  id: string;
}

const MAX_TASKS = 8;

export interface AssistantDockOptions {
  locale?: DemoLocale;
  agent?: AgentSetup;
  presence?: boolean;
  onWarn?: (message: string) => void;
}

export interface AssistantDockApp {
  pling: Vue2Pling;
  dock: VanillaDock | null;
  vm: Vue;
  destroy(): void;
}

export function mountAssistantDock(root: HTMLElement, options: AssistantDockOptions = {}): AssistantDockApp {
  const locale = options.locale ?? resolveDemoLocale();
  const copy = copyFor(locale);
  document.documentElement.lang = plingLocale(locale);
  document.title = copy.documentTitle;

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
  Vue.use(pling.plugin);

  const mountNode = document.createElement("div");
  root.replaceChildren(mountNode);
  let dock: VanillaDock | null = null;
  const vm = new Vue({
    data() {
      return {
        tasks: copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })) as Task[],
        draft: "",
        sequence: copy.seedTasks.length,
        assistantOpen: false,
      };
    },
    computed: {
      remaining(this: { tasks: Task[] }): number {
        return this.tasks.filter((task) => !task.done).length;
      },
    },
    methods: {
      addTask(this: { tasks: Task[]; draft: string; sequence: number }): void {
        const text = this.draft.trim();
        if (!text || this.tasks.length >= MAX_TASKS) return;
        this.tasks.unshift({ id: `t${++this.sequence}`, text, done: false });
        this.draft = "";
      },
      toggleTask(this: { tasks: Task[] }, id: string): void {
        const task = this.tasks.find((item) => item.id === id);
        if (task) task.done = !task.done;
      },
    },
    mounted() {
      dock = pling.dock({
        title: copy.dockTitle,
        placeholder: copy.placeholder,
        emptyHint: copy.regionDescription,
        quick: [...copy.quick],
        defaultOpen: true,
        onOpenChange: (open: boolean) => { this.assistantOpen = open; },
      });
    },
    beforeDestroy() {
      dock?.destroy();
      dock = null;
    },
    render(this: Record<string, any>, h: CreateElement) {
      const tool = (id: string, desc: string, extra: Record<string, unknown> = {}) => ({
        name: "tool",
        value: { id, desc, kind: "write", ...extra },
      });

      const submitAvailable = (): true | string => {
        if (!this.draft.trim()) return copy.submitReason;
        if (this.tasks.length >= MAX_TASKS) return copy.fullReason;
        return true;
      };

      return h("main", { class: "page" }, [
        h("section", {
          class: "todo",
          directives: [{
            name: "scope",
            value: {
              id: "todo",
              label: copy.regionLabel,
              description: copy.regionDescription,
              role: "main",
            },
          }],
        }, [
          h("header", { class: "todo__header" }, [
            h("div", [
              h("p", { class: "todo__eyebrow" }, copy.eyebrow),
              h("h1", copy.heading),
            ]),
            h("p", { class: "todo__count" }, copy.stats(this.remaining)),
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
                directives: [tool("composer_text", copy.composerTextDesc, {
                  action: "fill",
                  params: [{ name: "text", label: copy.textParamLabel }],
                })],
                on: { input: (event: Event) => { this.draft = (event.target as HTMLInputElement).value; } },
              }),
              h("button", {
                attrs: { type: "submit", disabled: !this.draft.trim() || this.tasks.length >= MAX_TASKS },
                directives: [tool("composer_submit", copy.composerSubmitDesc, { available: submitAvailable })],
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
              attrs: {
                type: "button",
                "aria-label": copy.toggleDesc(task.text, task.done),
              },
              directives: [tool(`toggle@${task.id}`, copy.toggleDesc(task.text, task.done))],
              on: { click: () => this.toggleTask(task.id) },
            }, task.done ? "✓" : ""),
            h("span", { class: "task__text" }, task.text),
          ]))),
          this.tasks.length === 0 ? h("p", { class: "tasks__empty" }, copy.empty) : null,
        ]),
      ]);
    },
  }).$mount(mountNode) as Vue;

  return {
    pling,
    vm,
    get dock() { return dock; },
    destroy() {
      dock?.destroy();
      dock = null;
      vm.$destroy();
      pling.destroy();
      root.replaceChildren();
    },
  };
}
