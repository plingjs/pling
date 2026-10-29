# Recipe 06: file upload and asynchronous work

Run `pnpm dev:examples`, open
`http://localhost:5191/demos/recipe-upload-async/?lang=zh`, and upload any small
file. The backend receives the bytes, creates a job, and advances its progress.
Upload a file whose name contains `virus` to see a failed job; use **Retry** or
**Cancel** while the job is active.

The backend is `examples/recipe-backends/access-service`. It keeps metadata in
memory, does not scan the content, and does not persist files. Replace it with a
reviewed object-store and queue integration in production.
