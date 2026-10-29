---
id: TS-06
title: "Records stale or duplicated"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Records stale or duplicated

A record view is a business projection at one moment. It can become stale or duplicated through async updates, pagination, filtering, unstable ids, or double-mounted components. Do not patch by position or display text; fix ids and snapshot lifetime.

## Common causes

| Cause | Symptom |
| --- | --- |
| Unstable record id | Sorting makes an action target the wrong row |
| Array index used as key | Deletion reuses old component state |
| Double mount | A record appears twice or an action executes twice |
| Async race | An old response overwrites newer records |
| Stale snapshot | Agent uses a deleted or updated record |
| Pagination / virtual list | Agent sees a window but assumes the whole set |
| Multiple tabs | Two pages maintain different state |

## Principles

1. Derive record ids from business keys, not array positions.
2. Recheck the target record before execution; the protocol validates folded record ids.
3. Refresh descriptions after navigation, filtering, sorting, pagination, or writes.
4. Give each record one projection owner to avoid duplicate registration.
5. Expose totals and windows explicitly; never truncate silently.
6. Version or cancel async responses so an old response cannot overwrite a newer state.

## Duplicate execution

If one user action creates two records:

- check for a double-mounted frontend component;
- check whether the model called twice;
- check whether the transport retried an executed request;
- check backend idempotency constraints;
- check whether `request.id` was reused or wrongly treated as a business idempotency key.

Replay protection prevents reuse of one request id in a session; it does not make the business handler idempotent. Production writes still need database constraints or idempotency tokens.

## Diagnostic steps

1. Capture before/after snapshots and `changed.records`.
2. Compare record ids, counts, and update times.
3. Look for two page instances or two agents operating concurrently.
4. Use a read action to confirm backend truth.
5. If page and backend disagree, fix synchronization before permitting writes.

## Acceptance

- Sorting, filtering, and deletion keep ids bound to the same business object.
- Old records are not callable after navigation.
- Pagination exposes total and next position.
- Retry does not write twice.
- Multi-tab conflicts have an explicit policy.

## Related

[Records, row actions, and change evidence](/vue/records-row-actions-and-change-evidence), [Long lists, scrolling, and offscreen actions](/vue/long-lists-scrolling-and-offscreen-actions), [Context model](/spec/0.1/context-model).
