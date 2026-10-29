---
id: J-04
title: "Declarative actions with data attributes"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Declarative actions with data attributes

A server-rendered or template-driven page may have most of its capability metadata in HTML. Repeating a long `pling.tool()` call next to every control makes that metadata harder to inspect. A page can instead store the serializable parts in `data-*` attributes and use a small binder to call the adapter.

The Vanilla adapter does not automatically interpret `data-pling-tool`. `data-agent-*` in this chapter is an application convention. Keeping the binder in application code makes the convention visible and lets the page decide which dynamic values it needs.

## Put stable metadata in markup

The input and submit button describe their action with attributes:

```html
<input data-new-task
  data-agent-tool="composer_text"
  data-agent-desc="Enter the text for a new task."
  data-agent-action="fill"
  data-agent-params='[{"name":"text","label":"Task text"}]' />

<button type="submit" data-submit
  data-agent-tool="composer_submit"
  data-agent-desc="Add the text in the new-task field to the list.">
  Add task
</button>
```

The values are stable, readable at the point where the control is rendered, and can be produced by a server template without shipping component code. The `params` value is JSON because it is data, not executable code.

## Bind attributes after the DOM exists

The page owns a binder that turns those attributes into declarations:

```ts
function bindDataTools(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-agent-tool]")) {
    const id = element.dataset.agentTool?.trim();
    const desc = element.dataset.agentDesc?.trim();
    if (!id || !desc) continue;

    const action = element.dataset.agentAction as ToolOptions["action"] | undefined;
    const rawParams = element.dataset.agentParams;
    const params = rawParams ? JSON.parse(rawParams) : undefined;
    const available = availability[id];

    cleanups.push(pling.tool(element, {
      id,
      desc,
      ...(action ? { action } : {}),
      ...(params ? { params } : {}),
      ...(available ? { available } : {}),
    }));
  }
}
```

Register the scope before binding its children. The adapter writes `data-plling-scope` to the region, and each tool inherits the nearest declared scope from the DOM.

## Keep functions and live objects in code

Two things should not be serialized into HTML:

- a record's `data` object, because it must remain the same live object the page mutates;
- an `available` function, because it reads current page state.

The page keeps an availability map and binds each row's record explicitly:

```ts
const availability = {
  composer_submit: () => input.value.trim() ? true : "Fill in a task first.",
};

pling.record(row, { data: task, label: `Task: ${task.text}` });
```

For generated rows, the page can set `data-agent-tool` and `data-agent-desc` before calling the same binder. The record and its live object remain attached with `pling.record`.

## Data attributes are metadata, not security

Anyone can inspect or alter a data attribute in the browser. The resulting declaration still goes through the same registry, availability check, policy, executor, and server authorization as an explicit `pling.tool()` call. Removing an attribute can reduce what the agent sees, but adding one cannot grant authority the business endpoint did not already allow.

Do not store secrets, access tokens, or per-user permission claims in these attributes. The browser is the wrong trust boundary for them.

## Run the example

```bash
pnpm tutorial:dev j-04
```

Open `http://127.0.0.1:5269/`. The Chinese interface is available with `pnpm tutorial:dev j-04 --locale zh` at `http://127.0.0.1:5269/?lang=zh`.

```bash
pnpm tutorial:check j-04
```

The check confirms that the attribute binder registers the input, submit, and row actions, and that the existing DOM handlers still add and toggle tasks.

## Common failures

**Putting `data-agent-tool` on every wrapper.** The binder sees every matched element. Put the metadata on the interactive control or use an explicit selector in the binder.

**Leaving stale attributes on a replaced node.** The attribute is not a registration. Re-run the binder after replacing the DOM, and call the old declaration's unsubscribe function.

**Serializing `available` or a live record into JSON.** They are code and state, not static metadata. Keep them in the page and merge them in the binder.

Next: [Imperative actions for dynamic DOM](/vanilla/imperative-actions-for-dynamic-dom).
