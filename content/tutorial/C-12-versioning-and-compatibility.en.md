---
id: C-12
title: "Versioning and compatibility"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Versioning and compatibility

Pling has several version axes, and they do not move together. A package release, a Surface protocol revision, a persisted continuity envelope, and an application's capability ids can each change independently. Treating them as one number makes upgrades look safer than they are.

## Four axes

| Axis | Example | What a change means |
| --- | --- | --- |
| Package | `@plingjs/vue 0.1.x` | JavaScript API and adapter behavior |
| Protocol | `pling.surface/0.1` | Request and response contract between a Surface and an agent client |
| Persisted state | continuity envelope version | Data written by an older release and read by a newer one |
| Capability | `orders.update_note` | The application's externally visible action contract |

The packages currently use prerelease versions. That is a statement about API stability, not permission to make silent breaking changes. During prerelease, document migrations and keep experiments isolated; after 1.0, semantic versioning should govern each package independently.

## Compatibility rules

An additive change can usually remain within the same protocol minor version: a new optional field, a new capability, or an additional error code that old clients can safely treat as an unknown failure. A change to required input, envelope shape, or the meaning of an existing result is breaking and needs a protocol revision.

Capability ids should remain stable for the same business intent. If an operation's semantics change materially, introduce a new id or a versioned application namespace rather than silently changing what an old id does. Removing a capability is a permission and automation break even when the HTTP endpoint remains available.

Persisted state needs explicit validation. A continuity checkpoint or queued approval written by an older release must be rejected or migrated when its version is unknown. Do not attempt to execute a partially understood envelope because it happens to contain plausible fields.

## Upgrading in order

For a normal application upgrade:

1. Read the package changelog and the Surface protocol notes.
2. Run the declaration and execution tests against the new packages.
3. Test replay and continuity with state written by the previous release.
4. Verify that every exposed capability still has the same id, input schema, effect, and approval behavior.
5. Canary the new build with a narrow capability set and a bounded budget.
6. Keep a rollback that can disable the assistant without changing the business page.

Do not upgrade the browser client and the remote gateway at the same time unless the compatibility matrix explicitly supports that combination. Independent version axes exist so that a protocol change can be rolled out on one side first.

## Deprecation

A deprecation is a migration window, not a warning string. State the old and new contract, the first release that emits the warning, the last release that accepts the old form, and the observable behavior after removal. Emit the warning through a machine-readable path as well as documentation.

For external agents, use a protocol revision and a conformance check. For page developers, use package release notes and adapter-specific migration notes. For persisted state, use fail-closed validation and a tested migration. These audiences need different notices because they encounter compatibility at different boundaries.

## A review checklist

- Is the package version independent from the protocol version?
- Does the change add an optional field, or alter an existing required one?
- Are capability ids and their meanings still stable?
- Can older persisted state be rejected clearly or migrated safely?
- Does an older client remain interoperable for the declared subset?
- Is there a rollback path that does not require a database rewrite?

Versioning is not paperwork around a release. It defines which independently deployed pieces may continue to trust each other. See [Surface versioning and governance](/surface/versioning-and-governance) and [Upgrade Pling safely](/operations/upgrade-pling-safely).
