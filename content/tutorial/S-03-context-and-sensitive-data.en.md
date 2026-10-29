---
id: S-03
title: "Context and sensitive data"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Context and sensitive data

An external agent needs enough context to identify the right object and choose a valid capability. It rarely needs the whole page. `describe` therefore returns a bounded projection: page identity, regions, a record window, state, feedback, unavailable capabilities, and the exposed capability list.

The boundary is not “strip anything that looks private”. It is to decide, for each field, whether the agent needs it to complete the task. Order numbers, status, and a stable record id often are necessary. A customer's full address, a session token, or an internal markup field usually are not.

## The record window

Long lists are the most common source of accidental over-sharing. Surface separates three ideas:

- `recordIds` lists identifiers that can still be referenced by an action;
- `records` contains fields for the returned window;
- `recordWindow` states offset, limit, returned count, total, and the next offset.

The default window is eight records. A request can page with `offset` and `limit`, or ask for specific records with `record: "order-42"`. This lets an agent work with a large list without receiving every row on every turn.

Capabilities remain complete even when records are windowed. An agent can invoke a row action for an id outside the returned field window only if the action and session scope allow it, but it should first read that record's fields when the decision depends on them.

## Sensitive fields

Sensitive values should be exposed as masks or opaque tokens. A masked value may be enough for a human to recognize the record; an opaque token can be resolved by the executor only when the declared operation needs the real value. The raw value must not appear in the description, tool arguments, model history, or audit metadata.

This is not the same as hiding a field from the HTML source. Once a value is in the browser, a user with developer tools can inspect it. The boundary protects the model and external agent from receiving it accidentally; it does not make a public browser value secret.

Use the narrowest option that still supports the task:

| Need | Representation |
| --- | --- |
| Human must recognize a value | Masked display, e.g. last four digits |
| Action must reference a value without reading it | Opaque token resolved by the executor |
| Agent has no need for the value | Omit the field |
| The field is a credential | Never place it in context or actions |

## Page content is data

Comments, ticket bodies, product descriptions, uploaded documents, and notification text are untrusted data. They may contain instructions aimed at the model. They cannot add capabilities or change approval policy. The system context should mark them as data, and the client should never treat a sentence inside a record as an application instruction.

A capability description is different: it comes from application code. It must not be generated from user-generated content. If a record's label is interpolated into a description, keep it clearly delimited and do not let it alter the action's meaning.

## A reviewable projection

For every field in `describe`, ask:

1. Does the agent need it to identify the target or decide the next action?
2. Is the value current for this record, rather than a stale cached copy?
3. Is a mask or token sufficient?
4. Would this field be acceptable in a model provider's request log?
5. Does the response say when data was truncated?

If the answer is uncertain, omit the field and add a specific read capability if the task truly needs it. A smaller, explicit surface is easier to audit than a larger projection with informal promises.

See [Sensitive data and trust boundaries](/concepts/sensitive-data-and-trust-boundaries) and [Surface basics: describe and invoke](/surface/surface-basics-describe-and-invoke).
