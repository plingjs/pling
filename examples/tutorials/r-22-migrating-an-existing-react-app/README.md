# R-22 · Migrating an existing React app

This fixture begins with ordinary Todo business functions and a working React
form. Pling adds one provider, one region, explicit declarations around the
existing controls, a per-row record, and a bounded read-only state view. The CSV
export remains a manual control under `data-pling-ignore`.

Run it with `pnpm tutorial:dev r-22`; the page is served at
`http://127.0.0.1:5262/`.
