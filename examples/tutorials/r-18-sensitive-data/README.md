# R-18 · Sensitive data

This fixture keeps the order desk and adds explicit sensitivity boundaries. Phone
numbers are exposed as session tokens, identity numbers as masked values, and
internal grades as hidden values. A business action restores a token only at the
boundary, while outbound errors replace the original value again.

Run it with `pnpm tutorial:dev r-18`; the page is served at
`http://127.0.0.1:5258/`.
