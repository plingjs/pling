---
id: R-06
title: "Real controls and custom components"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Real controls and custom components

The previous chapter replaced the form's two control actions with one business action, `add_task`. That was the right move for adding a task, but it does not follow that every interaction should become a single business operation. A priority selector, a search field, and a filter still belong to the page's ordinary controls. The agent should use those controls; it should not bypass them.

There is a second problem. A declaration can sit on a native element or on a component wrapper. The wrapper rarely receives the event itself. If the framework clicks the wrapper, the page may look unchanged even though the action reported success. This chapter is about that gap: which element actually receives the interaction, and what evidence the framework has for choosing it.

## What the previous chapter leaves open

The added task is still a good starting point. A user may now say:

> Add “Prepare tomorrow's agenda” with later priority, then search for “agenda”.

The add operation already has a business action. The priority and the search are different. They are controls the person can see and use, and their behavior is owned by the page. The agent needs to operate the same controls rather than call an invented `set_priority` or `perform_search` function that does not exist in the application.

Two questions must remain separate:

- **What interaction should happen?** Set a select value, type into a field, press Enter, click one of several buttons, or move the pointer over a menu.
- **Which element receives it?** A native control, a single input inside a component, or one explicitly named button inside a component with several controls.

The first question belongs to the primitive. The second belongs to target resolution. If either one is wrong, a result can say “clicked” while the application did nothing.

## The controls in this example

The page keeps the previous chapter's Todo structure and adds four control patterns:

| Action | Primitive | Intended element | Fidelity |
| --- | --- | --- | --- |
| `select_priority` | `select` | the native priority `<select>` | `high` (`native`) |
| `search_text` | `type` | the single input inside `SearchBox` | `auto` |
| `search_enter` | `press` | the same input | `auto` |
| `show_all_tasks` | `click` | one button inside `TaskFilters` | `high` (`declared` target) |
| `show_open_tasks` | `click` | one button inside `TaskFilters` | `high` (`declared` target) |
| `show_completed_tasks` | `click` | one button inside `TaskFilters` | `high` (`declared` target) |
| `open_bulk_menu` | `hover` | the root of `BulkMenu` | `high` (explicit claim) |
| `clear_completed` | `click` | the button mounted inside the open menu | `high` (`native`) |

These are not competing ways to express the same operation. `add_task` is a business operation with its own validation and result condition. The controls above are page interactions. They stay at that level because that is what the page exposes and because the user can see and manipulate them directly.

## A native control needs no target search

The priority selector is a normal React `<select>`. Its value is already controlled by the application:

```tsx{1-11}
const priorityRef = usePlingTool<HTMLSelectElement>({
  id: "select_priority",
  desc: copy.selectPriorityDesc,
  kind: "write",
  action: "select",
  params: [{
    name: "value",
    label: copy.selectPriorityParamLabel,
    values: ["today", "soon", "later"],
  }],
});
```

The declaration does not add a second priority state. The `select` primitive writes the native value and dispatches a `change` event. React's existing `onChange` receives that event and updates the state used by `addTask`.

```tsx{3-6}
<select
  id="task-priority"
  ref={priorityRef}
  value={priority}
  aria-label={copy.priorityAria}
  onChange={(event) => setPriority(event.target.value as Priority)}
>
  <option value="today">{copy.priorities.today}</option>
  <option value="soon">{copy.priorities.soon}</option>
  <option value="later">{copy.priorities.later}</option>
</select>
```

The native element is the target. No descendant search is needed, so the resolved fidelity is `high` with the reason `native`. The `params` declaration is still useful: it says that `value` is required and limits the model to the three values the page can consume.

Changing the priority does not itself create a task. That is why `add_task` still reads the current priority when it runs:

```tsx{2}
run: (args: Record<string, unknown>) => {
  lastAddedId.current = addTask(String(args.text), priority)?.id ?? null;
},
```

## One declaration can sit on a component

The search field is a custom component with one input inside it. The component exists to wrap the field with an icon and to own the Enter behavior:

```tsx{6,15-19}
export const SearchBox = forwardRef<HTMLDivElement, SearchBoxProps>(function SearchBox(
  { value, label, placeholder, onChange, onSearch },
  ref,
) {
  return (
    <div className="search-box" ref={ref}>
      <span className="search-box__icon" aria-hidden="true">⌕</span>
      <input
        type="search"
        aria-label={label}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSearch();
        }}
      />
    </div>
  );
});
```

The declarations belong to the wrapper, not to the input:

```tsx{1-12,14-17}
const searchTextRef = usePlingTool<HTMLDivElement>({
  id: "search_text",
  desc: copy.searchTextDesc,
  kind: "write",
  action: "fill",
});
const searchEnterRef = usePlingTool<HTMLDivElement>({
  id: "search_enter",
  desc: copy.searchEnterDesc,
  kind: "write",
  action: "press",
  key: "Enter",
});

const searchRef = useMemo(
  () => mergeRefs(searchTextRef, searchEnterRef),
  [searchEnterRef, searchTextRef],
);
```

The React option is `action: "fill"`; the adapter projects that as the `type` primitive. The tool list shows the primitive; the activity row shows the action id, not the primitive name. `mergeRefs` then lets both declarations attach to the same DOM node. Each action still has its own id, primitive, and description. The framework searches inside the wrapper and finds exactly one compatible input. That result is reported as fidelity `auto`: there is one defensible candidate, but the component's behavior, not the framework, decides what the input means.

The two actions are not an accident of the example. The page itself separates writing from applying: typing into the field does not change the visible list, and pressing Enter does. Keeping `search_text` and `search_enter` separate preserves that behavior and makes the second step visible in the run record.

## Several controls require an explicit target

`TaskFilters` contains three buttons. All three use the same primitive, and automatic lookup has no non-arbitrary way to choose one. Attaching one declaration to the component root would therefore be ambiguous.

Each action names its button:

```tsx{1-8,10-17,19-26}
const showAllRef = usePlingTool<HTMLDivElement>({
  id: "show_all_tasks",
  desc: copy.showAllDesc,
  kind: "read",
  action: "click",
  target: 'button[data-filter="all"]',
});
const showOpenRef = usePlingTool<HTMLDivElement>({
  id: "show_open_tasks",
  desc: copy.showOpenDesc,
  kind: "read",
  action: "click",
  target: 'button[data-filter="active"]',
});
const showCompletedRef = usePlingTool<HTMLDivElement>({
  id: "show_completed_tasks",
  desc: copy.showCompletedDesc,
  kind: "read",
  action: "click",
  target: 'button[data-filter="completed"]',
});

const filtersRef = useMemo(
  () => mergeRefs(showAllRef, showOpenRef, showCompletedRef),
  [showAllRef, showCompletedRef, showOpenRef],
);
```

The target is a CSS selector inside the declaration element, not a search of the whole document. That boundary matters. It keeps an action tied to the component the developer declared, and it prevents a later part of the page from satisfying the selector by accident.

An explicit target raises fidelity to `high` with the reason `declared` only when it matches exactly one element inside the declaration element. If it matches nothing, the action remains registered but resolves to `low` with `target-missing`. The selector is a claim about the component's structure, not a permission check, and it does not prove that the click produced the intended business result.

## Hover can reveal the next target

The bulk menu is closed by default. Its clear button does not exist in the DOM until the menu opens. Because `clear_completed` is declared on that button, no binding exists while the menu is closed: the action is absent from the registry, not merely unavailable. A declaration on the always-mounted wrapper with a target selector would behave differently. It would still be registered, but would resolve to `low` with `target-missing` while the button is absent.

The page opens the menu on pointer entry:

```tsx{10-12,24-29}
export const BulkMenu = forwardRef<HTMLDivElement, BulkMenuProps>(function BulkMenu(
  { label, clearLabel, clearRef, completed, onClear },
  ref,
) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bulk"
      ref={ref}
      onMouseOver={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="bulk__trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open ? (
        <div className="bulk__menu">
          <button
            ref={clearRef}
            className="todo__clear"
            type="button"
            disabled={completed === 0}
            onClick={onClear}
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
});
```

The two declarations attach to different elements:

```tsx{1-12}
const openBulkMenuRef = usePlingTool<HTMLDivElement>({
  id: "open_bulk_menu",
  desc: copy.openBulkMenuDesc,
  kind: "read",
  action: "hover",
  fidelity: "high",
});
const clearCompletedRef = usePlingTool<HTMLButtonElement>({
  id: "clear_completed",
  desc: copy.clearCompletedDesc,
  kind: "danger",
});
```

The hover action is declared on the always-mounted wrapper. Its `fidelity: "high"` is an explicit claim that the wrapper owns the pointer handlers. After the hover primitive runs, React renders the menu, and the clear button's own declaration enters the registry. The clear action needs no `target` because the button itself is the declaration element.

Availability and absence are different failure modes. A mounted action can be unavailable because it is disabled or covered. An action declared on an element that has not rendered is absent from the registry. An action whose declaration mounts but whose `target` is missing remains registered and resolves to `low` with `target-missing`. The model cannot call an absent action, and a registered `low` action still has no defensible DOM path.

## Fidelity is evidence, not a success flag

The fixture produces different fidelity values for different reasons:

| Value | How it was obtained | What it means here |
| --- | --- | --- |
| `high`, `native` | the declaration sits on a native `<select>` or button | the element can receive the primitive directly |
| `high`, `declared` | the developer supplied `target` | there is a specific, reviewable element inside the component |
| `high`, `declared` | the developer set `fidelity: "high"` on an element that owns the event | the claim should match the component's handlers |
| `auto` | exactly one compatible input was found inside the wrapper | the DOM path is credible, but the component still owns the behavior |
| `low` | lookup was disabled, `target` matched nothing, or several candidates remained | the result must not be presented as proof that the page reacted |

A declared `target` and an explicit `fidelity` claim both report the reason `declared`; they differ in what the developer supplied. The reason explains how the target was accepted, not whether the operation succeeded.

The value never means “the business operation succeeded.” A click can reach the right button and still fail validation, hit a server error, or produce the wrong record. Conversely, a `low` result does not guarantee that the browser event had no effect. It says the framework lacked a defensible explanation for the target.

`autoTarget: false` is narrower than `run`. It stops lookup inside the declaration element. If that element handles the click itself, an explicit fidelity claim may be accurate. If it does not, the action still has no reliable DOM path and should use `run` or declare the correct target instead.

## When not to simulate the control

There are real cases where a component cannot be operated faithfully through DOM events. A canvas editor, a virtualized list that destroys rows, or a widget that maintains an internal keyboard state machine may not expose a stable element for the intended operation. In those cases, expose a small application operation with `run` and a result condition.

Do not use `run` to hide an unresolved target. If the page already has a native control with the right behavior, use it. If the component can name one internal control, use `target`. Use `run` when the interaction itself is not the contract; the business operation is.

## Verify the chapter example

From the repository root, start the English interface:

```bash
pnpm tutorial:dev r-06
```

Open `http://127.0.0.1:5246/`. The source lives in `examples/tutorials/r-06-real-controls-and-custom-components`. For Chinese, use `pnpm tutorial:dev r-06 --locale zh` and `http://127.0.0.1:5246/?lang=zh`.

Check the following:

1. Choose `Later`, enter `Prepare tomorrow's agenda`, and submit. The new row should carry the `Later` badge.
2. Type `customer` in the search field. The list should not change yet. Press Enter; only the customer follow-up should remain.
3. Clear the search field and press Enter, then choose `All`. Click `Open`, `Done`, and `All` in turn. Each filter should visibly change the list.
4. Move the pointer over `More`. The menu should open and show `Clear completed (1)`. Click it and confirm the completed row disappears, then choose `All` again.
5. Ask the assistant: `Add “Draft the release note” with later priority, then search for release.` With no search applied and `All` selected, the new task can pass its result condition. A real model should use `select_priority`, `add_task`, `search_text`, and `search_enter` in that order.
6. Open **Activity**, then **Diagnostics**. Under **Actions**, confirm the ids and primitives; under **Page at this call**, confirm which actions existed in the request. Neither view shows target selectors or the reason a target was accepted, so check those against the declarations in sections 3–6. This run never opens the menu, so `clear_completed` should be absent from its tool list.

## Next step

The page now gives the agent native controls, a single-input component, an explicitly targeted multi-button component, and content that appears only after a pointer event. Each interaction resolves to a fidelity value and a reason: `native` for a direct control, `declared` for an explicit target or fidelity claim, `auto` for one inferred candidate, and `low` when no defensible target exists. The run record surfaces non-high values; target selectors remain in the source. Each interaction stays at the page level rather than becoming an invented business shortcut.

The next chapter turns to repeated row actions. It explains how a list of records can expose one operation without producing one tool per row, and what evidence remains after an operation changes the data.
