# V3-15 · Confirmation and human handoff

This fixture puts three different gates on one workspace page:

- `archive_workspace` is dangerous and asks once (`confirm: true`);
- `reset_workspace` is dangerous and asks every time (`confirm: "always"`);
- `publish_changes` must be completed by a person, so it uses `handoff` instead of simulating the click.

From the repository root:

```bash
pnpm tutorial:dev v3-15
```

The example runs on port `5228` after installing local framework tarballs. Run deterministic checks with:

```bash
pnpm tutorial:check v3-15
```
