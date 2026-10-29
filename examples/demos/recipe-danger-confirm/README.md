# Recipe 05: dangerous actions and confirmation

Run `pnpm dev:examples` and open
`http://localhost:5191/demos/recipe-danger-confirm/?lang=zh`. Ask the assistant
to archive `RPT-31`, first reject the confirmation and observe that nothing
changes, then repeat and allow it. The result log is written only after the
business function runs.

The page uses `kind: "danger"` and `confirm: "always"`. This is a local teaching
fixture; production actions still need server-side authorization and audit.
