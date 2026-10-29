import Vue, {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
  type CreateElement,
  type VNode,
} from "vue";
import type { AgentConfigOverrides, SessionEvent } from "@plingjs/agent";
import { useAgentState, type VanillaDock, type Vue2Pling } from "@plingjs/vue2";
import {
  ORDERS,
  copyFor,
  type Copy,
  type Locale,
  type Order,
  type OrderStatus,
  type Plan,
} from "./copy";

type Filter = "all" | OrderStatus;

interface FormValue {
  customer: string;
  email: string;
  plan: Plan;
}

interface ConnectionDraft {
  baseUrl: string;
  model: string;
  apiKey: string;
  persist: "memory" | "session";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_KEY = "pling:recipe:model";

export function mountOrderApp(pling: Vue2Pling, root: HTMLElement): () => void {
  const mountNode = document.createElement("div");
  root.replaceChildren(mountNode);

  const vm = new Vue({
    setup() {
      const locale = ref<Locale>(initialLocale());
      const copy = computed<Copy>(() => copyFor(locale.value));
      const orders = ref<Order[]>(ORDERS.map((order) => ({ ...order })));
      const customer = ref("");
      const email = ref("");
      const plan = ref<Plan>("starter");
      const submitting = ref(false);
      const error = ref<string | null>(null);
      const lastCreatedId = ref<string | null>(null);
      const filter = ref<Filter>("all");
      const searchDraft = ref("");
      const appliedSearch = ref("");
      const started = ref(false);
      const connection = ref<AgentConfigOverrides>(readSessionConfig() ?? {});
      const initialConnection = connection.value;
      const connectionDraft = ref<ConnectionDraft>({
        baseUrl: initialConnection.baseUrl ?? "",
        model: initialConnection.model ?? "",
        apiKey: initialConnection.apiKey ?? "",
        persist: hasSessionConfig() ? "session" : "memory",
      });
      let sequence = 1018;
      let dock: VanillaDock | null = null;
      let offCreate: (() => void) | null = null;

      const detailId = new URLSearchParams(location.search).get("order");
      const detailOrder = computed(() => orders.value.find((order) => order.id === detailId) ?? null);
      const invalidFields = computed(() => {
        const fields: string[] = [];
        if (customer.value.trim().length < 2) fields.push("customer");
        if (!EMAIL.test(email.value.trim())) fields.push("email");
        return fields;
      });
      const dirty = computed(() => Boolean(customer.value || email.value || plan.value !== "starter"));
      const visibleOrders = computed(() => {
        const needle = appliedSearch.value.toLocaleLowerCase();
        return orders.value.filter((order) => {
          if (filter.value !== "all" && order.status !== filter.value) return false;
          return needle === "" || `${order.customer} ${order.id}`.toLocaleLowerCase().includes(needle);
        });
      });
      const openCount = computed(() => orders.value.filter((order) => order.status === "open").length);
      const paidCount = computed(() => orders.value.length - openCount.value);
      const createdName = computed(() => (
        lastCreatedId.value
          ? orders.value.find((order) => order.id === lastCreatedId.value)?.customer ?? null
          : null
      ));

      watchEffect(() => {
        document.documentElement.lang = locale.value === "zh" ? "zh-CN" : "en";
        document.title = `${copy.value.title} · Pling recipes`;
        pling.registry.setPage({
          path: location.pathname,
          title: document.title,
          ...(detailId ? { params: { order: detailId } } : {}),
        });
      });

      useAgentState("order_view", () => ({
        filter: filter.value,
        search: appliedSearch.value,
        matched: visibleOrders.value.length,
        total: orders.value.length,
        open: openCount.value,
        paid: paidCount.value,
      }), { description: "Read-only order view: applied filter/search, matching rows, and open/paid totals" });

      useAgentState("order_form", () => ({
        dirty: dirty.value,
        submitting: submitting.value,
        invalidFields: invalidFields.value,
        lastSaveFailed: error.value !== null,
      }), { description: "Order form status; customer values are not repeated in page state" });

      function addOrder(value: FormValue): Order {
        const order: Order = {
          id: `SO-${++sequence}`,
          customer: value.customer.trim(),
          email: value.email.trim(),
          amount: value.plan === "pro" ? 240 : 120,
          plan: value.plan,
          status: "open",
        };
        orders.value.unshift(order);
        return order;
      }

      async function create(value: FormValue, updateForm: boolean): Promise<void> {
        if (submitting.value) return;
        submitting.value = true;
        error.value = null;
        if (updateForm) {
          customer.value = value.customer;
          email.value = value.email;
          plan.value = value.plan;
        }
        try {
          await new Promise((resolve) => setTimeout(resolve, 120));
          const order = addOrder(value);
          lastCreatedId.value = order.id;
          if (updateForm) {
            customer.value = "";
            email.value = "";
            plan.value = "starter";
          }
        } catch (failure) {
          error.value = failure instanceof Error ? failure.message : String(failure);
        } finally {
          submitting.value = false;
        }
      }

      function createFromForm(): void {
        if (invalidFields.value.length > 0) return;
        void create({
          customer: customer.value,
          email: email.value,
          plan: plan.value,
        }, false);
      }

      function setStatus(id: string, status: OrderStatus): void {
        const order = orders.value.find((item) => item.id === id);
        if (order) order.status = status;
      }

      function removeOrder(id: string): void {
        orders.value = orders.value.filter((order) => order.id !== id);
      }

      function applySearch(): void {
        appliedSearch.value = searchDraft.value.trim();
      }

      function onEvent(event: Event): void {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        if (target.name === "customer") customer.value = target.value;
        else if (target.name === "email") email.value = target.value;
        else if (target.name === "plan") plan.value = target.value === "pro" ? "pro" : "starter";
      }

      function onConnectionInput(event: Event): void {
        if (started.value) return;
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        connectionDraft.value = {
          ...connectionDraft.value,
          [target.name]: target.value,
        };
      }

      function saveConnection(): void {
        if (started.value) return;
        const next: AgentConfigOverrides = {
          baseUrl: connectionDraft.value.baseUrl.trim(),
          model: connectionDraft.value.model.trim(),
          apiKey: connectionDraft.value.apiKey.trim(),
        };
        if (connectionDraft.value.persist === "session") writeSessionConfig(next);
        else clearSessionConfig();
        connection.value = next;
        rebuildDock();
      }

      function switchLocale(): void {
        locale.value = locale.value === "en" ? "zh" : "en";
        pling.ui.setLocale(locale.value === "zh" ? "zh-CN" : "en-US");
        if (!started.value) rebuildDock();
      }

      function rebuildDock(): void {
        dock?.destroy();
        dock = pling.dock({
          config: connection.value,
          title: copy.value.listTitle,
          quick: copy.value.quick,
          onSessionEvent: (event: SessionEvent) => {
            if (event.type === "user") started.value = true;
          },
        });
      }

      function registerCreateAction(): void {
        offCreate?.();
        offCreate = null;
        if (detailOrder.value) return;
        offCreate = pling.action({
          id: "create_order",
          desc: copy.value.createOrderDesc,
          kind: "write",
          params: [
            { name: "customer", label: copy.value.customerParam, minLength: 2, maxLength: 80 },
            { name: "email", label: copy.value.emailParam, pattern: EMAIL },
            { name: "plan", label: copy.value.planParam, values: ["starter", "pro"] },
          ],
          available: () => (submitting.value ? copy.value.creating : true),
          run: async (args) => {
            await create({
              customer: String(args.customer),
              email: String(args.email),
              plan: args.plan === "pro" ? "pro" : "starter",
            }, true);
          },
          expect: {
            desc: copy.value.createOrderExpect,
            check: () => orders.value.some((order) => order.id === lastCreatedId.value),
          },
        });
      }

      onMounted(() => {
        pling.ui.setLocale(locale.value === "zh" ? "zh-CN" : "en-US");
        registerCreateAction();
        rebuildDock();
      });

      watch(locale, registerCreateAction);

      onBeforeUnmount(() => {
        offCreate?.();
        offCreate = null;
        dock?.destroy();
        dock = null;
      });

      return {
        locale,
        copy,
        orders,
        customer,
        email,
        plan,
        submitting,
        error,
        filter,
        searchDraft,
        appliedSearch,
        started,
        connectionDraft,
        detailOrder,
        invalidFields,
        dirty,
        visibleOrders,
        openCount,
        paidCount,
        createdName,
        createFromForm,
        setStatus,
        removeOrder,
        applySearch,
        onEvent,
        onConnectionInput,
        saveConnection,
        switchLocale,
      };
    },
    render(this: any, h: CreateElement): VNode {
      const tool = (value: Record<string, unknown>) => ({ name: "tool", value });
      const scope = (value: Record<string, unknown>) => ({ name: "scope", value });
      const record = (value: Record<string, unknown>) => ({ name: "record", value });

      const header = h("header", { class: "masthead" }, [
        h("div", [
          h("p", { class: "eyebrow" }, "Pling recipes · Vue 2.7"),
          h("h1", this.copy.title),
          h("p", { class: "lede" }, this.copy.subtitle),
        ]),
        h("div", { class: "toolbar" }, [
          h("button", {
            class: "chip",
            attrs: { type: "button" },
            on: { click: this.switchLocale },
          }, this.copy.switchLanguage),
        ]),
      ]);

      const detail = this.detailOrder
        ? h("section", { class: "panel" }, [
          h("header", { class: "panel__head" }, [
            h("div", [
              h("h2", this.copy.detailTitle),
              h("p", `${this.copy.order} ${this.detailOrder.id}`),
            ]),
            h("a", { class: "chip", attrs: { href: "./" } }, this.copy.back),
          ]),
          h("div", { class: "body details" }, [
            h("dl", [
              h("dt", this.copy.customerLabel), h("dd", this.detailOrder.customer),
              h("dt", this.copy.emailLabel), h("dd", this.detailOrder.email),
              h("dt", this.copy.planLabel), h("dd", this.detailOrder.plan),
              h("dt", this.copy.amount), h("dd", String(this.detailOrder.amount)),
              h("dt", this.copy.status), h("dd", this.detailOrder.status),
            ]),
          ]),
        ])
        : null;

      const field = (label: string, control: VNode) => h("label", { class: "field" }, [
        h("span", label),
        control,
      ]);

      const connection = h("details", { class: "connection" }, [
        h("summary", this.copy.connectionTitle),
        h("p", { class: "hint" }, this.copy.connectionHint),
        h("div", { class: "form" }, [
          field("Base URL", h("input", {
            attrs: { name: "baseUrl", placeholder: "https://provider.example.com/v1" },
            domProps: { value: this.connectionDraft.baseUrl },
            on: { input: this.onConnectionInput },
          })),
          field("Model", h("input", {
            attrs: { name: "model", placeholder: "model-name" },
            domProps: { value: this.connectionDraft.model },
            on: { input: this.onConnectionInput },
          })),
          field("API key", h("input", {
            attrs: { name: "apiKey", type: "password", autocomplete: "off" },
            domProps: { value: this.connectionDraft.apiKey },
            on: { input: this.onConnectionInput },
          })),
          field("Storage", h("select", {
            attrs: { name: "persist" },
            domProps: { value: this.connectionDraft.persist },
            on: { change: this.onConnectionInput },
          }, [
            h("option", { attrs: { value: "memory" } }, "memory"),
            h("option", { attrs: { value: "session" } }, "session"),
          ])),
          h("div", { class: "form__footer" }, [
            h("span", { class: "hint" }, this.started
              ? "Start a new page load to change the connection."
              : "The key is never printed in page state."),
            h("button", {
              class: "button",
              attrs: { type: "button" },
              domProps: { disabled: this.started },
              on: { click: this.saveConnection },
            }, "Save connection"),
          ]),
        ]),
      ]);

      const formPanel = h("section", {
        class: "panel",
        directives: [scope({
          id: "order_form",
          label: this.copy.formTitle,
          description: this.copy.formHint,
          role: "form",
        })],
      }, [
        h("header", { class: "panel__head" }, [
          h("div", [h("h2", this.copy.formTitle), h("p", this.copy.formHint)]),
        ]),
        h("div", { class: "body" }, [
          h("form", {
            class: "form",
            on: {
              submit: (event: Event) => {
                event.preventDefault();
                this.createFromForm();
              },
            },
          }, [
            field(this.copy.customer, h("input", {
              attrs: {
                name: "customer",
                autocomplete: "organization",
                "aria-invalid": String(this.invalidFields.includes("customer")),
              },
              domProps: { value: this.customer },
              on: { input: this.onEvent },
            })),
            field(this.copy.email, h("input", {
              attrs: {
                name: "email",
                type: "email",
                autocomplete: "email",
                "aria-invalid": String(this.invalidFields.includes("email")),
              },
              domProps: { value: this.email },
              on: { input: this.onEvent },
            })),
            field(this.copy.plan, h("select", {
              attrs: { name: "plan" },
              domProps: { value: this.plan },
              on: { change: this.onEvent },
            }, [
              h("option", { attrs: { value: "starter" } }, this.copy.starter),
              h("option", { attrs: { value: "pro" } }, this.copy.pro),
            ])),
            h("div", { class: "form__footer" }, [
              h("span", { class: this.error ? "status error" : "status" }, this.error ?? ""),
              h("button", {
                class: "button primary",
                attrs: { type: "submit" },
                domProps: { disabled: this.submitting || this.invalidFields.length > 0 },
                on: { click: this.createFromForm },
              }, this.submitting ? this.copy.creating : this.copy.create),
            ]),
          ]),
          h("p", { class: "status ok" }, this.createdName ? this.copy.created(this.createdName) : ""),
          connection,
        ]),
      ]);

      const rows = this.visibleOrders.map((order: Order) => h("li", {
        key: order.id,
        class: ["order", { "is-paid": order.status === "paid" }],
        directives: [record({
          data: order,
          fields: {
            customer: order.customer,
            amount: order.amount,
            plan: order.plan,
            status: order.status,
          },
        })],
      }, [
        h("div", { class: "order__main" }, [
          h("p", { class: "order__title" }, [
            order.customer,
            " ",
            h("span", { class: "order__id" }, order.id),
          ]),
          h("p", { class: "order__meta" }, `${order.plan} · ${order.amount} · ${order.status}`),
        ]),
        h("div", { class: "order__actions" }, [
          h("a", {
            class: "chip",
            attrs: { href: `?order=${order.id}` },
            directives: [tool({ id: `open_order@${order.id}`, desc: `${this.copy.detailTitle}: ${order.id}` })],
          }, this.copy.detailTitle),
          h("button", {
            attrs: { type: "button" },
            directives: [tool({
              id: `toggle_order@${order.id}`,
              desc: order.status === "open" ? this.copy.markPaidDesc(order.id) : this.copy.markOpenDesc(order.id),
              kind: "write",
            })],
            on: {
              click: () => this.setStatus(order.id, order.status === "open" ? "paid" : "open"),
            },
          }, order.status === "open" ? this.copy.markPaid : this.copy.markOpen),
          h("button", {
            class: "remove",
            attrs: { type: "button" },
            directives: [tool({
              id: `delete_order@${order.id}`,
              desc: this.copy.removeDesc(order.id),
              kind: "danger",
              confirm: "always",
            })],
            on: { click: () => this.removeOrder(order.id) },
          }, this.copy.remove),
        ]),
      ]));

      const listPanel = h("section", {
        class: "panel",
        directives: [scope({
          id: "orders",
          label: this.copy.listTitle,
          description: this.copy.listHint,
          role: "list",
        })],
      }, [
        h("header", { class: "panel__head" }, [
          h("div", [
            h("h2", this.copy.listTitle),
            h("p", this.copy.counts(this.visibleOrders.length, this.orders.length, this.openCount, this.paidCount)),
          ]),
        ]),
        h("div", { class: "controls" }, [
          h("input", {
            class: "search",
            attrs: {
              "aria-label": this.copy.searchLabel,
              placeholder: this.copy.searchPlaceholder,
            },
            domProps: { value: this.searchDraft },
            directives: [tool({
              id: "search_text",
              desc: this.copy.searchDesc,
              action: "fill",
              params: [{ name: "text", label: this.copy.searchPlaceholder }],
            })],
            on: { input: (event: Event) => { this.searchDraft = (event.target as HTMLInputElement).value; } },
          }),
          h("button", {
            class: "button",
            attrs: { type: "button" },
            directives: [tool({ id: "search_apply", desc: this.copy.applySearchDesc })],
            on: { click: this.applySearch },
          }, this.copy.apply),
          h("select", {
            directives: [tool({
              id: "filter_orders",
              desc: this.copy.filterDesc,
              action: "select",
              params: [{ name: "value", values: ["all", "open", "paid"] }],
            })],
            domProps: { value: this.filter },
            on: {
              change: (event: Event) => {
                this.filter = (event.target as HTMLSelectElement).value as Filter;
              },
            },
          }, [
            h("option", { attrs: { value: "all" } }, this.copy.all),
            h("option", { attrs: { value: "open" } }, this.copy.open),
            h("option", { attrs: { value: "paid" } }, this.copy.paid),
          ]),
        ]),
        h("ul", { class: "orders" }, rows),
        this.visibleOrders.length === 0 ? h("p", { class: "empty" }, this.copy.empty) : null,
        h("footer", { class: "list__footer" }, [
          h("span", { class: "status" }, this.copy.counts(
            this.visibleOrders.length,
            this.orders.length,
            this.openCount,
            this.paidCount,
          )),
        ]),
      ]);

      return h("main", { class: "page" }, [
        header,
        detail ?? h("div", { class: "grid" }, [formPanel, listPanel]),
      ]);
    },
  }).$mount(mountNode);

  return () => {
    vm.$destroy();
    root.replaceChildren();
  };
}

function initialLocale(): Locale {
  return new URLSearchParams(location.search).get("lang")?.startsWith("zh") ? "zh" : "en";
}

function readSessionConfig(): AgentConfigOverrides | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentConfigOverrides;
  } catch {
    return null;
  }
}

function hasSessionConfig(): boolean {
  return sessionStorage.getItem(SESSION_KEY) !== null;
}

function writeSessionConfig(config: AgentConfigOverrides): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(config));
}

function clearSessionConfig(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
