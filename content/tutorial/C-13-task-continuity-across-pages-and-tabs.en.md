---
id: C-13
title: "Task continuity across pages and tabs"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Task continuity across pages and tabs

A single-page route change usually leaves the conversation runtime alive. A full document navigation does not. The old registry, DOM observers, pending tool call, and in-memory model history are gone. Continuity exists to carry a bounded task checkpoint into the next document without pretending the old page still exists.

## What is carried

A checkpoint contains the original goal, a bounded page description, recent messages and events, a summary, task status, and the page where the task began. It does not contain DOM nodes, element handles, screenshots, cookies, access tokens, or unmasked sensitive values. The next document re-declares its own regions, records, state, and capabilities.

This distinction is the central safety rule: the resumed model receives context, not authority. An action that existed on the previous page is not callable merely because its id appears in the transcript. The current page must expose it again, and the current executor must find it available.

## Scopes

The continuity configuration has three practical scopes.

| Scope | Sharing unit | Use case |
| --- | --- | --- |
| `tab` | One origin in the same browser tab | Classic MPA navigation |
| `browser` | Explicitly leased tasks across tabs on the same origin | User moves between tabs and chooses a task |
| `remote` | A host-provided authority | Server-side ownership and cross-device coordination |

`tab` is the default and uses a bounded storage checkpoint. `browser` adds a shared authority so only one tab owns a task at a time; followers may observe but do not execute automatically. A takeover or fork is an explicit user action. `remote` requires an authority supplied by the host; the framework does not invent a database or identity service.

## Resume policy

`resume` controls what happens in the next document:

- `ask` shows a resume control and waits for the user;
- `auto` sends one controlled continuation message when the new page is ready;
- `off` restores context but starts nothing.

Automatic resume still goes through the model loop, current-page observation, availability checks, and confirmation. It removes repeated explanation, not permissions. If the old document vanished during a tool call, the restored history receives a synthetic result saying that the page navigated mid-execution and the outcome is unknown. Re-observing is safer than guessing and retrying a possible side effect.

## Browser ownership

A cross-tab task needs a lease, not merely a shared string in local storage. Only the owner may run the loop, write checkpoints, or complete the task. A follower must not silently take over when the owner is still alive. Lease expiry is handled by the supplied authority, and the UI should distinguish owner, follower, expired lease, completed task, and revoked access.

Do not use continuity storage as a queue for approvals. An approval belongs to a live session and a specific request. Persisting it across a navigation can authorize a later call under different context. Keep approvals, delegation credentials, and sensitive values out of checkpoints.

## Business data stays separate

Task continuity is not application persistence. The business record still belongs to the application's own store. A checkpoint may say that the user intended to edit a note; it must not become the source of truth for the note itself. After resuming, the page reads current business state and the model verifies what is actually present.

Use a storage key unique to the application and session. Multiple assistants writing the same key overwrite each other. Test a navigation without continuity enabled, then with it enabled, and finally with an expired checkpoint. A resume that cannot validate the version or page should fail closed and leave the user in a clean state.

## Continuity checks

- Does every document re-create its own registry and executor?
- Does the restored state exclude credentials, approvals, and sensitive values?
- Can a follower observe without executing?
- Is takeover explicit and atomic?
- Does an interrupted tool call produce an unknown-outcome result rather than a guessed success?
- Can an operator clear or expire the checkpoint without editing the business database?

See [MPA and task continuity](/vanilla/mpa-and-task-continuity) for a working implementation and [Continuity and projection](/reference/continuity-and-projection) for the API boundary.
