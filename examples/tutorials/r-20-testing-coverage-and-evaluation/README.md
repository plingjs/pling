# R-20 · Testing, coverage, and evaluation

This fixture separates three questions: whether a declared action changes the
right state, whether every actionable control has been classified, and whether
a scripted request selects the expected tools. The visible Export CSV control
is intentionally left undeclared so `inspectCoverage()` has a real gap to
report; it never becomes an agent action.

Run it with `pnpm tutorial:dev r-20`; the page is served at
`http://127.0.0.1:5260/`.
