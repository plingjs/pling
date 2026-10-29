# R-17 · Runtime limits, observability, and error codes

This fixture keeps the four-step order-note flow and adds the runtime around it:
bounded context and turn budgets, separate turn and model-call counters, a
bounded request inspector, and stable error codes with a resumable failure.

Run it with `pnpm tutorial:dev r-17`; the page is served at
`http://127.0.0.1:5257/`.
