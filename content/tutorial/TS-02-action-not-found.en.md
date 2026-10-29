---
id: TS-02
title: "Action not found"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Action not found

`ACTION_NOT_FOUND` means the executor's current page registry has no such id. It is usually a declaration, snapshot, or naming problem, not a model capability problem.

## Common causes

| Cause | Symptom | Fix |
| --- | --- | --- |
| Dynamic id mismatch | Row key or delimiter differs | Generate ids through one function and test it |
| Action in an unmounted region | Call after a modal closes | Remove registration on close; describe before calling |
| Page navigated | Old snapshot id is absent from the new page | Describe after navigation |
| Namespace collision | Two components share a prefix | Use a unique scope or namespace |
| Stale build | Old bundle lacks the new action | Clear cache and verify the build version |
| Expired snapshot | Record or region changed after observation | Bound snapshot lifetime and refresh on change |

## Diagnostic order

1. Copy the id from the current debug snapshot, not chat history.
2. Check whether the action appears in the tool list; if not, inspect declaration and conditional rendering.
3. For a folded action, confirm the target record is still referenceable.
4. Check route and modal state.
5. If namespaces are enabled, check that the caller includes the prefix.
6. Run the same action through the in-page assistant; failure there points to page declaration.

## Dynamic ids

```ts
const toggleId = (taskId: string) => `toggle@${taskId}`;
```

Do not write `` `toggle-${id}` `` in one place and `` `toggle@${id}` `` in another. The id is a protocol contract, not display text.

If an id depends on list position (`row-1`), sorting or filtering points it at another record. Use a stable business key.

## Snapshots and navigation

An action existing once does not mean it exists forever. After navigation, the old registry may be destroyed and the new page may not be mounted. An external client must `describe` again when page identity changes. Do not reuse old capabilities across SPA, MPA, iframe, or Shadow DOM boundaries. See [Continuity and projection reference](/reference/continuity-and-projection).

## Prevent recurrence

- Generate each family of ids through one function.
- Assert the id-to-record relationship in tests.
- After navigation or modal close, assert old ids are unavailable.
- Inspect the tool list after a build.
- Do not describe “not found” as permission denial; recovery differs.

## Related

[The page capability model](/concepts/the-page-capability-model), [Error codes and diagnostics](/reference/error-codes-and-diagnostics).
