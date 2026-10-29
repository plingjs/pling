# Recipe 08: multi-page task continuity

Run `pnpm dev:examples` and open
`http://localhost:5191/demos/recipe-continuity/?lang=zh`. Ask the assistant:
“Open Globex, set the note to Dinner on Friday, and save it.” Opening the
customer is a normal document navigation, not an in-page route. The pending
task resumes on the detail document and returns to the list once it finishes.

The runtime uses an explicit `continuity` key and `maxTurns: 100` for the demo.
Production deployments need to bind this behaviour to the host's navigation and
identity model.
