# Recipe 09: expose three safe capabilities to an external agent

Run `pnpm dev:examples` and open
`http://localhost:5191/demos/recipe-external-surface/?lang=zh`. Use the external
client panel to call `describe`, approve an article, and add a comment. Then try
to delete an article through the same client: the protocol rejects it because
`article_delete` is not in the expose list.

This page runs the surface in the browser for inspection. The transport and
identity checks belong in a server boundary; see the MCP recipe and the
reference gateway for that separation.
