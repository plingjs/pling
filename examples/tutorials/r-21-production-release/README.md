# R-21 · Production release

This fixture keeps the Todo example and adds an executable release preflight for
transport, browser credentials, model policy, turn and context budgets,
telemetry, origin allowlisting, and a kill switch. The release panel is excluded
from the page projection, and the only `release_*` action available to the agent
is a read-only status query.

Run it with `pnpm tutorial:dev r-21`; the page is served at
`http://127.0.0.1:5261/`.
