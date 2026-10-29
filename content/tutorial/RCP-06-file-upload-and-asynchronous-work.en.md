---
id: RCP-06
title: "File upload and asynchronous work"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# File upload and asynchronous work

File upload binds page capabilities to user privacy and asynchronous state. An agent must not read the local filesystem or invent file contents. A safe design lets a person choose and confirm the file, exposes a business attachment id, processes it in the backend, and returns verifiable progress and results.

## Runnable page

The page below performs a real file upload and reports the server job moving through queued, running, and completed states. A filename containing `virus` enters the failure path, which can then be cancelled or retried.

<DemoPlayground id="recipe-upload-async" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-upload-async/`. The page source is in `examples/demos/recipe-upload-async/`; the upload and job backend is in `examples/recipe-backends/access-service/`, with routes, in-memory semantics, and production replacement requirements in its `README.md`.

## Responsibility boundary

| Step | Owner |
| --- | --- |
| Select a local file | Person in the browser |
| Malware scan, type and size checks | Upload service or backend |
| Create the business attachment record | Application backend |
| Parse, transcode, or import | Background job |
| Report progress, errors, and cancellation | Page and transport |
| Decide business success | Executor and backend query |

Pling does not place file bytes in model context or let an agent name a local path. Capability arguments should be `attachmentId`, `fileId`, or a batch id. When user selection is required, the page provides a human step; the agent sees `handoff` and status, not a filesystem interface.

## Recommended flow

```text
User selects a file → frontend uploads to an authenticated endpoint
→ backend returns an attachment id (never a local path)
→ agent invokes import_file({ attachmentId })
→ page shows that a job was created
→ agent waits for progress or a result
→ success condition verifies the business object, not only an upload toast
```

“Upload complete” is not “import succeeded.” The success condition should point to a readable business result: imported row count, a generated document id, or a queryable batch state.

## Acceptance criteria

1. Agent input cannot contain local paths or raw file bytes.
2. Only an authenticated user can upload into their own tenant space.
3. The upload endpoint restricts MIME type, extension, size, and count, and validates actual content.
4. Attachment ids are bound to user and tenant and cannot cross accounts.
5. `invoke` returns a job id or explicit status instead of pretending to wait.
6. Cancellation, timeout, partial success, and retry have structured errors.
7. Retries do not create duplicate attachments or imports.
8. Audit records attachment id and outcome, not sensitive filenames or file content.

## Asynchronous state

The page should expose a read-only state view or query action:

```json
{ "jobId": "job_42", "state": "processing", "completed": 120, "total": 300 }
```

The agent may poll at a fixed interval, bounded by rate and turn limits. Do not wait in an unbounded loop; description and status queries should remain cancellable. If the backend is complete but the page is stale, say that a refresh is required instead of assuming the record is present.

## Common failures

**Base64 in a tool argument.** It breaks context limits, logs, and audit. Use the business upload endpoint.

**Trusting a filename.** Filenames can lie. Detect actual type and size, then scan in the backend.

**Retry creates a second import.** Use an idempotency key, batch id, or backend uniqueness constraint. A protocol request id is not automatically a business idempotency key.

**Reporting success at “upload complete.”** Verify the business result or a terminal state.

**Cancel stops only the frontend.** The backend must observe cancellation or check a cancellation flag before committing.

## Framework entry points

For Vue 3, see [Flows, async work, and recovery](/vue/flows-async-work-and-recovery); for React, see [Async work and recovery](/react/flows-async-work-and-recovery). Function-level tools fit a split between “start import” and “query batch.” Tests should cover oversized files, malicious MIME, cross-tenant attachment ids, timeout, and duplicate submission.

## Local verification

Upload a small file and watch the progress. Upload a file whose name contains `virus`; the job should fail rather than produce a successful record. Cancel one active job, retry the failed one, and check that the page state agrees with the server's terminal state.

The backend keeps job metadata in memory, does not persist files, and does not scan content. It exists to make transport, progress, and failure semantics visible; it is not a production upload service.
