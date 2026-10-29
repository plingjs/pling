# Recipe 07: search, filters, and long lists

Run `pnpm dev:examples` and open
`http://localhost:5191/demos/recipe-search-long-list/?lang=zh`. Search for a
customer or switch status, then ask the assistant to show more matching rows.
The page keeps `total`, `matched`, and `rendered` separate instead of treating a
filtered count as the database size.

All 160 tickets exist locally in this fixture. A production adapter should
replace the local array with a paginated read model and preserve the same
bounded-view contract.
