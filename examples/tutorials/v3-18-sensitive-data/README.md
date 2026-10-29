# V3-18 · Sensitive data

This fixture keeps the order flow and adds phone, identity, and internal-rating
fields. Phone numbers use token mode so an action can use the value without the
model seeing it; the other fields use masked and hidden modes.

Run it with `pnpm tutorial:dev v3-18`; the page is served at
`http://127.0.0.1:5231/`.
