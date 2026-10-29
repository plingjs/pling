---
id: OPS-07
title: "Upgrade Pling safely"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Upgrade Pling safely

An upgrade is safe only when the application can still prove three things: the page declares the capabilities it intends to expose, the executor performs them with the same policy, and an older client or persisted state cannot be misinterpreted. Package installation is the smallest part of the work.

## Before changing the version

Record the current package versions, Surface protocol version, adapter, browser targets, Node version, and persisted continuity or delegation format. Capture a small baseline: a read task, a write task, a confirmation, a failure, and a resumed task. Run that baseline against the current build before upgrading.

Read the release notes for every package that changes, not only the adapter named in the application. Updating `@plingjs/vue` can pull a different `core`, `dom`, `agent`, or `ui` through the workspace. In a deployed application, pin the complete set and deploy it together.

## Upgrade sequence

1. Update dependencies in a branch.
2. Run declaration, executor, adapter, and end-to-end tests.
3. Re-run the five-task baseline with deterministic replay where possible.
4. Inspect generated capability definitions; compare ids, input schemas, effects, and approvals.
5. Test old persisted checkpoints and delegated sessions against the new code.
6. Deploy to a narrow canary group with a lower turn budget and explicit kill switch.
7. Compare error codes, tool success, latency, and token usage with the baseline.

If a protocol and a package must change together, stage the compatible protocol revision first and keep the old package supported for the migration window. Do not silently change an existing capability's meaning to avoid releasing a second version.

## What usually breaks

The riskiest changes are not compile errors. They are behavior changes that still compile: an action becomes unavailable under a new rule, a generated id changes, a default limit tightens, a confirmation becomes `always`, a snapshot field is omitted, or a previously accepted input now fails schema validation.

Persisted state is the second common risk. A checkpoint from an older release may be valid JSON but incompatible with the current message protocol. Validate the envelope version and page identity, then discard or migrate rather than executing uncertain state. The same applies to delegation records and approval receipts: a token that cannot be introspected after an upgrade must fail closed.

## Rollback

A rollback should not require a database rewrite. Keep the previous server-compatible build available, make the assistant entry remotely disableable, and preserve protocol compatibility long enough to drain active sessions. If new state was written, define how the old build will treat it; usually the safe answer is to ignore it and ask the user to restart the task.

## Verification checklist

- Package and protocol versions are recorded in the release artifact.
- Capability ids and schemas are compared, not assumed.
- Confirmation and human-handoff paths were exercised.
- Old checkpoints either migrate or fail closed.
- A canary can be disabled without a frontend release.
- The rollback path has been run, not just documented.

For the compatibility model itself, see [Versioning and compatibility](/concepts/versioning-and-compatibility). For deployment checks, see [Deploy to production](/operations/deploy-to-production).
