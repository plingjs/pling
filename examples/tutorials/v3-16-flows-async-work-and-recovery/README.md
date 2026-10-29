# V3-16 · Flows, async work, and recovery

This fixture shows one compound order operation: changing a note across four
ordered steps. The save step completes asynchronously, and a lock switch creates
a recoverable failure so the example can demonstrate `pling_resume_flow`.

Run it with `pnpm tutorial:dev v3-16`; the page is served at
`http://127.0.0.1:5229/`.
