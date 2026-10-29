# R-05 · Actions with input and verified results

This fixture starts from the working Todo agent in R-04. The visible form is
unchanged, but the agent now calls one business action, `add_task`, instead of
filling the input and pressing submit as two separate controls. The declaration
contains the argument schema, the availability condition, and the result the
page expects after the operation.

```bash
pnpm tutorial:dev r-05
pnpm tutorial:dev r-05 --locale zh
pnpm tutorial:check r-05
```
