---
id: TS-07
title: "Navigation loses the task"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Navigation loses the task

A full-page navigation destroys the old document's runtime, registry, and element references. An SPA route usually replaces only components, so the two need different fixes.

## Identify the navigation type

| Type | Symptom | Key issue |
| --- | --- | --- |
| SPA route | No page reload, but tools or regions disappear | Component unmount, route guard, keep-alive |
| MPA navigation | History and pending requests vanish | Continuity checkpoint |
| Iframe navigation | Parent persists, child runtime rebuilds | Explicit sharing and scope |
| Multiple tabs | Task continues elsewhere | Owner lease and explicit takeover |

## SPA

1. Check whether the action lived in an unmounted component.
2. Check whether the page describes again after route change.
3. Check whether keep-alive left an old registration.
4. Check for unique ids or namespaces per route.
5. Check whether an expectation waited across navigation and became invalid.

After navigation, obtain page identity and capabilities again. Do not carry old-route actions into a new route.

## MPA

MPA does not retain element references and cannot restore “approved” state. A continuity checkpoint contains only task goal, summary, recent events, and page identity. It must not contain Cookies, tokens, approval, or raw sensitive values.

Recovery policies:

- `ask`: show a “continue previous task” entry;
- `auto`: send a controlled continuation after the page is ready;
- `off`: restore history without starting.

In every policy, the current page must redeclare capabilities. An action from the previous page does not regain authority.

## Interrupted execution

If a full navigation happens during a tool call, the result may be unknown. History should contain a synthetic result saying the page navigated during execution and the business result is unconfirmed. Read business state before retrying a write.

## Cross-tab

Cross-tab tasks need a lease: one owner executes at a time. A follower may observe but not silently take over. Takeover or fork is a user action. A shared string in storage is not ownership.

## Acceptance

1. Old capabilities cannot be invoked after navigation.
2. New capabilities appear after a fresh description.
3. Checkpoints contain no credentials, approval, or full sensitive values.
4. Recovery does not resubmit an interrupted write.
5. Owner loss, lease expiry, and task completion have distinct UI states.
6. Multiple tabs cannot write the same task concurrently.

## Related

[Task continuity across pages and tabs](/concepts/task-continuity-across-pages-and-tabs), [MPA and task continuity](/vanilla/mpa-and-task-continuity), [Continuity and projection reference](/reference/continuity-and-projection).
