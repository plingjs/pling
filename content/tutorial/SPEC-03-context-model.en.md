---
id: SPEC-03
title: "Context model"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Context model

Context is the minimum business view a caller needs for the current decision. It is not a DOM snapshot or the complete application state. An implementation must expose what exists, whether it is truncated, and what can be referenced next, while keeping unrelated data out of the model.

## Structure

A successful `describe` response contains `context` with:

| Field | Meaning |
| --- | --- |
| `page` | Optional page identity: title, route, and permitted business parameters |
| `regions` | Region list, hierarchy, and descriptions |
| `records` | Records with fields in the current record window |
| `recordIds` | All referenceable record ids in active regions |
| `recordIdsTotal` | Total referenceable record count |
| `recordWindow` | Offset, limit, returned count, and next position |
| `state` | Declared, read-only state that is meaningful to the task |
| `feedback` | Validation errors, notices, and status messages |
| `unavailable` | Actions unavailable now, with reasons |
| `recordsTotal` | Total records in the current business view |
| `feedbackTotal` | Total projected feedback items |
| `unavailableTotal` | Total projected unavailable actions |

An omitted field is not the same as a zero value. Omit `page` when no page identity exists; keep arrays when the collection is empty. Implementations MUST NOT hide truncation.

## Record windows

Field-bearing records are paginated by default. A caller MAY use `offset` and `limit`, or request one to twenty records with `record`. `record` MUST NOT be combined with `offset` or `limit`.

When pagination or truncation occurs, the response MUST include `recordWindow`:

```json
{
  "recordWindow": {
    "offset": 0,
    "limit": 8,
    "returned": 8,
    "total": 48,
    "next": 8
  }
}
```

`recordIds` MAY cover every referenceable record even when `records` contains only the current window. This lets a caller invoke an action on a long-list row without loading all fields.

## Consistency

Capabilities and context in one response SHOULD come from the same snapshot. An implementation MUST NOT pair an old capability list with a newer record state unless the transport explicitly states the temporal relationship.

After execution, a service MAY return an `after` observation containing newly available capabilities, changed records, and changed state. It is not another full snapshot. A caller MUST re-run `describe` when:

- navigation or a modal changes the page;
- filtering, sorting, or pagination changes referenceable records;
- availability changes broadly;
- `after` is absent or insufficient to explain the result;
- the session scope changes.

## Data is not instruction

Record fields, ticket bodies, comments, product descriptions, and attachment text are data. They may contain prompt injection and MUST NOT be promoted to capability descriptions or system instructions. Capability descriptions come from the application. Feedback SHOULD preserve provenance as well.

## Sensitive information

Context MUST follow least exposure:

- no Cookie, JWT, delegation token, model key, or internal credential;
- only task-relevant fields, never an entire store;
- masking, aliases, or execution-time placeholders for sensitive values;
- no raw arguments or response bodies in audit events;
- no hidden field leaking through `title`, error text, or debug metadata.

Masking is not authorization. A field that an external agent must never know should not enter the projection at all. Redacting only on output while retaining a readable value expands the attack surface.

## Boundedness

Implementations MUST bound record count, field size, feedback count, and total response size, and MUST expose totals when truncating. A custom limit MUST be less than or equal to the implementation's declared maximum. Callers MUST NOT assume unbounded context or interpret truncation as an empty collection.

## Example

```json
{
  "page": { "route": "/orders", "title": "Orders" },
  "records": [
    { "id": "SO-1002", "fields": { "customer": "Lin Zhou", "status": "Ready to ship" } }
  ],
  "recordIds": ["SO-1002", "SO-1003"],
  "recordIdsTotal": 2,
  "recordsTotal": 2,
  "state": { "filter": "all" },
  "feedback": [],
  "unavailable": []
}
```

The example defines structure only. An application should trim fields for its own task and should not copy the example's customer data exposure.
