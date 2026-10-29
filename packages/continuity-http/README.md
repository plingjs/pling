# @plingjs/continuity-http

Optional HTTP integration for continuing a Pling task across pages, tabs, or
devices. It contains a browser client, a Web Request/Response handler, and an
in-memory backend for tests.

```bash
npm install @plingjs/continuity-http
```

The package defines the transport contract; durable storage, authentication,
lease ownership, and conflict handling remain in the application backend.

## Documentation

- [Task continuity across pages and tabs](https://plingjs.dev/concepts/task-continuity-across-pages-and-tabs)
- [Continuity and projection](https://plingjs.dev/reference/continuity-and-projection)
- [Multi-page task continuity](https://plingjs.dev/recipes/multi-page-task-continuity)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
