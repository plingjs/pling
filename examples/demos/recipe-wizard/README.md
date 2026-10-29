# Recipe 04: multi-step modal and wizard

Run `pnpm dev:examples` and open
`http://localhost:5191/demos/recipe-wizard/?lang=zh`. Complete the company step,
wait for industry options, then continue to contact and review. Earlier form
actions disappear when the step changes.

The visible approval chain is a record list with explicit order controls. A
real implementation should connect these controls to the application's own
workflow engine rather than treating the order as model-owned state.
