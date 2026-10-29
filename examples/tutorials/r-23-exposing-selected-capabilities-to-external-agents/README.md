# R-23 · Exposing selected capabilities to external agents

This fixture runs a normal React Todo page and a second, protocol-level client
in the same viewport. Surface publishes only `todo.overview`, `todo.add`, and
`todo.clear_completed`; row deletion and toggling stay private. Destructive
execution still requires a confirmation rendered by the page.

The local console removes transport from the picture so the protocol boundary is
visible. A production deployment must put identity, origin checks, rate limits,
and replay protection in front of the same Surface.

Run it with `pnpm tutorial:dev r-23`; the page is served at
`http://127.0.0.1:5263/`.
