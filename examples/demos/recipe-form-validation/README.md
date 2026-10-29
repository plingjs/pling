# Recipe 03: form validation and verified submit

Run `pnpm dev:examples` and open
`http://localhost:5191/demos/recipe-form-validation/?lang=zh`. Ask the assistant
to fill and submit the invoice, then ask it to use the customer `Blocked Co`.
The page preserves field errors, exposes a submitting state, and only clears
the form after a receipt has been produced.

The business function remains the only write path. The assistant does not set
state directly and does not bypass the email or amount checks.
