# Recipe 13: use your own model key

Run `pnpm dev:examples` and open
`http://localhost:5191/demos/recipe-model-key/?lang=zh`. Open **Activity** in the
assistant, choose the built-in model settings, and enter a compatible base URL,
model id, and key. Then send a prompt and inspect the real messages and tool
activity.

Use `memory` for the least persistent option in this demo, or `session` to keep
the connection across a refresh in the same tab. The page never receives the
key. A production application that does not want a browser-held key should use
a same-origin gateway and omit BYOK.
